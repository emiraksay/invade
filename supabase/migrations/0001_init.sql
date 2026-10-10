-- Invade schema.
-- Principles (docs/ARCHITECTURE.md): store facts only, derive everything else with packages/engine;
-- clients read (RLS) and subscribe (Realtime); only the server (service role) writes.

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- short code, used in links / QR
  map_seed    integer not null default 7,           -- engine generateMap({ seed })
  settings    jsonb not null,                       -- engine GameSettings
  starts_on   date not null,                        -- day 1 of the campaign (game timezone)
  created_at  timestamptz not null default now()
);

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 14), -- MVP spec: max 14 chars
  team        text not null check (team in ('white', 'black')),
  created_at  timestamptz not null default now()
);

-- Private: the per-player sync token used by the iOS Shortcut. Never readable by clients.
-- Only a SHA-256 hash is stored; the plain token lives in the player's Shortcut and setup link.
create table public.player_secrets (
  player_id   uuid primary key references public.players(id) on delete cascade,
  token_hash  text not null unique
);

-- Fact: a player's cumulative Apple Health steps for one game day. One row per (player, day),
-- only ever increased (keep-max), so resends and stale reports are harmless.
create table public.step_reports (
  player_id   uuid not null references public.players(id) on delete cascade,
  game_id     uuid not null references public.games(id) on delete cascade,
  day         date not null,
  steps       integer not null check (steps >= 0),
  source      text not null check (source in ('apple_health', 'demo')),
  updated_at  timestamptz not null default now(),
  primary key (player_id, day)
);

-- Fact log: milestones now, battles later. Append-only; drives animations and the AI.
create table public.events (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  type        text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index on public.players (game_id);
create index on public.step_reports (game_id, day);
create index on public.events (game_id, id);

-- Atomic keep-max upsert. Returns the stored total before and after, so the API can
-- detect milestone crossings exactly once even under concurrent syncs.
create function public.report_steps(p_player uuid, p_day date, p_steps integer, p_source text)
returns table (before_steps integer, after_steps integer)
language plpgsql
as $$
declare
  v_game uuid;
  v_before integer;
begin
  select game_id into v_game from public.players where id = p_player;
  if v_game is null then raise exception 'unknown player'; end if;

  select steps into v_before from public.step_reports
    where player_id = p_player and day = p_day for update;

  insert into public.step_reports as r (player_id, game_id, day, steps, source)
    values (p_player, v_game, p_day, p_steps, p_source)
  on conflict (player_id, day) do update
    set steps = greatest(r.steps, excluded.steps),
        source = case when excluded.steps > r.steps then excluded.source else r.source end,
        updated_at = case when excluded.steps > r.steps then now() else r.updated_at end;

  return query select coalesce(v_before, 0), greatest(coalesce(v_before, 0), p_steps);
end;
$$;

-- Only the server may call it.
revoke execute on function public.report_steps(uuid, date, integer, text) from public, anon, authenticated;

-- RLS: games, players, step_reports, events are readable by anyone with the anon key
-- (the game code is the shared secret for this hackathon). No client writes at all.
alter table public.games          enable row level security;
alter table public.players        enable row level security;
alter table public.player_secrets enable row level security; -- no policies: unreadable
alter table public.step_reports   enable row level security;
alter table public.events         enable row level security;

create policy "read games"        on public.games        for select to anon, authenticated using (true);
create policy "read players"      on public.players      for select to anon, authenticated using (true);
create policy "read step reports" on public.step_reports for select to anon, authenticated using (true);
create policy "read events"       on public.events       for select to anon, authenticated using (true);

-- Realtime: screens subscribe to new/updated step reports and events.
alter publication supabase_realtime add table public.step_reports, public.events, public.players;

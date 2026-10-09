-- Invade schema. Server (Vercel API with service role) is the only writer of game state.
-- Clients authenticate anonymously (Supabase anonymous sign-in) and read via RLS + Realtime.

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- short join code shown in lobby / QR
  host_id     uuid not null,                     -- auth.users.id of the host
  state       jsonb not null,                    -- engine GameState
  version     integer not null default 0,        -- optimistic concurrency, = state.version
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  user_id     uuid not null,                     -- auth.uid() of the device
  name        text not null,
  color       text not null default '#ffffff',
  team        text not null check (team in ('white', 'black')),
  is_host     boolean not null default false,
  banned      boolean not null default false,
  baseline_steps integer not null default 6000,  -- handicap input (seeded in demo)
  created_at  timestamptz not null default now(),
  unique (game_id, user_id)
);

create table public.step_reports (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  round       integer not null,
  steps       integer not null check (steps >= 0),
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  source      text not null check (source in ('device', 'simulated', 'health')),
  cadence     integer[],                         -- steps per second, for anti-cheat
  accepted_steps integer,                        -- filled by server after assessSteps
  flagged     boolean not null default false,
  flag_reasons text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- Append-only log: battles, conversions, dealer lines. Drives animations + battle log screen.
create table public.events (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  type        text not null,                     -- GameEvent['type']
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index on public.players (game_id);
create index on public.step_reports (game_id, round);
create index on public.events (game_id, id);

-- RLS: anyone signed in may read (game code is the secret); only the service role writes.
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.step_reports enable row level security;
alter table public.events enable row level security;

create policy "read games"        on public.games        for select to authenticated using (true);
create policy "read players"      on public.players      for select to authenticated using (true);
create policy "read own steps"    on public.step_reports for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()));
create policy "read events"       on public.events       for select to authenticated using (true);

-- Realtime: clients subscribe to game state changes and new events.
alter publication supabase_realtime add table public.games, public.players, public.events;

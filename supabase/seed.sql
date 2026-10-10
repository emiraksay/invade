-- The hackathon campaign. Players are added with `npm run player:add` (creates their sync token).
insert into public.games (code, map_seed, settings, starts_on)
values (
  'INVADE',
  7,
  '{
    "campaignDays": 30,
    "winThreshold": 0.51,
    "walkPhaseHours": 24,
    "timezone": "Europe/Madrid",
    "teamNames": { "white": "White", "black": "Black" }
  }'::jsonb,
  date '2026-10-10'
)
on conflict (code) do nothing;

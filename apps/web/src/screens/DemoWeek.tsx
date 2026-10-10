import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_MAP, territoryShare, type Player, type TeamId } from '@invade/engine';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView } from '../map/model';
import { supabase } from '../data/supabase';
import { DAY_NAMES, simulateWeek, type DemoDay } from '../data/demoWeek';

/**
 * /demo: a whole season in two minutes on the big screen. One button (or Space / →) walks through
 * intro → each day's morning (AI twist + zone of the day), walk (steps count up), night (battle)
 * → the week's result and the coin payout. Scripted steps, real rules (see data/demoWeek.ts).
 * Uses the real players of the game when it can load them; never writes anything.
 */

const DEMO_PLAYERS: Player[] = [
  { id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'w2', name: 'Varya', team: 'white' }, { id: 'w3', name: 'Costi', team: 'white' },
  { id: 'b1', name: 'Emir', team: 'black' }, { id: 'b2', name: 'Hasan', team: 'black' }, { id: 'b3', name: 'Selin', team: 'black' },
];
const MAX_PER_TEAM = 4;

/** The game's real players (public read), at most 4 per team; demo players when unavailable. */
function usePlayers(code: string): Player[] {
  const [players, setPlayers] = useState<Player[]>(DEMO_PLAYERS);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void (async () => {
      const { data: game } = await supabase.from('games').select('id').eq('code', code).maybeSingle();
      if (!game || !alive) return;
      const { data } = await supabase.from('players').select('id, name, team').eq('game_id', (game as { id: string }).id).order('created_at');
      const rows = (data ?? []) as Player[];
      const pick = (team: TeamId) => rows.filter((p) => p.team === team && p.name?.trim()).slice(0, MAX_PER_TEAM);
      if (alive && pick('white').length && pick('black').length) setPlayers([...pick('white'), ...pick('black')]);
    })();
    return () => { alive = false; };
  }, [code]);
  return players;
}

type Phase = 'morning' | 'walk' | 'night';
type Step = { kind: 'intro' } | { kind: 'day'; day: number; phase: Phase } | { kind: 'result' };

const STEPS: Step[] = [
  { kind: 'intro' },
  ...Array.from({ length: 7 }, (_, i) => (['morning', 'walk', 'night'] as Phase[]).map((phase) => ({ kind: 'day' as const, day: i + 1, phase }))).flat(),
  { kind: 'result' },
];

const TEAM_NAME: Record<TeamId, string> = { white: 'White', black: 'Black' };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = new Intl.NumberFormat('de-DE');

/** 0 → 1 over `ms` each time `key` changes (steps counting up during the walk). */
function useRamp(key: string, active: boolean, ms = 2200): number {
  const [k, setK] = useState(active ? 0 : 1);
  useEffect(() => {
    if (!active) { setK(1); return; }
    setK(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const v = Math.min(1, (performance.now() - t0) / ms);
      setK(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, active, ms]);
  return k;
}

function ShareBar({ white }: { white: number }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}>
        <span>WHITE {pct(white)}</span><span>{pct(1 - white)} BLACK</span>
      </div>
      <div style={{ height: 14, borderRadius: 7, background: '#2b2826', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.3)' }}>
        <div style={{ width: pct(white), height: '100%', background: '#f2f2f2', transition: 'width 900ms ease' }} />
      </div>
    </div>
  );
}

function TeamColumn({ team, players, day, ramp, showSoldiers }: { team: TeamId; players: Player[]; day: DemoDay | null; ramp: number; showSoldiers: boolean }) {
  const mine = players.filter((p) => p.team === team);
  return (
    <section style={{ display: 'grid', gap: 10, alignContent: 'start', textAlign: team === 'white' ? 'left' : 'right' }}>
      <h2 className="display" style={{ margin: 0, fontSize: 40 }}>{TEAM_NAME[team]}</h2>
      {day && showSoldiers && <p style={{ margin: 0, fontSize: 22 }}><strong style={{ fontSize: 34 }}>{day.soldiers[team]}</strong> soldiers tonight</p>}
      {mine.map((p) => (
        <div key={p.id} className="item" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 16px', fontSize: 20, flexDirection: team === 'white' ? 'row' : 'row-reverse' }}>
          <strong>{p.name}</strong>
          <span className="muted">{day ? `${fmt.format(Math.round((day.steps[p.id] ?? 0) * ramp))} steps` : '0 steps'}</span>
        </div>
      ))}
    </section>
  );
}

export function DemoWeek() {
  const players = usePlayers('INVADE');
  const week = useMemo(() => simulateWeek(DEFAULT_MAP, players), [players]);
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const next = () => setI((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const day = step.kind === 'day' ? week.days[step.day - 1]! : null;
  const phase = step.kind === 'day' ? step.phase : null;
  // Battles fought so far: every night before today, plus tonight's once the night has come.
  const nights = step.kind === 'result' ? 7 : step.kind === 'day' ? step.day - 1 + (step.phase === 'night' ? 1 : 0) : 0;
  const battles = useMemo(() => week.battles.slice(0, nights).flat(), [week, nights]);
  const view = walkPhaseMapView(DEFAULT_MAP, { white: { soldiers: 0, maxSoldiers: 1 }, black: { soldiers: 0, maxSoldiers: 1 } }, { battles, today: 'demo' });
  const share = territoryShare(view.war, 'white');
  const targets = day && phase !== 'night' ? new Set([day.zoneId, ...(day.extraZoneId ? [day.extraZoneId] : [])]) : null;
  const ramp = useRamp(`${step.kind}-${day?.day}-${phase}`, phase === 'walk');
  const label = step.kind === 'intro' ? 'THE BET' : step.kind === 'result' ? 'SUNDAY MIDNIGHT · THE RESULT' : `${DAY_NAMES[step.day - 1]!.toUpperCase()} · DAY ${step.day} OF 7 · ${phase === 'morning' ? '☀️ MORNING' : phase === 'walk' ? '🚶 WALKING' : '🌙 NIGHT BATTLE'}`;

  return (
    <main className="screen" style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 32px', display: 'grid', gap: 12, minHeight: '100vh', alignContent: 'start' }}>
      <header style={{ display: 'grid', gap: 4, textAlign: 'center' }}>
        <h1 className="display" style={{ margin: 0, fontSize: 40 }}>INVADE</h1>
        <p className="display" style={{ margin: 0, fontSize: 26, letterSpacing: '0.06em' }}>{label}</p>
      </header>
      <ShareBar white={share} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.3fr) minmax(220px, 1fr)', gap: 28, alignItems: 'start' }}>
        <TeamColumn team="white" players={players} day={phase === 'walk' || phase === 'night' ? day : null} ramp={phase === 'night' ? 1 : ramp} showSoldiers={phase === 'night' || (phase === 'walk' && ramp >= 1)} />
        <div style={{ width: 'min(100%, 34vh)', margin: '0 auto' }}>
          <Battlefield view={view} targets={targets} bloom />
        </div>
        <TeamColumn team="black" players={players} day={phase === 'walk' || phase === 'night' ? day : null} ramp={phase === 'night' ? 1 : ramp} showSoldiers={phase === 'night' || (phase === 'walk' && ramp >= 1)} />
      </div>

      <section className="item" style={{ padding: '18px 24px', display: 'grid', gap: 8, textAlign: 'center', border: '1px solid rgba(255,255,255,0.25)' }} aria-live="polite">
        {step.kind === 'intro' && (
          <>
            <span className="muted" style={{ fontSize: 16, letterSpacing: '0.08em' }}>BEFORE MONDAY · EVERYONE BETS ON THEIR TEAM</span>
            <strong className="display" style={{ fontSize: 30 }}>Pot: {week.pot} coins</strong>
            <span style={{ fontSize: 18 }}>{week.stakes.map((s) => `${s.name} ${s.coins}`).join(' · ')}</span>
            <span className="muted" style={{ fontSize: 16 }}>7 zones, 7 days, one battle every night. Most land on Sunday midnight takes the whole pot.</span>
          </>
        )}
        {day && phase === 'morning' && (
          <>
            <span className="muted" style={{ fontSize: 16, letterSpacing: '0.08em' }}>📜 THE AI DIRECTOR'S DECREE · ZONE OF THE DAY: {day.zoneName.toUpperCase()}{day.extraZoneName ? ` + ${day.extraZoneName.toUpperCase()}` : ''}</span>
            <strong className="display" style={{ fontSize: day.decree.kind === 'rebellion' ? 46 : 34, color: day.decree.kind === 'rebellion' ? '#ff2424' : undefined }}>{day.title}</strong>
            <span style={{ fontSize: 22, lineHeight: 1.35 }}>{day.story}</span>
          </>
        )}
        {day && phase === 'walk' && (
          <>
            <span className="muted" style={{ fontSize: 16, letterSpacing: '0.08em' }}>EVERY STEP FROM APPLE HEALTH BECOMES SOLDIERS</span>
            <strong className="display" style={{ fontSize: 30 }}>{ramp < 1 ? 'Walking…' : `${day.soldiers.white} vs ${day.soldiers.black} soldiers march on ${day.zoneName}`}</strong>
            {ramp >= 1 && day.notes.length > 0 && <span className="muted" style={{ fontSize: 18 }}>{day.notes.map((n) => players.reduce((t, p) => t.replaceAll(p.id, p.name), n)).join(' · ')}</span>}
          </>
        )}
        {day && phase === 'night' && (
          <>
            <span className="muted" style={{ fontSize: 16, letterSpacing: '0.08em' }}>MIDNIGHT · WHITE {day.soldiers.white} vs {day.soldiers.black} BLACK</span>
            <strong className="display" style={{ fontSize: 40 }}>{TEAM_NAME[day.winner].toUpperCase()} TAKES {day.zoneName.toUpperCase()}{day.extraZoneName ? ` AND ${day.extraZoneName.toUpperCase()}` : ''}</strong>
            <span style={{ fontSize: 20 }}>White holds {pct(day.share.white)} of the island · Black {pct(day.share.black)}</span>
          </>
        )}
        {step.kind === 'result' && (
          <>
            <span className="muted" style={{ fontSize: 16, letterSpacing: '0.08em' }}>THE WEEK IS OVER</span>
            <strong className="display" style={{ fontSize: 56 }}>{TEAM_NAME[week.winner].toUpperCase()} WINS THE WEEK</strong>
            <span style={{ fontSize: 22 }}>{pct(week.days[6]!.share[week.winner])} of the island · {week.pot} coins in the pot</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 6 }}>
              {week.payouts.filter((p) => p.team === week.winner).map((p) => (
                <span key={p.playerId} className="item" style={{ padding: '10px 18px', fontSize: 22 }}>
                  <strong>{p.name}</strong> bet {p.coins} → <strong style={{ color: '#59d26b' }}>+{p.payout} coins</strong>
                </span>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 16 }}>The winners split both pots by what they put in. {TEAM_NAME[week.winner === 'white' ? 'black' : 'white']} lost {week.pot - week.stakes.filter((s) => s.team === week.winner).reduce((a, s) => a + s.coins, 0)} coins.</span>
          </>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button type="button" className="pill" onClick={back} disabled={i === 0} style={{ fontSize: 18, opacity: i === 0 ? 0.4 : 1 }}>◀ Back</button>
        <button type="button" className="pill" onClick={next} disabled={i === STEPS.length - 1} style={{ fontSize: 22, minWidth: 220, background: '#fff', color: '#111' }}>
          {step.kind === 'intro' ? 'Start the week ▶' : step.kind === 'result' ? 'The end' : phase === 'morning' ? 'Walk ▶' : phase === 'walk' ? 'Midnight ▶' : step.day === 7 ? 'Results ▶' : 'Next morning ▶'}
        </button>
      </div>
    </main>
  );
}

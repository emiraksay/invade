import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_MAP, territoryShare, type Player, type TeamId } from '@invade/engine';
import { Battlefield } from '../map/Battlefield';
import { walkPhaseMapView } from '../map/model';
import { supabase } from '../data/supabase';
import { JoinQr } from '../components/JoinQr';
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
/** Always the live game: the demo may run from a laptop (localhost), which phones in the room can't open. */
const JOIN_URL = 'https://invade.vercel.app/join?code=INVADE';

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
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
        <span>WHITE {pct(white)}</span><span>{pct(1 - white)} BLACK</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#2b2826', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.3)' }}>
        <div style={{ width: pct(white), height: '100%', background: '#f2f2f2', transition: 'width 900ms ease' }} />
      </div>
    </div>
  );
}

/** One team inside the phone: soldiers tonight and each player's steps today. */
function TeamList({ team, players, day, ramp, showSoldiers }: { team: TeamId; players: Player[]; day: DemoDay | null; ramp: number; showSoldiers: boolean }) {
  const mine = players.filter((p) => p.team === team);
  const right = team === 'black';
  return (
    <section style={{ display: 'grid', gap: 4, alignContent: 'start', textAlign: right ? 'right' : 'left', fontSize: 12 }}>
      <strong className="display" style={{ fontSize: 16 }}>{TEAM_NAME[team]}</strong>
      <span style={{ minHeight: 16 }}>{day && showSoldiers ? <><strong style={{ fontSize: 15 }}>{day.soldiers[team]}</strong> soldiers</> : ''}</span>
      {mine.map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, flexDirection: right ? 'row-reverse' : 'row', padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
          <span className="muted">{day ? fmt.format(Math.round((day.steps[p.id] ?? 0) * ramp)) : '0'}</span>
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

  const walking = phase === 'walk' || phase === 'night' ? day : null;
  const soldiersShown = phase === 'night' || (phase === 'walk' && ramp >= 1);
  const doneNights = week.days.slice(0, nights);

  return (
    <main className="screen" style={{ maxWidth: 1500, margin: '0 auto', padding: '2vh 32px', minHeight: '100vh', display: 'grid', gridTemplateColumns: 'auto minmax(360px, 1fr)', gap: 40, alignItems: 'center' }}>
      {/* The phone: what a player sees on their screen. */}
      <div style={{ height: 'min(94vh, 880px)', aspectRatio: '390 / 844', borderRadius: 52, border: '10px solid #2a2a2e', boxShadow: '0 0 0 2px #555, 0 30px 80px rgba(0,0,0,0.7)', background: 'radial-gradient(120% 80% at 50% 0%, #1d1a18, #070606)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', padding: '50px 16px 16px', gap: 8 }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 110, height: 28, borderRadius: 16, background: '#000' }} aria-hidden />
        <header style={{ display: 'grid', gap: 2, textAlign: 'center' }}>
          <strong className="display" style={{ fontSize: 22 }}>INVADE</strong>
          <span className="display" style={{ fontSize: 12, letterSpacing: '0.05em' }}>{label}</span>
        </header>
        <ShareBar white={share} />
        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ width: '100%' }}>
            <Battlefield view={view} targets={targets} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TeamList team="white" players={players} day={walking} ramp={phase === 'night' ? 1 : ramp} showSoldiers={soldiersShown} />
          <TeamList team="black" players={players} day={walking} ramp={phase === 'night' ? 1 : ramp} showSoldiers={soldiersShown} />
        </div>
      </div>

      {/* Beside the phone: everything the room needs to follow. */}
      <aside style={{ display: 'grid', gap: 16, alignContent: 'center' }}>
      <section className="item" style={{ padding: '18px 24px', display: 'grid', gap: 8, border: '1px solid rgba(255,255,255,0.25)' }} aria-live="polite">
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
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

      <section style={{ display: 'grid', gap: 4 }} aria-label="The week so far">
        <span className="muted" style={{ fontSize: 14, letterSpacing: '0.08em' }}>THE WEEK SO FAR</span>
        {week.days.map((d) => {
          const done = doneNights.includes(d);
          const now = day?.day === d.day;
          return (
            <div key={d.day} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1.1fr 92px', gap: 10, alignItems: 'center', fontSize: 16, padding: '5px 10px', borderRadius: 8, background: now ? 'rgba(255,255,255,0.12)' : 'transparent', opacity: done || now ? 1 : 0.35 }}>
              <strong>{DAY_NAMES[d.day - 1]!.slice(0, 3)}</strong>
              <span>{d.zoneName}{d.extraZoneName ? ` + ${d.extraZoneName}` : ''}</span>
              <span style={{ color: d.decree.kind === 'rebellion' && (done || now) ? '#ff5a4a' : undefined }}>{done || now ? d.title : '?'}</span>
              <strong style={{ textAlign: 'right' }}>{done ? `${TEAM_NAME[d.winner]} ✓` : ''}</strong>
            </div>
          );
        })}
      </section>

      <section className="muted" style={{ fontSize: 15, lineHeight: 1.5 }} aria-label="How it works">
        <strong style={{ color: '#fff' }}>How it works</strong>
        <div>1 · 7 zones, 7 days: every day both teams fight for one zone.</div>
        <div>2 · Steps from Apple Health become soldiers (5k = 4, 10k = 8, 12k = 10).</div>
        <div>3 · Every morning the AI Director twists the day's rules.</div>
        <div>4 · Midnight: more soldiers takes the zone. Most land on Sunday wins the coins.</div>
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="pill" onClick={back} disabled={i === 0} style={{ fontSize: 18, opacity: i === 0 ? 0.4 : 1 }}>◀ Back</button>
        <button type="button" className="pill" onClick={next} disabled={i === STEPS.length - 1} style={{ fontSize: 22, minWidth: 220, background: '#fff', color: '#111' }}>
          {step.kind === 'intro' ? 'Start the week ▶' : step.kind === 'result' ? 'The end' : phase === 'morning' ? 'Walk ▶' : phase === 'walk' ? 'Midnight ▶' : step.day === 7 ? 'Results ▶' : 'Next morning ▶'}
        </button>
      </div>
      </aside>

      {/* Scan to play: the room joins the real game. */}
      <div style={{ position: 'fixed', right: 24, bottom: 24, display: 'grid', justifyItems: 'center', gap: 6, padding: '12px 14px', borderRadius: 16, background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.3)' }}>
        <JoinQr url={JOIN_URL} size={128} />
        <strong className="display" style={{ fontSize: 18, letterSpacing: '0.06em' }}>SCAN TO PLAY</strong>
        <span className="muted" style={{ fontSize: 12 }}>invade.vercel.app · code INVADE</span>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_MAP, type GameSettings, type TeamId } from '@invade/engine';
import { SeasonBar } from '../components/SeasonBar';
import { nightReveal, type NightReveal as Reveal } from '../data/night';
import { useGameByCode } from '../data/useGameByCode';
import { useGameDay } from '../data/useGameDay';
import { MapSvg } from '../map/MapSvg';
import { walkPhaseMapView, type MapView } from '../map/model';

const ACT_MS = 5000;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const SKY = 'radial-gradient(ellipse at 50% 0%, #1b2140 0%, #0b0d1a 55%, #050507 100%)';

function Card({ team, children }: { team?: TeamId; children: React.ReactNode }) {
  const white = team === 'white';
  const night = team === undefined;
  return (
    <div
      className="spotlight-in"
      style={{
        maxWidth: '82vw', padding: '28px 48px', borderRadius: 24, textAlign: 'center',
        background: night ? 'rgba(10, 12, 30, 0.85)' : white ? '#f4f2ec' : '#000',
        color: white ? '#111' : '#fff',
        border: `4px solid ${night ? '#2c3566' : white ? '#fff' : '#3a3a40'}`,
        boxShadow: `0 0 60px ${white ? 'rgba(255,255,255,0.45)' : 'rgba(40,60,160,0.35)'}`,
      }}
    >
      {children}
    </div>
  );
}

const Headline = ({ children }: { children: React.ReactNode }) => (
  <p className="display" style={{ margin: 0, fontSize: 'clamp(40px, 6vw, 88px)', lineHeight: 1.05, letterSpacing: '0.02em' }}>{children}</p>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: '12px 0 0', fontSize: 'clamp(18px, 2.4vw, 34px)', opacity: 0.8 }}>{children}</p>
);

/**
 * Decision 5, the night phase as a reveal: night falls, every battle of the day is shouted one by
 * one with its odds, then dawn shows the map and the new share. Tap, Enter or Space advances; it
 * also advances on its own every 5 s unless the viewer prefers reduced motion. Pure apart from the
 * clock: everything on screen comes from `reveal` and `view`.
 */
export function NightRevealView({ reveal, view, settings, code, onDone }: {
  reveal: Reveal;
  view: MapView;
  settings: Pick<GameSettings, 'teamNames' | 'timezone' | 'seasonStart'>;
  code: string;
  onDone?: () => void;
}) {
  // -1 = night falls, 0..n-1 = one battle each, n = dawn.
  const [step, setStep] = useState(-1);
  const last = reveal.acts.length;
  const next = useCallback(() => setStep((s) => Math.min(last, s + 1)), [last]);

  useEffect(() => {
    if (step >= last || reducedMotion()) return;
    const t = setTimeout(next, ACT_MS);
    return () => clearTimeout(t);
  }, [step, last, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next]);

  const names = settings.teamNames;
  const act = step >= 0 && step < last ? reveal.acts[step]! : null;

  return (
    <main
      onClick={step < last ? next : undefined}
      style={{ minHeight: '100dvh', background: SKY, display: 'grid', placeItems: 'center', padding: 24, cursor: step < last ? 'pointer' : 'default' }}
      aria-live="polite"
    >
      {step === -1 && (
        <Card>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 'clamp(14px, 1.6vw, 22px)', letterSpacing: '0.2em' }}>DAY {reveal.day}</p>
          <Headline>NIGHT FALLS</Headline>
          <Sub>
            {reveal.attacks === 0
              ? 'No attacks today. The map sleeps.'
              : `${reveal.attacks} ${reveal.attacks === 1 ? 'attack' : 'attacks'} today, ${reveal.captures} ${reveal.captures === 1 ? 'capture' : 'captures'}. Tap to reveal.`}
          </Sub>
        </Card>
      )}

      {act && (
        <Card key={act.id} team={act.team}>
          <p style={{ margin: '0 0 8px', fontSize: 'clamp(14px, 1.6vw, 22px)', letterSpacing: '0.2em', opacity: 0.7 }}>BATTLE {step + 1} OF {last}</p>
          <Headline>{act.headline}</Headline>
          <Sub>{act.sub}</Sub>
          <div role="img" aria-label={`${Math.round(act.odds * 100)} percent odds`} style={{ marginTop: 20, height: 10, borderRadius: 5, background: 'rgba(128,128,128,0.35)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(act.odds * 100)}%`, height: '100%', background: act.won ? '#5bd37a' : '#e0524f' }} />
          </div>
        </Card>
      )}

      {step === last && (
        <section className="spotlight-in" style={{ width: 'min(1100px, 100%)', display: 'grid', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <Headline>DAWN</Headline>
            <Sub>
              {names.white} {reveal.before.white}% → {reveal.after.white}% · {names.black} {reveal.before.black}% → {reveal.after.black}%
            </Sub>
          </div>
          <SeasonBar war={view.war} teamNames={names} timezone={settings.timezone} seasonStart={settings.seasonStart} big />
          <div className="fit-map"><MapSvg view={view} /></div>
          <button type="button" className="pill" style={{ justifySelf: 'center', minWidth: 260 }} onClick={onDone}>
            Back to the table
          </button>
          <p className="subtitle">/night?code={code}</p>
        </section>
      )}
    </main>
  );
}

/** `/night?code=INVADE`: tonight's reveal for the game with that code, on the big screen. */
export function NightReveal() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = (params.get('code') ?? 'INVADE').toUpperCase();
  const lookup = useGameByCode(code);
  const state = useGameDay(lookup.game?.id);
  const ready = !!lookup.game && state.status === 'ready' && !!state.teams && !!state.settings && !!state.day;

  const reveal = useMemo(() => (ready ? nightReveal({
    battles: state.battles ?? [], players: state.players ?? [], teams: state.teams!, settings: state.settings!, day: state.day!,
  }) : null), [ready, state.battles, state.players, state.teams, state.settings, state.day]);

  const error = lookup.error ?? (state.status === 'error' ? state.error : undefined);
  if (error) return <main className="screen"><p className="error">{error}</p></main>;
  if (!ready || !reveal) return <main className="screen" style={{ background: SKY }}><p className="subtitle">Night is falling…</p></main>;

  const view = walkPhaseMapView(DEFAULT_MAP, state.teams!, { battles: state.battles, today: state.day });
  return <NightRevealView reveal={reveal} view={view} settings={state.settings!} code={code} onDone={() => navigate(`/table?code=${code}`)} />;
}

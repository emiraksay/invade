import { useEffect, useState } from 'react';
import { secondsUntilDayEnd } from '@invade/engine';

const pad = (n: number) => String(n).padStart(2, '0');

/** "WALK PHASE - hh:mm:ss" until midnight in the game's timezone (Figma Base header). */
export function Countdown({ timezone, size = 20 }: { timezone: string; size?: number }) {
  const [left, setLeft] = useState(() => secondsUntilDayEnd(new Date(), timezone));
  useEffect(() => {
    const id = setInterval(() => setLeft(secondsUntilDayEnd(new Date(), timezone)), 1000);
    return () => clearInterval(id);
  }, [timezone]);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  return (
    <h1 style={{ margin: 0, textAlign: 'center', fontSize: size, fontWeight: 700, letterSpacing: '0.02em' }}>
      WALK PHASE - {pad(h)}:{pad(m)}:{pad(s)}
    </h1>
  );
}

/** The HQ crown: a smooth outlined crown (not solid, not pixel-art). Drawn in a 24 x 20 box. */
export const CROWN_W = 24;
export const CROWN_H = 20;
export const CROWN_PATH = 'M4 15.5 L2.5 5.5 L8 9.5 L12 3 L16 9.5 L21.5 5.5 L20 15.5 Z M4.5 18.5 H19.5';

/** Crown stroke colours: dark on White's light HQ, light on Black's dark one. */
export const CROWN_FILL = { white: '#1d1d20', black: '#f2f2f4' } as const;

/** Standalone crown icon (for HTML overlays such as the 3D map's labels). */
export function CrownIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={(size * CROWN_H) / CROWN_W} viewBox={`0 0 ${CROWN_W} ${CROWN_H}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={CROWN_PATH} fill="none" stroke={fill} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

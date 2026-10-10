/** The Figma's pixel-art crown (vector 347:1223, "Risk x Walk"), marking each team's HQ on the map. */
export const CROWN_PATH =
  'M27.0812 4.92385V7.38577H25.8502V8.61673H24.6192V13.5406H23.3883V17.2335H22.1573V19.6954H20.9263V22.1573H6.15481V19.6954H4.92385V17.2335H3.69288V13.5406H2.46192V8.61673H1.23096V7.38577H0V4.92385H1.23096V3.69288H3.69288V4.92385H4.92385V7.38577H3.69288V8.61673H4.92385V9.84769H6.15481V11.0787H8.61673V9.84769H9.84769V7.38577H11.0787V4.92385H12.3096V3.69288H11.0787V1.23096H12.3096V0H14.7715V1.23096H16.0025V3.69288H14.7715V4.92385H16.0025V7.38577H17.2335V9.84769H18.4644V11.0787H20.9263V9.84769H22.1573V8.61673H23.3883V7.38577H22.1573V4.92385H23.3883V3.69288H25.8502V4.92385H27.0812Z';
export const CROWN_W = 27.0812;
export const CROWN_H = 22.1573;

/** Crown colours as in the render: a grey crown, dark on White's light HQ and light on Black's dark one. */
export const CROWN_FILL = { white: '#3a3a3c', black: '#8d8d90' } as const;

/** Standalone crown icon (for HTML overlays such as the 3D map's labels). */
export function CrownIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={(size * CROWN_H) / CROWN_W} viewBox={`0 0 ${CROWN_W} ${CROWN_H}`} aria-hidden="true" style={{ display: 'block', shapeRendering: 'crispEdges', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))' }}>
      <path d={CROWN_PATH} fill={fill} />
    </svg>
  );
}

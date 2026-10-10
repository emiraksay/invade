import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { TeamId } from '@invade/engine';
import type { MapView, TerritoryView } from './model';
import { insetPolygon, SLAB_GAP } from './geometry';

/**
 * Live 3D battlefield (three.js via React Three Fiber), matching the Figma's dark render:
 * extruded territory pillars dropping into the dark, glowing white edges that brighten with the
 * team's charge, the HQ pillar rising with today's soldiers. Same input as MapSvg (MapView).
 * Loaded lazily by Battlefield, only when WebGL is available.
 */

const PILLAR_DEPTH = 110;      // how far tiles drop into the dark (map units)
const MAP_YAW = -0.14;         // radians: the Figma's map sits slightly diagonal
const HQ_LIFT_PER_SOLDIER = 0.25;
const HQ_LIFT_MAX = 12;

const COLOR: Record<TeamId, { dim: string; lit: string }> = {
  white: { dim: '#7d7b76', lit: '#eef1f6' },
  black: { dim: '#141110', lit: '#3b3532' },
};
const LABEL: Record<TeamId, string> = { white: '#121215', black: '#f2efe6' };

const RIPPLE_MS = 1100;          // how long one tile glows after soldiers arrive
const RIPPLE_STEP_MS = 140;      // delay per step from the HQ: the glow marches outward

function Pillar({ t, teamSoldiers, selected, onTap }: { t: TerritoryView; teamSoldiers: number; selected: boolean; onTap?: (t: TerritoryView) => void }) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  // Soldiers arrived (a milestone was crossed): schedule this tile's flash, staggered by its depth from the HQ.
  const prevSoldiers = useRef(teamSoldiers);
  const flashAt = useRef(-Infinity);
  useEffect(() => {
    if (teamSoldiers > prevSoldiers.current) {
      flashAt.current = performance.now() + t.depth * RIPPLE_STEP_MS;
      invalidate(); // frameloop is on demand: start rendering the ripple
    }
    prevSoldiers.current = teamSoldiers;
  }, [teamSoldiers, t.depth, invalidate]);
  const poly = useMemo(() => insetPolygon(t.polygon, t.center, SLAB_GAP), [t.polygon, t.center]);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: PILLAR_DEPTH, bevelEnabled: false });
    // Shape lies in XY with Y down (map units). Lay it on the ground: map y -> world z, extrude -> down.
    g.rotateX(Math.PI / 2);
    // Fade the pillar into the dark: vertex colour goes from white at the top face to black at the bottom.
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const depth = Math.min(1, Math.max(0, -pos.getY(i) / PILLAR_DEPTH)); // clamp: the top face sits at y ≈ +1e-16
      const v = 1 - Math.pow(depth, 0.38);
      colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [poly]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 15), [geometry]);
  useEffect(() => () => { edges.dispose(); geometry.dispose(); }, [edges, geometry]);

  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  useEffect(() => invalidate(), [lift, invalidate]); // start easing toward the new height
  const baseEmissive = selected ? 0.5 : 0.08 + 0.3 * t.charge;
  // On-demand frame loop: keep requesting frames only while something still moves (ease or ripple).
  useFrame(() => {
    let moving = false;
    const g = group.current;
    if (g) {
      const d = lift - g.position.y;
      if (Math.abs(d) < 0.01) g.position.y = lift;
      else { g.position.y += d * 0.1; moving = true; }
    }
    const m = material.current;
    if (m) {
      const age = performance.now() - flashAt.current;
      const k = age < 0 ? 0 : Math.max(0, 1 - age / RIPPLE_MS); // 1 at the flash, fading to 0
      m.emissiveIntensity = baseEmissive + k * k * 0.9;
      if (age < RIPPLE_MS) moving = true;
    }
    if (moving) invalidate();
  });

  const top = new THREE.Color(COLOR[t.owner].dim).lerp(new THREE.Color(COLOR[t.owner].lit), t.charge);
  const edgeOpacity = selected ? 1 : 0.45 + 0.55 * t.charge;
  const [cx, cy] = t.center;
  // Top outline in world space (map y -> world z), closed, lifted a hair above the face to avoid z-fighting.
  const outline = useMemo<[number, number, number][]>(
    () => [...poly, poly[0]!].map(([x, y]) => [x, 0.15, y]),
    [poly],
  );

  return (
    <group ref={group}>
      <mesh
        geometry={geometry}
        onClick={onTap ? (e) => { e.stopPropagation(); onTap(t); } : undefined}
        onPointerOver={onTap ? () => { document.body.style.cursor = 'pointer'; } : undefined}
        onPointerOut={onTap ? () => { document.body.style.cursor = ''; } : undefined}
      >
        <meshStandardMaterial
          ref={material}
          vertexColors
          color={top}
          roughness={t.owner === 'white' ? 0.35 : 0.8}
          metalness={0.05}
          emissive={selected ? '#7fb6ff' : t.owner === 'white' ? '#ffffff' : '#8a8580'}
          emissiveIntensity={baseEmissive}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={selected ? '#7fb6ff' : '#ffffff'} transparent opacity={edgeOpacity * 0.6} />
      </lineSegments>
      {/* Glowing rim: a wide faint pass under a crisp bright one (the Figma's white edge glow). */}
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={9} transparent opacity={0.03 + 0.12 * t.charge} depthWrite={false} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={5} transparent opacity={0.12 + 0.3 * t.charge} depthWrite={false} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={1.6} transparent opacity={edgeOpacity} depthWrite={false} />
      {t.isHq && (
        <Html position={[cx, 1.5, cy]} center distanceFactor={120} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: LABEL[t.owner], fontFamily: 'var(--font-body)', fontWeight: 700, lineHeight: 1, textShadow: t.owner === 'white' ? '0 0 6px #fff' : '0 0 6px #000' }}>
            <div style={{ fontSize: 30 }}>♛</div>
            {t.soldiers > 0 && <div style={{ fontSize: 28 }}>{t.soldiers}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Puts the camera where the Figma render has it: in front of White's side, looking across to Black. */
function CameraRig({ h }: { h: number }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    camera.position.set(0, h * 0.9, h * 1.3);
    camera.lookAt(0, -22, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, h, invalidate]);
  return null;
}

/** Fires `onReady` from inside the first rendered frame, so the parent can fade the SVG out only once pixels exist. */
function FirstFrame({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  // frameloop is on demand: ask for the first frame explicitly (twice, in case the canvas was not yet sized).
  useEffect(() => {
    invalidate();
    const id = setTimeout(invalidate, 150);
    return () => clearTimeout(id);
  }, [invalidate]);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onReady?.();
  });
  return null;
}

export interface Map3DProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** Called from the first rendered frame. */
  onReady?: () => void;
  /** Called when the WebGL context was lost and not restored within a few seconds (e.g. iOS after backgrounding). */
  onContextDead?: () => void;
}

export default function Map3D({ view, selected = null, onTap, onReady, onContextDead }: Map3DProps) {
  const { width: w, height: h } = view;
  return (
    <div style={{ width: '100%', aspectRatio: '1 / 1.22', margin: '-6% 0 -8%' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 38, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        flat
        frameloop="demand"
        onCreated={({ gl, scene, camera, invalidate }) => {
          gl.compile(scene, camera); // compile shaders now, not on the first visible frame
          const el = gl.domElement;
          let lostAt = 0;
          el.addEventListener('webglcontextlost', () => {
            lostAt = Date.now();
            setTimeout(() => { if (lostAt) onContextDead?.(); }, 2500);
          });
          el.addEventListener('webglcontextrestored', () => { lostAt = 0; invalidate(); });
        }}
        style={{ background: 'transparent' }}
      >
        {/* Camera sits ~1.5h from the origin; fade only the pillar bottoms and the far edge. */}
        <CameraRig h={h} />
        <FirstFrame onReady={onReady} />
        <fog attach="fog" args={['#110d0b', h * 1.6, h * 3]} />
        <hemisphereLight args={['#ffffff', '#1a1512', 0.5]} />
        <directionalLight position={[-40, 120, 80]} intensity={1.1} />
        <pointLight position={[0, -PILLAR_DEPTH * 0.6, 0]} intensity={2.5} distance={220} decay={1} color="#9ec7ff" />
        {/* Centre the map on the origin: x in [-w/2, w/2], z in [-h/2, h/2] (Black far, White near). */}
        <group rotation={[0, MAP_YAW, 0]}>
        <group position={[-w / 2, 0, -h / 2]}>
          {view.territories.map((t) => (
            <Pillar key={t.id} t={t} teamSoldiers={view.teams[t.owner].soldiers} selected={t.id === selected} onTap={onTap} />
          ))}
        </group>
        </group>
      </Canvas>
    </div>
  );
}

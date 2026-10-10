import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import type { Point, TeamId } from '@invade/engine';
import type { MapView, PieceView, TerritoryView } from './model';
import { insetPolygon, SLAB_GAP } from './geometry';
import { CROWN_FILL, CrownIcon } from './crown';
import { ATTACK_RED, attackMark, garrisonAt, piecePositions, GarrisonBadge, PieceToken, playerColors, type AttackMark } from './pieces';

/**
 * Live 3D battlefield (three.js via React Three Fiber), matching the Figma's dark render:
 * extruded territory pillars dropping into the dark, glowing white edges that brighten with the
 * team's charge, the HQ pillar rising with today's soldiers. Same input as MapSvg (MapView).
 * Loaded lazily by Battlefield, only when WebGL is available.
 */

const SLAB = 5;                // thickness of each territory slab (map units)
const REFLECTION_DEPTH = 80;   // how far the island's glowing reflection reaches down (map units)
const REFLECTION_ROWS = 16;    // vertex rows down each column, so the fade is smooth
const LIGHT_XZ = [-0.35, 0.94] as const; // columns facing this way (towards the viewer, a bit left) glow most
const STEP_MAX = 2.4;          // slabs sit at slightly different heights, like the Figma's broken ground
const MAP_YAW = -0.14;         // radians: the Figma's map sits slightly diagonal
const HQ_LIFT_PER_SOLDIER = 0.25;
const HQ_LIFT_MAX = 12;

// Figma render: White's slabs are near-white, Black's near-black; both carry a bright white rim.
const COLOR: Record<TeamId, { dim: string; lit: string }> = {
  white: { dim: '#cfd2d8', lit: '#ffffff' },
  black: { dim: '#0c0a09', lit: '#262220' },
};
// The slab sides are a cool blue-grey in the render, for both teams.
const SIDE_COLOR: Record<TeamId, string> = { white: '#b9c6d8', black: '#8f9cb0' };

/**
 * A slab's reflection in the water (Figma): every coastal face of the slab continues straight down as a
 * glowing column that fades smoothly to dark. One column set per slab, so the gaps between slabs keep
 * the reflections separated; faces turned to the light glow more. Only outward faces are built, so
 * columns never stack into stripes.
 */
function reflectionGeometry(poly: readonly Point[], center: Point, coastEdges: readonly number[], top: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (const e of coastEdges) {
    const a = poly[e]!, b = poly[(e + 1) % poly.length]!;
    // Outward normal of the edge (in the map's xz plane), pointing away from the tile's centre.
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    const mx = (a[0] + b[0]) / 2 - center[0], mz = (a[1] + b[1]) / 2 - center[1];
    const flip = nx * mx + nz * mz < 0;
    if (flip) { nx = -nx; nz = -nz; }
    const facing = Math.max(0, nx * LIGHT_XZ[0] + nz * LIGHT_XZ[1]);
    const glow = 0.1 + 0.34 * facing * facing;
    const base = positions.length / 3;
    for (let r = 0; r <= REFLECTION_ROWS; r++) {
      const k = r / REFLECTION_ROWS;
      const y = top - k * REFLECTION_DEPTH;
      const v = glow * Math.pow(1 - k, 1.6);
      for (const [x, z] of [a, b]) {
        positions.push(x, y, z);
        colors.push(v * 0.88, v * 0.94, v);
      }
    }
    for (let r = 0; r < REFLECTION_ROWS; r++) {
      const i0 = base + r * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
      // Wind so the front face looks outward (the inner side is culled: no stacking behind the island).
      if (flip) index.push(i0, i2, i1, i1, i2, i3);
      else index.push(i0, i1, i2, i1, i3, i2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}

/** Fixed per-territory height step (0..STEP_MAX), so the same tile always sits at the same height. */
function stepOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 * STEP_MAX;
}

const BREATH_S = 3.2;            // one slow breath of the held territories' glow
const BREATH_FPS = 20;           // the breath redraws at a low rate: cheap on phones
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const RIPPLE_MS = 1100;          // how long one tile glows after soldiers arrive
const RIPPLE_STEP_MS = 140;      // delay per step from the HQ: the glow marches outward
const FLIP_MS = 1200;            // how long a conquered tile flashes

function Pillar({ t, teamSoldiers, selected, onTap, coastEdges, mark }: { t: TerritoryView; teamSoldiers: number; selected: boolean; onTap?: (t: TerritoryView) => void; coastEdges: readonly number[]; mark?: AttackMark }) {
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
  // The territory changed hands (a battle was won): flash it now, brighter than a ripple.
  const prevOwner = useRef(t.owner);
  const flipAt = useRef(-Infinity);
  useEffect(() => {
    if (t.owner !== prevOwner.current) { flipAt.current = performance.now(); invalidate(); }
    prevOwner.current = t.owner;
  }, [t.owner, invalidate]);
  useEffect(() => invalidate(), [mark, invalidate]);
  const poly = useMemo(() => insetPolygon(t.polygon, t.center, SLAB_GAP), [t.polygon, t.center]);
  // Shape lies in XY with Y down (map units). Laid on the ground: map y -> world z, extrude -> down.
  const shape = useMemo(() => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))), [poly]);
  const step = useMemo(() => stepOf(t.id), [t.id]);
  // The slab: a thick tile with a small chamfer, so its top edge catches the light like the render.
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.35, bevelSegments: 1 });
    g.rotateX(Math.PI / 2);
    g.translate(0, step + 0.5, 0);
    return g;
  }, [shape, step]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const reflection = useMemo(
    () => reflectionGeometry(poly, t.center, coastEdges, step - SLAB + 0.5),
    [poly, t.center, coastEdges, step],
  );
  useEffect(() => () => reflection.dispose(), [reflection]);
  const reflectionMat = useRef<THREE.MeshBasicMaterial>(null);

  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  useEffect(() => invalidate(), [lift, invalidate]); // start easing toward the new height
  const baseEmissive = mark === 'target' ? 0.55 : mark === 'dim' ? 0.02 : selected ? 0.5 : 0.08 + 0.3 * t.charge;
  const dim = mark === 'dim' ? 0.35 : 1;
  // On-demand frame loop: keep requesting frames only while something still moves (ease or ripple).
  const rim = useRef<Line2>(null);
  useFrame(({ clock }) => {
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
      const flipAge = performance.now() - flipAt.current;
      const f = Math.max(0, 1 - flipAge / FLIP_MS);
      // Held land breathes: a slow glow that rolls out from the HQ, stronger where the team is charged.
      const breath = reducedMotion ? 0 : 0.5 + 0.5 * Math.sin((clock.elapsedTime / BREATH_S) * Math.PI * 2 - t.depth * 0.7);
      // A target pulses red faster, so the choice reads at a glance.
      const pulse = mark === 'target' && !reducedMotion ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI * 2 * 0.9) : 0;
      m.emissiveIntensity = baseEmissive + k * k * 0.9 + f * f * 2.2 + pulse * 0.5 + dim * breath * (0.15 + 0.4 * t.charge);
      if (rim.current) rim.current.material.opacity = mark === 'target' ? 0.5 + 0.5 * pulse : dim * (0.1 + 0.25 * t.charge + breath * (0.2 + 0.45 * t.charge));
      // The reflection breathes with its slab.
      if (reflectionMat.current) reflectionMat.current.opacity = 0.8 + 0.2 * breath * (0.4 + t.charge);
      if (age < RIPPLE_MS || flipAge < FLIP_MS) moving = true;
    }
    if (moving) invalidate();
  });

  const top = new THREE.Color(COLOR[t.owner].dim).lerp(new THREE.Color(COLOR[t.owner].lit), t.charge).multiplyScalar(dim);
  const edgeOpacity = mark === 'target' || selected ? 1 : dim * (0.75 + 0.25 * t.charge);
  const edgeColor = mark === 'target' ? ATTACK_RED : selected ? '#7fb6ff' : '#ffffff';
  const [cx, cy] = t.center;
  // Top outline in world space (map y -> world z), closed, lifted a hair above the face to avoid z-fighting.
  const outline = useMemo<[number, number, number][]>(
    () => [...poly, poly[0]!].map(([x, y]) => [x, step + 1.05, y]),
    [poly, step],
  );

  return (
    <group ref={group}>
      <mesh
        geometry={geometry}
        onClick={onTap ? (e) => { e.stopPropagation(); onTap(t); } : undefined}
        onPointerOver={onTap ? () => { document.body.style.cursor = 'pointer'; } : undefined}
        onPointerOut={onTap ? () => { document.body.style.cursor = ''; } : undefined}
      >
        {/* ExtrudeGeometry groups: 0 = top/bottom faces, 1 = sides. The glow sits on the top face only,
            so the sides keep their vertex-colour fade into the dark (emissive would light them evenly). */}
        <meshStandardMaterial
          attach="material-0"
          ref={material}
          color={top}
          roughness={t.owner === 'white' ? 0.35 : 0.8}
          metalness={0.05}
          emissive={mark === 'target' ? ATTACK_RED : selected ? '#7fb6ff' : t.owner === 'white' ? '#ffffff' : '#8a8580'}
          emissiveIntensity={baseEmissive}
        />
        <meshStandardMaterial attach="material-1" color={new THREE.Color(SIDE_COLOR[t.owner]).multiplyScalar(dim)} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Thin bright rim where the top face meets the side, plus a faint glow as the team charges. */}
      {coastEdges.length > 0 && (
        <mesh geometry={reflection} raycast={() => null} renderOrder={1}>
          <meshBasicMaterial ref={reflectionMat} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <Line ref={rim} points={outline} color={edgeColor} lineWidth={4} transparent opacity={0.1 + 0.25 * t.charge} depthWrite={false} />
      <Line points={outline} color={edgeColor} lineWidth={1.4} transparent opacity={edgeOpacity} depthWrite={false} />
      {t.isHq && (
        <Html position={[cx, step + 2.5, cy]} center distanceFactor={120} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          {/* Figma: the HQ shows just the crown, no number. */}
          <CrownIcon size={34} fill={CROWN_FILL[t.owner]} />
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

/** Keeps the on-demand frame loop ticking at a low rate so held land can breathe (off with reduced motion). */
function Breathing() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => invalidate(), 1000 / BREATH_FPS);
    return () => clearInterval(id);
  }, [invalidate]);
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
  /** Bloom post-processing for the Figma's glow. Costs GPU: on for the projector, off on phones by default. */
  bloom?: boolean;
  /** Territories I can attack right now (highlighted; the rest dims). Null when not choosing. */
  targets?: ReadonlySet<string> | null;
  /** Tap on my own piece (starts choosing an attack). */
  onPieceTap?: (p: PieceView) => void;
}

const NO_EDGES: readonly number[] = [];

/** Height of a territory's top face (its fixed step, plus the HQ's lift), for things placed on it. */
const topOf = (t: TerritoryView) => stepOf(t.id) + (t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0);
const vkey = ([x, y]: Point) => `${x.toFixed(4)},${y.toFixed(4)}`;

/** For each territory, the indices of its polygon edges on the coast (shared with no other territory). */
function coastEdgesOf(view: MapView): Map<string, number[]> {
  const owners = new Map<string, Set<string>>();
  for (const t of view.territories) for (const p of t.polygon) {
    const k = vkey(p);
    if (!owners.has(k)) owners.set(k, new Set());
    owners.get(k)!.add(t.id);
  }
  const out = new Map<string, number[]>();
  for (const t of view.territories) {
    const edges: number[] = [];
    t.polygon.forEach((a, i) => {
      const b = t.polygon[(i + 1) % t.polygon.length]!;
      const shared = [...owners.get(vkey(a))!].some((id) => id !== t.id && owners.get(vkey(b))!.has(id));
      if (!shared) edges.push(i);
    });
    out.set(t.id, edges);
  }
  return out;
}

export default function Map3D({ view, selected = null, onTap, onReady, onContextDead, bloom = false, targets = null, onPieceTap }: Map3DProps) {
  const { width: w, height: h } = view;
  const coast = useMemo(() => coastEdgesOf(view), [view]);
  const byId = useMemo(() => new Map(view.territories.map((t) => [t.id, t])), [view]);
  const colors = useMemo(() => playerColors(view.pieces), [view]);
  const occupied = useMemo(() => new Set(view.pieces.map((p) => p.territoryId)), [view]);
  const spots = useMemo(() => piecePositions(view), [view]);
  const myTerritory = view.pieces.find((p) => p.isMe)?.territoryId;
  return (
    <div
      style={{
        width: '100%', aspectRatio: '1 / 1.22', margin: '-6% 0 -8%',
        // The pillars run off the bottom of the canvas: fade them out instead of a hard cut.
        maskImage: 'linear-gradient(to bottom, #000 72%, transparent 98%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 72%, transparent 98%)',
      }}
    >
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
        <Breathing />
        <fog attach="fog" args={['#110d0b', h * 1.6, h * 3]} />
        <hemisphereLight args={['#ffffff', '#1a1512', 1.1]} />
        <directionalLight position={[-40, 120, 80]} intensity={1.1} />
        {/* Centre the map on the origin: x in [-w/2, w/2], z in [-h/2, h/2] (Black far, White near). */}
        <group rotation={[0, MAP_YAW, 0]}>
        <group position={[-w / 2, 0, -h / 2]}>
          {view.territories.map((t) => (
            <Pillar key={t.id} t={t} teamSoldiers={view.teams[t.owner].soldiers} selected={t.id === selected} onTap={onTap} coastEdges={coast.get(t.id) ?? NO_EDGES} mark={attackMark(t.id, targets, myTerritory)} />
          ))}
          {/* Garrison numbers and player pieces float just above the tile tops and always face the camera. */}
          {/* Figma: the HQ shows only its crown, no number next to it. */}
          {view.territories.filter((t) => !t.isHq).map((t) => {
            const [gx, gz] = garrisonAt(t.center, occupied.has(t.id));
            return (
            <Html key={`g-${t.id}`} position={[gx, topOf(t) + 1.5, gz]} center distanceFactor={120} zIndexRange={[20, 11]} style={{ pointerEvents: 'none' }}>
              <GarrisonBadge soldiers={t.soldiers} />
            </Html>
            );
          })}
          {view.pieces.map((p) => {
            const t = byId.get(p.territoryId);
            return (
              <Html key={`p-${p.playerId}`} position={[spots.get(p.playerId)![0], (t ? topOf(t) : 0) + 3, spots.get(p.playerId)![1]]} center distanceFactor={120} zIndexRange={[40, 21]} style={{ pointerEvents: p.isMe && onPieceTap ? 'auto' : 'none' }}>
                <PieceToken piece={p} color={colors.get(p.playerId)!} onTap={p.isMe ? onPieceTap : undefined} />
              </Html>
            );
          })}
        </group>
        </group>
        {bloom && (
          <EffectComposer multisampling={0}>
            <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.2} intensity={0.75} mipmapBlur radius={0.55} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

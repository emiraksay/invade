import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
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

const PILLAR_DEPTH = 110;      // how far the light curtain under the island drops into the dark (map units)
const SLAB = 5;                // thickness of each territory slab (map units)
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

/** Fixed per-territory height step (0..STEP_MAX), so the same tile always sits at the same height. */
function stepOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 * STEP_MAX;
}
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
  // Under the slab: its reflection in the water, a streak of light fading downward (the Figma's glowing streaks).
  const curtain = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: PILLAR_DEPTH, steps: 16, bevelEnabled: false } /* rows of vertices so the fade has a curve */);
    g.rotateX(Math.PI / 2);
    g.translate(0, step - SLAB, 0);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const depth = Math.min(1, Math.max(0, -(pos.getY(i) - step + SLAB) / PILLAR_DEPTH));
      // Streaks: brightness ripples along the coast, like light broken up by the water.
      const x = pos.getX(i), z = pos.getZ(i);
      const streak = 0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(x * 1.7 + z * 1.3) * Math.sin(x * 0.53 - z * 0.71 + 1.2), 3);
      const v = 0.5 * streak * Math.pow(1 - depth, 2.6);
      colors[i * 3] = v * 0.92; colors[i * 3 + 1] = v * 0.96; colors[i * 3 + 2] = v; // a touch of cold blue
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [shape, step]);
  useEffect(() => () => curtain.dispose(), [curtain]);
  useEffect(() => () => geometry.dispose(), [geometry]);

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
  const edgeOpacity = selected ? 1 : 0.75 + 0.25 * t.charge;
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
          emissive={selected ? '#7fb6ff' : t.owner === 'white' ? '#ffffff' : '#8a8580'}
          emissiveIntensity={baseEmissive}
        />
        <meshStandardMaterial attach="material-1" color={SIDE_COLOR[t.owner]} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* The island's reflection in the water: only the curtain's sides (group 1) are drawn, its caps stay hidden. */}
      <mesh geometry={curtain} raycast={() => null} renderOrder={1}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial attach="material-1" vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Thin bright rim where the top face meets the side, plus a faint glow as the team charges. */}
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={4} transparent opacity={0.1 + 0.25 * t.charge} depthWrite={false} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={1.4} transparent opacity={edgeOpacity} depthWrite={false} />
      {t.isHq && (
        <Html position={[cx, step + 2.5, cy]} center distanceFactor={120} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: LABEL[t.owner], fontFamily: 'var(--font-body)', fontWeight: 700, lineHeight: 1, textShadow: t.owner === 'white' ? '0 0 6px #fff' : '0 0 6px #000' }}>
            <div style={{ fontSize: 30 }}>♛</div>
            {t.soldiers > 0 && <div style={{ fontSize: 28 }}>{t.soldiers}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Soft radial glow texture (white centre fading out), drawn once. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * The island sits on dark water (Figma render): a soft shadow on the water around the coast, and the
 * island's reflection (the slabs' light curtains) seen through the water, plus a cold glow deeper down.
 * Draw order: reflection (1) -> water (2) -> shadow (3), all transparent so the slabs stay on top.
 */
function Water({ w, h, charge }: { w: number; h: number; charge: number }) {
  const texture = useMemo(glowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const level = -SLAB - 0.2;
  return (
    <>
      <mesh position={[0, -PILLAR_DEPTH * 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[w * 1.2, h * 1.2]} />
        <meshBasicMaterial map={texture} color="#bcd6ff" transparent opacity={0.22 + 0.15 * charge} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[w * 2.4, h * 2]} />
        <meshBasicMaterial map={texture} color="#0e0b0a" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, level + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[w * 1.45, h * 1.3]} />
        <meshBasicMaterial map={texture} color="#000000" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
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
  /** Bloom post-processing for the Figma's glow. Costs GPU: on for the projector, off on phones by default. */
  bloom?: boolean;
}

export default function Map3D({ view, selected = null, onTap, onReady, onContextDead, bloom = false }: Map3DProps) {
  const { width: w, height: h } = view;
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
        <fog attach="fog" args={['#110d0b', h * 1.6, h * 3]} />
        <hemisphereLight args={['#ffffff', '#1a1512', 1.1]} />
        <directionalLight position={[-40, 120, 80]} intensity={1.1} />
        <pointLight position={[0, -PILLAR_DEPTH * 0.6, 0]} intensity={2.5} distance={220} decay={1} color="#9ec7ff" />
        {/* Centre the map on the origin: x in [-w/2, w/2], z in [-h/2, h/2] (Black far, White near). */}
        <group rotation={[0, MAP_YAW, 0]}>
        <Water w={w} h={h} charge={(view.teams.white.charge + view.teams.black.charge) / 2} />
        <group position={[-w / 2, 0, -h / 2]}>
          {view.territories.map((t) => (
            <Pillar key={t.id} t={t} teamSoldiers={view.teams[t.owner].soldiers} selected={t.id === selected} onTap={onTap} />
          ))}
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

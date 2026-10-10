import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import type { TeamId } from '@invade/engine';
import type { MapView, TerritoryView } from './model';
import { insetPolygon, SLAB_GAP } from './geometry';
import { islandOutline } from './island';
import { CROWN_FILL, CrownIcon } from './crown';

/**
 * Live 3D battlefield (three.js via React Three Fiber), matching the Figma's dark render:
 * extruded territory pillars dropping into the dark, glowing white edges that brighten with the
 * team's charge, the HQ pillar rising with today's soldiers. Same input as MapSvg (MapView).
 * Loaded lazily by Battlefield, only when WebGL is available.
 */

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

const BREATH_S = 3.2;            // one slow breath of the held territories' glow
const BREATH_FPS = 20;           // the breath redraws at a low rate: cheap on phones
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const RIPPLE_MS = 1100;          // how long one tile glows after soldiers arrive
const RIPPLE_STEP_MS = 140;      // delay per step from the HQ: the glow marches outward

/** `mirror`: drawn as the island's reflection under the water (no crown, not tappable). */
function Pillar({ t, teamSoldiers, selected, onTap, mirror = false }: { t: TerritoryView; teamSoldiers: number; selected: boolean; onTap?: (t: TerritoryView) => void; mirror?: boolean }) {
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
  useEffect(() => () => geometry.dispose(), [geometry]);

  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  useEffect(() => invalidate(), [lift, invalidate]); // start easing toward the new height
  const baseEmissive = selected ? 0.5 : 0.08 + 0.3 * t.charge;
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
      // Held land breathes: a slow glow that rolls out from the HQ, stronger where the team is charged.
      const breath = reducedMotion ? 0 : 0.5 + 0.5 * Math.sin((clock.elapsedTime / BREATH_S) * Math.PI * 2 - t.depth * 0.7);
      m.emissiveIntensity = baseEmissive + k * k * 0.9 + breath * (0.06 + 0.22 * t.charge);
      if (rim.current) rim.current.material.opacity = 0.08 + 0.25 * t.charge + breath * (0.1 + 0.3 * t.charge);
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
        raycast={mirror ? () => null : undefined}
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
      {/* Thin bright rim where the top face meets the side, plus a faint glow as the team charges. */}
      <Line ref={rim} points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={4} transparent opacity={0.1 + 0.25 * t.charge} depthWrite={false} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={1.4} transparent opacity={edgeOpacity} depthWrite={false} />
      {t.isHq && !mirror && (
        <Html position={[cx, step + 2.5, cy]} center distanceFactor={120} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          {/* Figma: the HQ shows just the crown, no number. */}
          <CrownIcon size={34} fill={CROWN_FILL[t.owner]} />
        </Html>
      )}
    </group>
  );
}

const WATER = -SLAB + 1; // water level: the slabs' lower part sits in it

/** Dark water, opaque near the island and fading out, so the page background shows at the edges. */
function waterTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * The island sits on still, dark water: the water dims the mirrored island under it into a soft
 * reflection, and a thin soft shadow hugs the coast. The shadow is a faked blur: a few copies of the
 * coastline, each a little wider and fainter.
 */
function Water({ w, h }: { w: number; h: number }) {
  const texture = useMemo(waterTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const shadow = useMemo(() => {
    const coast = islandOutline(w, h);
    return [0.3, 0.9, 1.6, 2.4].map((grow, i) => {
      const pts = coast.map(([x, y]) => {
        const dx = x - w / 2, dy = y - h / 2, d = Math.hypot(dx, dy) || 1;
        return new THREE.Vector2(x + (dx / d) * grow, y + (dy / d) * grow);
      });
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
      g.rotateX(Math.PI / 2);
      return { g, opacity: 0.22 - i * 0.045 };
    });
  }, [w, h]);
  useEffect(() => () => shadow.forEach((l) => l.g.dispose()), [shadow]);
  return (
    <>
      <mesh position={[0, WATER, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[w * 1.7, h * 1.45]} />
        <meshBasicMaterial map={texture} color="#0f0c0b" transparent opacity={0.78} depthWrite={false} toneMapped={false} />
      </mesh>
      <group position={[-w / 2, WATER + 0.05, -h / 2]}>
        {shadow.map((l, i) => (
          <mesh key={i} geometry={l.g} renderOrder={2}>
            <meshBasicMaterial color="#000000" transparent opacity={l.opacity} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
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
        <Breathing />
        <fog attach="fog" args={['#110d0b', h * 1.6, h * 3]} />
        <hemisphereLight args={['#ffffff', '#1a1512', 1.1]} />
        <directionalLight position={[-40, 120, 80]} intensity={1.1} />
        {/* Centre the map on the origin: x in [-w/2, w/2], z in [-h/2, h/2] (Black far, White near). */}
        <group rotation={[0, MAP_YAW, 0]}>
        {/* The island's reflection: the same slabs mirrored in the water plane (y -> 2*WATER - y). */}
        <group position={[0, 2 * WATER, 0]} scale={[1, -1, 1]}>
          <group position={[-w / 2, 0, -h / 2]}>
            {view.territories.map((t) => (
              <Pillar key={t.id} t={t} teamSoldiers={view.teams[t.owner].soldiers} selected={false} mirror />
            ))}
          </group>
        </group>
        <Water w={w} h={h} />
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

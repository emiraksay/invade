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

function Pillar({ t, selected, onTap }: { t: TerritoryView; selected: boolean; onTap?: (t: TerritoryView) => void }) {
  const group = useRef<THREE.Group>(null);
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

  const lift = t.isHq ? Math.min(HQ_LIFT_MAX, t.soldiers * HQ_LIFT_PER_SOLDIER) : 0;
  useFrame(() => {
    const g = group.current;
    if (g) g.position.y += (lift - g.position.y) * 0.1; // ease toward the target height
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
          vertexColors
          color={top}
          roughness={t.owner === 'white' ? 0.35 : 0.8}
          metalness={0.05}
          emissive={selected ? '#7fb6ff' : t.owner === 'white' ? '#ffffff' : '#8a8580'}
          emissiveIntensity={selected ? 0.5 : 0.08 + 0.3 * t.charge}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={selected ? '#7fb6ff' : '#ffffff'} transparent opacity={edgeOpacity * 0.6} />
      </lineSegments>
      {/* Glowing rim: a wide faint pass under a crisp bright one (the Figma's white edge glow). */}
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={9} transparent opacity={0.03 + 0.12 * t.charge} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={5} transparent opacity={0.12 + 0.3 * t.charge} />
      <Line points={outline} color={selected ? '#7fb6ff' : '#ffffff'} lineWidth={1.6} transparent opacity={edgeOpacity} />
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
  useEffect(() => {
    camera.position.set(0, h * 0.9, h * 1.3);
    camera.lookAt(0, -22, 0);
    camera.updateProjectionMatrix();
  }, [camera, h]);
  return null;
}

export interface Map3DProps {
  view: MapView;
  selected?: string | null;
  onTap?: (t: TerritoryView) => void;
  /** Called once the WebGL context exists and the first frame can paint. */
  onReady?: () => void;
}

export default function Map3D({ view, selected = null, onTap, onReady }: Map3DProps) {
  const { width: w, height: h } = view;
  return (
    <div style={{ width: '100%', aspectRatio: '1 / 1.22', margin: '-6% 0 -8%' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 38, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={() => onReady?.()}
        style={{ background: 'transparent' }}
      >
        {/* Camera sits ~1.5h from the origin; fade only the pillar bottoms and the far edge. */}
        <CameraRig h={h} />
        <fog attach="fog" args={['#110d0b', h * 1.6, h * 3]} />
        <hemisphereLight args={['#ffffff', '#1a1512', 0.5]} />
        <directionalLight position={[-40, 120, 80]} intensity={1.4} />
        <pointLight position={[0, -PILLAR_DEPTH * 0.6, 0]} intensity={2.5} distance={220} decay={1} color="#9ec7ff" />
        {/* Centre the map on the origin: x in [-w/2, w/2], z in [-h/2, h/2] (Black far, White near). */}
        <group rotation={[0, MAP_YAW, 0]}>
        <group position={[-w / 2, 0, -h / 2]}>
          {view.territories.map((t) => (
            <Pillar key={t.id} t={t} selected={t.id === selected} onTap={onTap} />
          ))}
        </group>
        </group>
      </Canvas>
    </div>
  );
}

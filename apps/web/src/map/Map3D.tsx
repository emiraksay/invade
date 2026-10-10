// The battlefield, live, in the Figma's dark render style (docs/design, Figma Map "image 5").
// Geometry comes only from the engine's map (generateMap) so every device draws the same territories.
import { useFrame } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DEFAULT_MAP, type MapDef, type TeamId, type Territory } from '@invade/engine';

/** How full each team's army is today, 0..1 (soldiers / maxSoldiers). Drives tile height and glow. */
export type TeamFill = Record<TeamId, number>;

export interface Map3DProps {
  fill: TeamFill;
  /** The viewer's team glows a little brighter. */
  myTeam?: TeamId;
  map?: MapDef;
}

const SCALE = 0.1; // map units -> world units (100 x 160 map becomes 10 x 16)
const GAP = 0.96; // shrink tiles toward their centre so the cracks between them show
const BASE_HEIGHT = 0.5;
const MAX_EXTRA_HEIGHT = 1.4; // a full army raises a team's tiles by this much

const COLORS = {
  white: { top: '#e9e9e9', side: '#cfd3d8' },
  black: { top: '#1d1a19', side: '#3a3a40' },
  edge: '#ffffff',
};

function tileShape(t: Territory, cx: number, cy: number): THREE.Shape {
  const pts = t.polygon.map(([x, y]) => {
    // Shrink toward the territory centre, centre the map at the origin, flip y so north is far away.
    const sx = t.center[0] + (x - t.center[0]) * GAP;
    const sy = t.center[1] + (y - t.center[1]) * GAP;
    return new THREE.Vector2((sx - cx) * SCALE, -(sy - cy) * SCALE);
  });
  return new THREE.Shape(pts);
}

function Tile({ territory, fill, glow, cx, cy }: {
  territory: Territory; fill: number; glow: number; cx: number; cy: number;
}) {
  const group = useRef<THREE.Group>(null);
  const edgeMat = useRef<THREE.LineBasicMaterial>(null);

  // Geometry is built once per territory (memoised); only the scale and the glow animate.
  const { geometry, edges } = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(tileShape(territory, cx, cy), { depth: 1, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // extrude upwards (+Y)
    return { geometry: g, edges: new THREE.EdgesGeometry(g, 20) };
  }, [territory, cx, cy]);

  const colors = COLORS[territory.team];
  const target = BASE_HEIGHT + MAX_EXTRA_HEIGHT * fill;

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Ease toward the target height so new soldiers visibly "rise" the land.
    g.scale.y += (target - g.scale.y) * Math.min(1, dt * 3);
    if (edgeMat.current) edgeMat.current.opacity = 0.55 + 0.45 * glow;
  });

  return (
    <group ref={group} scale={[1, BASE_HEIGHT, 1]}>
      <mesh geometry={geometry}>
        {/* ExtrudeGeometry groups: 0 = caps (top/bottom), 1 = sides */}
        <meshStandardMaterial attach="material-0" color={colors.top} roughness={0.55} metalness={0.05} />
        <meshPhysicalMaterial
          attach="material-1"
          color={colors.side}
          roughness={0.25}
          metalness={0.1}
          iridescence={1}
          iridescenceIOR={1.3}
          emissive={territory.team === 'white' ? '#ffffff' : '#9aa0ff'}
          emissiveIntensity={0.08 + 0.35 * glow}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial ref={edgeMat} color={COLORS.edge} transparent toneMapped={false} />
      </lineSegments>
    </group>
  );
}

function Crown({ territory, cx, cy, fill }: { territory: Territory; cx: number; cy: number; fill: number }) {
  const x = (territory.center[0] - cx) * SCALE;
  const z = (territory.center[1] - cy) * SCALE;
  const y = BASE_HEIGHT + MAX_EXTRA_HEIGHT * fill + 0.4;
  return (
    <Html position={[x, y, z]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
      <span aria-label={`${territory.team} headquarters`} style={{ fontSize: 22, filter: 'drop-shadow(0 2px 2px #000)' }}>👑</span>
    </Html>
  );
}

function Battlefield({ fill, myTeam, map }: Required<Pick<Map3DProps, 'fill' | 'map'>> & { myTeam?: TeamId }) {
  const cx = map.width / 2;
  const cy = map.height / 2;
  return (
    <group rotation={[0, -0.35, 0]}>
      {map.territories.map((t) => (
        <Tile
          key={t.id}
          territory={t}
          cx={cx}
          cy={cy}
          fill={fill[t.team]}
          glow={t.team === myTeam ? 0.5 + 0.5 * fill[t.team] : 0.3 * fill[t.team]}
        />
      ))}
      {map.territories.filter((t) => t.isHq).map((t) => (
        <Crown key={t.id} territory={t} cx={cx} cy={cy} fill={fill[t.team]} />
      ))}
    </group>
  );
}

export default function Map3D({ fill, myTeam, map = DEFAULT_MAP }: Map3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 19, 15], fov: 40, near: 0.1, far: 100 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0.6)}
      gl={{ antialias: true, alpha: true }}
      // The post-processing pass makes the canvas opaque; a radial mask fades its edges into the page.
      style={{ width: '100%', height: '100%', WebkitMaskImage: 'radial-gradient(ellipse 70% 62% at 50% 50%, #000 60%, transparent 100%)', maskImage: 'radial-gradient(ellipse 70% 62% at 50% 50%, #000 60%, transparent 100%)' }}
      aria-label="Battlefield map"
      role="img"
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 8]} intensity={1.4} />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} color="#9aa0ff" />
      <Battlefield fill={fill} myTeam={myTeam} map={map} />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

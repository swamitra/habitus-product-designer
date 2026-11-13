import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import type { HandleDesign } from '../lib/design'
import { createHandleGroup } from '../lib/geometry'

export function HandleModel({ design, autoRotate, showGrid }: { design: HandleDesign; autoRotate: boolean; showGrid: boolean }) {
  const distance = design.productType === 'door' ? 3.4 : Math.max(0.65, design.length / 420)
  return (
    <Canvas shadows camera={{ position: [0.25, 0.38, distance], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#e7e8e4']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 4, 3]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} />
      <Suspense fallback={null}>
        <primitive object={useMemo(() => createHandleGroup(design), [design])} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={4} position={[0, 3, 2]} scale={[5, 2, 1]} />
          <Lightformer form="rect" intensity={2} position={[-3, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={[4, 2, 1]} />
        </Environment>
        <ContactShadows position={[0, design.productType === 'door' ? -1.08 : -0.12, 0]} opacity={0.28} scale={design.productType === 'door' ? 4 : 2} blur={2.8} far={0.5} color="#343934" />
      </Suspense>
      {showGrid && <gridHelper args={[4, 40, '#b7bbb3', '#d0d3cb']} position={[0, design.productType === 'door' ? -1.085 : -0.125, 0]} />}
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={0.8} enablePan={false} minDistance={0.35} maxDistance={5} />
    </Canvas>
  )
}

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

function RotatingCube() {
  const cube = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (cube.current) {
      cube.current.rotation.x += delta * 0.15
      cube.current.rotation.y += delta * 0.3
    }
  })

  return (
    <mesh ref={cube} rotation={[0.5, 0.5, 0]}>
      <boxGeometry />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={1} />
        <directionalLight position={[3, 3, 3]} />
        <RotatingCube />
      </Canvas>
    </div>
  )
}
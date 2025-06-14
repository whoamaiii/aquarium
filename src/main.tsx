import React from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import './index.css'
import { Scene } from '@/components/Scene'
import { initializeEntities } from '@/engine/init'
import { startEngineLoop } from '@/engine/loop'

// Initialize ECS entities
initializeEntities()

// Start the fixed-step simulation loop
startEngineLoop()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Canvas camera={{ position: [0, 0, 70], fov: 50 }}>
      <ambientLight intensity={Math.PI / 2} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <Scene />
    </Canvas>
  </React.StrictMode>,
)

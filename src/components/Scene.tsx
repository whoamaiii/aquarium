/**
 * @file Scene.tsx
 * This React component is responsible for setting up and rendering the main 3D scene
 * of the simulation using React Three Fiber (`@react-three/fiber`).
 *
 * Key responsibilities include:
 * - Potentially setting up the R3F `Canvas` (though often the Canvas is in a higher-level component like App.tsx).
 * - Including common 3D scene elements like lights (e.g., `ambientLight`, `directionalLight`)
 *   and camera controls (e.g., `OrbitControls` from `@react-three/drei`), although these might be
 *   placed directly in the `Canvas` component elsewhere or alongside this Scene component.
 * - The primary task of this component is rendering the visual representation of the
 *   simulation entities (boids/creatures). It achieves this by:
 *     - Accessing entity data (like position and phenotype for color/size) from the simulation engine
 *       via the `useEngine` hook.
 *     - Efficiently rendering these entities, typically using an `InstancedMesh` for performance,
 *       where each instance represents an entity. The properties of each instance (matrix for position/scale,
 *       and color) are updated each frame based on the latest engine data.
 *
 * This component forms a crucial part of the application's rendering pipeline, bridging the gap
 * between the underlying simulation logic and its visual presentation on screen.
 */
import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEngine } from '@/hooks/useEngine'

const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()

export function Scene() {
  const { entities, Position, Phenotype } = useEngine()
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.count = entities.length
    }
  }, [entities.length])

  useFrame(() => {
    if (meshRef.current && entities.length > 0) {
      entities.forEach((eid, i) => {
        tempObject.position.set(
          Position.x[eid],
          Position.y[eid],
          Position.z[eid]
        )

        const size = Phenotype.size[eid] || 0.5
        tempObject.scale.set(size, size, size)
        
        tempObject.updateMatrix()
        meshRef.current.setMatrixAt(i, tempObject.matrix)

        tempColor.setRGB(
          Phenotype.r[eid] || 0.5,
          Phenotype.g[eid] || 0.5,
          Phenotype.b[eid] || 0.5
        )
        meshRef.current.setColorAt(i, tempColor)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true
      }
    }
  })

  if (entities.length === 0) {
    return null
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, entities.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
} 
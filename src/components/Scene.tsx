import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh } from '@react-three/drei'
import * as THREE from 'three'
import { useEngine } from '@/hooks/useEngine'

const tempObject = new THREE.Object3D()

export function Scene() {
  const { entities, Position } = useEngine()
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  // This effect runs once to set up the mesh instance count.
  useLayoutEffect(() => {
    if (meshRef.current) {
      // Ensure the mesh is aware of how many instances it will render.
      // This might not be strictly necessary if entities don't change count dynamically after init,
      // but good practice if they could.
      meshRef.current.count = entities.length
    }
  }, [entities.length]) // Re-run if the number of entities changes

  useFrame(() => {
    if (meshRef.current && entities.length > 0) {
      entities.forEach((eid, i) => {
        // Directly use Position data from ECS
        tempObject.position.set(
          Position.x[eid],
          Position.y[eid],
          Position.z[eid]
        )
        // We could also set rotation/scale here if those were in ECS
        // tempObject.rotation.set(...)
        // tempObject.scale.set(...)
        tempObject.updateMatrix()
        meshRef.current.setMatrixAt(i, tempObject.matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  })

  if (entities.length === 0) {
    // console.log("Scene: No entities to render yet.")
    return null // Don't render an empty InstancedMesh, or ensure count is 0
  }
  
  // console.log(`Scene: Rendering ${entities.length} entities.`)

  return (
    <InstancedMesh ref={meshRef} args={[undefined, undefined, entities.length]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="orange" />
    </InstancedMesh>
  )
} 
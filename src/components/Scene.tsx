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
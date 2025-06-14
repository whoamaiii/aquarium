import { defineQuery, defineSystem } from 'bitecs'
import { Position, Velocity } from './components'

const movementQuery = defineQuery([Position, Velocity])

export const movementSystem = defineSystem(world => {
  const entities = movementQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    Position.x[eid] += Velocity.x[eid]
    Position.y[eid] += Velocity.y[eid]
    Position.z[eid] += Velocity.z[eid]
  }
  return world
}) 
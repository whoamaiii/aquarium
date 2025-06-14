import { addComponent, addEntity } from 'bitecs'
import { Position, Velocity } from './components'
import { world } from './world'

const NUM_ENTITIES = 10000

export function initializeEntities() {
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const eid = addEntity(world)
    addComponent(world, Position, eid)
    Position.x[eid] = Math.random() * 100 - 50 // Tilfeldig X mellom -50 og 50
    Position.y[eid] = Math.random() * 100 - 50 // Tilfeldig Y mellom -50 og 50
    Position.z[eid] = Math.random() * 100 - 50 // Tilfeldig Z mellom -50 og 50

    addComponent(world, Velocity, eid)
    // Initial hastighet kan settes her hvis ønskelig, f.eks. tilfeldig eller null
    Velocity.x[eid] = (Math.random() - 0.5) * 2 // Tilfeldig X-hastighet mellom -1 og 1
    Velocity.y[eid] = (Math.random() - 0.5) * 2 // Tilfeldig Y-hastighet mellom -1 og 1
    Velocity.z[eid] = (Math.random() - 0.5) * 2 // Tilfeldig Z-hastighet mellom -1 og 1
  }
  console.log(`Initialized ${NUM_ENTITIES} entities.`)
} 
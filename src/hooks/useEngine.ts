import { world } from '@/engine/world'
import { Position, Velocity } from '@/engine/components' // Assuming Velocity might be needed later for visuals
import { defineQuery } from 'bitecs'
import { useLayoutEffect, useState } from 'react'

// Query for entities that have Position. We might want to render entities
// even if they don't have velocity, or have other components.
const renderableQuery = defineQuery([Position])

export function useEngine() {
  // We store the query result (array of entity IDs) in state 
  // so R3F can re-render when entities are added/removed.
  // For per-frame position updates, we'll access Position.x[eid] directly later.
  const [entities, setEntities] = useState<number[]>([])

  useLayoutEffect(() => {
    // Initial population of entities
    setEntities([...renderableQuery(world)])

    // TODO: How to handle entities being added/removed at runtime?
    // bitecs doesn't have built-in events for this.
    // For now, we assume entities are static after initialization.
    // A more robust solution might involve a custom event system or periodic re-querying.
  }, [])

  return {
    world,
    entities, // Array of entity IDs
    Position, // Direct access to Position component data
    Velocity  // Direct access to Velocity component data (if needed for rendering)
  }
} 
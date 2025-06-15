import { defineQuery, defineSystem, type IWorld } from 'bitecs' // Added IWorld for type annotation
import { Position, Velocity } from './components'

/**
 * Defines a query for entities that have both Position and Velocity components.
 * This query is used by the `movementSystem` to identify entities that can be moved.
 */
const movementQuery = defineQuery([Position, Velocity]);

/**
 * A basic CPU-based movement system.
 * It iterates over all entities that have both `Position` and `Velocity` components
 * and updates their position based on their current velocity.
 * This system is used as a fallback when GPU-accelerated movement (e.g., Boids) is not available
 * or for entities not managed by the GPU system.
 *
 * @param {IWorld} world - The bitECS world instance.
 * @returns {IWorld} The world instance, unchanged by this system (mutations occur on component data directly).
 */
export const movementSystem = defineSystem((world: IWorld) => {
  // Retrieve all entities that match the movementQuery (i.e., have Position and Velocity).
  const entities = movementQuery(world);

  // Iterate over each entity found by the query.
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]; // Get the current entity ID.

    // Update the entity's position by adding its velocity components.
    // This performs a simple Euler integration step for position.
    Position.x[eid] += Velocity.x[eid];
    Position.y[eid] += Velocity.y[eid];
    Position.z[eid] += Velocity.z[eid];
  }

  // The system returns the world instance, though typically systems modify component data in place.
  return world;
});
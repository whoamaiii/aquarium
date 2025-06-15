import { createWorld } from 'bitecs'

/**
 * This file initializes and exports the global `bitECS` world instance.
 * The `world` object is the central container for all entities and their component data
 * within the Entity Component System (ECS) architecture. It is used by systems
 * to query and manipulate entities.
 */
export const world = createWorld()
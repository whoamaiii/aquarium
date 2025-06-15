/**
 * @file Enables entities to autonomously find food within the simulation.
 * This system gives entities a chance to forage each tick, and if successful,
 * it uses the `feedCreature` function from `metabolismSystem` to add food
 * to their stomach for later digestion.
 */
import { defineQuery, type IWorld } from 'bitecs'; // Added type IWorld for consistency
import { Energy } from './components'; // Used to query entities that are "alive" or can forage.
import { feedCreature } from './metabolismSystem'; // Function to call to initiate feeding/digestion.

// Note on world import:
// The 'world' object (global instance from world.ts) is not directly used here
// because `foragingQuery` operates on the `currentWorld` passed to the system,
// and `feedCreature` only needs an entity ID. If this system needed to, for example,
// find food entities in the world, it would then need access to the broader world or specific queries.

/**
 * Query for entities that are capable of foraging.
 * Currently, this includes any entity with an `Energy` component, implying it's a creature
 * that needs to eat.
 */
const foragingQuery = defineQuery([Energy]);

/** The probability (0 to 1) that an entity will successfully forage for food in a single simulation tick. */
const FORAGE_CHANCE_PER_TICK = 0.01; // Represents a 1% chance per entity per tick.

/** The default type of food entities will find when foraging. Must match a key in `FOOD_TYPE_MAP` in `metabolismSystem.ts`. */
const FOOD_TYPE_TO_FORAGE = "sweet";

/** The amount of food an entity finds when it successfully forages. */
const FOOD_AMOUNT_TO_FORAGE = 1;

/**
 * The foraging system, executed each simulation tick.
 * It gives each eligible entity a random chance to find food.
 * If an entity forages successfully, `feedCreature` is called to place
 * food in its stomach, which will then be processed by the `metabolismSystem`.
 *
 * @param {IWorld} currentWorld - The bitECS world instance.
 * @returns {IWorld} The world instance (standard system signature).
 */
export function foragingSystem(currentWorld: IWorld) {
  // Get all entities that are capable of foraging (have an Energy component).
  const entities = foragingQuery(currentWorld);

  // Iterate over each eligible entity.
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // Optional Enhancement: Implement conditional foraging.
    // For example, an entity might only attempt to forage if its current energy
    // is below a certain percentage of its maximum energy. This would require
    // `Energy.max` to be consistently set and available for entities.
    // Example:
    // if (Energy.current[eid] < Energy.max[eid] * 0.5) {

      // Check if the entity successfully forages based on a random chance.
      if (Math.random() < FORAGE_CHANCE_PER_TICK) {
        // If successful, call `feedCreature` to add the foraged food
        // to the entity's stomach. The metabolismSystem will handle digestion.
        feedCreature(eid, FOOD_TYPE_TO_FORAGE, FOOD_AMOUNT_TO_FORAGE);
        // For debugging: console.log(`Entity ${eid} foraged for ${FOOD_AMOUNT_TO_FORAGE} ${FOOD_TYPE_TO_FORAGE} food.`);
      }
    // } // End of optional conditional foraging block.
  }
  return currentWorld; // Standard system return.
}

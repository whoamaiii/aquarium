/**
 * @file Manages social interactions between entities in the simulation.
 * This system applies social rules defined in `social.json`, tracks relationship strengths
 * between entities, and utilizes a 3D spatial grid for efficient querying of nearby entities
 * to optimize performance.
 */
import { defineQuery, type IWorld } from 'bitecs'
import { Position, Energy, Mood } from './components'
// Note: The global `world` import was removed as `socialQuery` now uses the `currentWorld` passed to the system,
// and the spatial grid relies on entities from this query.
import socialRulesJson from '@/data/rules/social.json'

// --- Spatial Grid Constants and Types ---

/**
 * Defines the size of each cell in the 3D spatial grid.
 * This value influences the granularity of the grid. A smaller cell size means more cells
 * but potentially fewer entities per cell. It's often tuned based on typical interaction radii.
 * Here, it's set slightly larger than `MAX_SOCIAL_INTERACTION_RADIUS` to ensure entities
 * within interaction range are usually in the same or adjacent cells.
 */
const GRID_CELL_SIZE = 5;

/**
 * The maximum radius within which social interactions are considered.
 * This is used to query the spatial grid for nearby entities. Ideally, this value should
 * correspond to the largest `distance_lt` precondition found in the `social.json` rules.
 */
const MAX_SOCIAL_INTERACTION_RADIUS = 2; // Derived from "Groom" rule's distance_lt in social.json.

/** Minimum X-coordinate for the spatial grid's bounds. Defines the operational area of the grid. */
const WORLD_MIN_X = -60;
/** Minimum Y-coordinate for the spatial grid's bounds. */
const WORLD_MIN_Y = -60;
/** Minimum Z-coordinate for the spatial grid's bounds. */
const WORLD_MIN_Z = -60;
/** Maximum X-coordinate for the spatial grid's bounds. */
const WORLD_MAX_X = 60;
/** Maximum Y-coordinate for the spatial grid's bounds. */
const WORLD_MAX_Y = 60;
/** Maximum Z-coordinate for the spatial grid's bounds. */
const WORLD_MAX_Z = 60;
// Note: These world bounds are currently static, assuming entities operate within this predefined area.
// For simulations where entities can move far beyond these, a dynamic grid or other spatial structure might be needed.

/** Type alias for the string key used in the spatialGrid Map (e.g., "cx_cy_cz"). */
type CellKey = string;
/**
 * The spatial grid data structure.
 * It's a Map where:
 * - Key (`CellKey`): A string representing cell coordinates (e.g., "3_5_2").
 * - Value (`number[]`): An array of entity IDs (eIDs) currently located within that cell.
 * This grid is rebuilt each tick by the `updateSpatialGrid` function.
 */
const spatialGrid: Map<CellKey, number[]> = new Map();

// --- Social Rule Type Definitions ---
// These interfaces define the expected structure for rules loaded from social.json.

/**
 * Defines the preconditions that must be met for a social rule to be applied.
 * @property {number} [distance_lt] - Maximum distance (less than) between initiator and target.
 * @property {number} [relationship_gt] - Minimum relationship strength (greater than) from initiator to target.
 * Other preconditions can be added here (e.g., specific mood states, energy levels).
 */
interface SocialRulePrecondition {
  distance_lt?: number;
  relationship_gt?: number;
  // Example: mood_initiator_happiness_gt?: number;
}

/**
 * Defines the effects of a social rule on the target entity.
 * @property {number} [moodHappinessChange] - Change to the target's happiness level.
 * Other effects on the target can be added here.
 */
interface SocialRuleEffectTarget {
  moodHappinessChange?: number;
  // Example: energyChange?: number;
}

/**
 * Defines the effects of a social rule on the initiator entity.
 * @property {number} [energyChange] - Change to the initiator's energy level.
 * Other effects on the initiator can be added here.
 */
interface SocialRuleEffectInitiator {
  energyChange?: number;
  // Example: moodHappinessChange?: number;
}

/**
 * Defines the overall effects of a social rule, including changes to initiator, target, and their relationship.
 * @property {SocialRuleEffectTarget} [target] - Effects applied to the target entity.
 * @property {SocialRuleEffectInitiator} [initiator] - Effects applied to the initiator entity.
 * @property {number} [relationshipChange] - Change in the relationship strength between initiator and target.
 */
interface SocialRuleEffect {
  target?: SocialRuleEffectTarget;
  initiator?: SocialRuleEffectInitiator;
  relationshipChange?: number;
}

/**
 * Represents a single social rule, combining a verb (name), preconditions, and effects.
 * @property {string} verb - The name or type of the social interaction (e.g., "Groom", "Challenge").
 * @property {SocialRulePrecondition} preconditions - Conditions that must be met for the rule to apply.
 * @property {SocialRuleEffect} effects - Changes that occur if the rule's preconditions are met.
 */
interface SocialRule {
  verb: string;
  preconditions: SocialRulePrecondition;
  effects: SocialRuleEffect;
}

/** Holds the array of social interaction rules loaded from `social.json`. */
const SOCIAL_RULES: SocialRule[] = socialRulesJson.rules;

/**
 * Global Map storing relationship strengths between entities.
 * Structure: `Map<initiatorEid, Map<targetEid, strength>>`
 * - The outer Map's key is the ID of the entity initiating a perspective on relationships.
 * - The inner Map's key is the ID of the target entity.
 * - The value (`strength`) is a number from -1 (hostile) to 1 (friendly/allied), with 0 being neutral.
 * Relationships are reciprocal: if A's strength towards B is X, B's strength towards A is also X.
 * This map represents the social graph of the simulation.
 */
export const relationshipStrengths: Map<number, Map<number, number>> = new Map();

/**
 * Query for entities that can participate in social interactions.
 * Requires `Position` (for distance checks), `Energy` (potentially for rule preconditions/effects),
 * and `Mood` (for rule preconditions/effects).
 */
const socialQuery = defineQuery([Position, Energy, Mood]);

// --- Spatial Grid Helper Functions ---

/**
 * Converts world coordinates (x, y, z) to grid cell coordinates (cx, cy, cz).
 * This is done by translating world coordinates relative to the grid's origin (`WORLD_MIN_X/Y/Z`)
 * and then dividing by `GRID_CELL_SIZE`, flooring the result to get integer cell indices.
 * @param {number} x - World x-coordinate.
 * @param {number} y - World y-coordinate.
 * @param {number} z - World z-coordinate.
 * @returns {{cx: number, cy: number, cz: number}} The integer-based cell coordinates.
 */
function getCellCoords(x: number, y: number, z: number): { cx: number, cy: number, cz: number } {
  const cx = Math.floor((x - WORLD_MIN_X) / GRID_CELL_SIZE);
  const cy = Math.floor((y - WORLD_MIN_Y) / GRID_CELL_SIZE);
  const cz = Math.floor((z - WORLD_MIN_Z) / GRID_CELL_SIZE);
  return { cx, cy, cz };
}

/**
 * Generates a unique string key for a given set of cell coordinates.
 * This key is used for storing and retrieving entity lists from the `spatialGrid` Map.
 * Format: "cx_cy_cz".
 * @param {number} cx - Cell x-coordinate.
 * @param {number} cy - Cell y-coordinate.
 * @param {number} cz - Cell z-coordinate.
 * @returns {CellKey} The unique string key for the cell.
 */
function getCellKey(cx: number, cy: number, cz: number): CellKey {
  return `${cx}_${cy}_${cz}`;
}

/**
 * Updates the spatial grid with the current positions of all social entities.
 * This function is called at the beginning of each `socialSystem` tick.
 * It first clears the existing grid, then iterates through all entities found by `socialQuery`,
 * calculates their cell coordinates, and adds their entity ID to the list for that cell.
 * @param {number[]} entities - Array of entity IDs to process (typically from `socialQuery`).
 * @param {IWorld} currentWorld - The bitECS world instance (currently unused as Position is directly accessed).
 */
function updateSpatialGrid(entities: number[], currentWorld: IWorld): void {
  spatialGrid.clear(); // Clear all entities from previous tick.
  for (const eid of entities) {
    // Get entity's current position.
    const x = Position.x[eid];
    const y = Position.y[eid];
    const z = Position.z[eid];

    // Convert world position to grid cell coordinates and generate a key.
    const { cx, cy, cz } = getCellCoords(x, y, z);
    const key = getCellKey(cx, cy, cz);

    // Add entity to the cell's list.
    if (!spatialGrid.has(key)) {
      spatialGrid.set(key, []); // Initialize array if cell is new this tick.
    }
    spatialGrid.get(key)!.push(eid);
  }
}

/**
 * Retrieves a list of nearby entity IDs for a given initiator entity, using the spatial grid.
 * It determines the initiator's cell and then queries a cubic region of cells around it,
 * defined by `queryRadius` (translated into a cell-based radius).
 * @param {number} initiatorEid - The ID of the entity for whom to find neighbors.
 * @param {number} queryRadius - The world-space radius to search for neighbors.
 * @returns {number[]} An array of unique entity IDs found in the nearby cells, excluding the initiator itself.
 */
function getNearbyEntities(initiatorEid: number, queryRadius: number): number[] {
  const nearbyEids: number[] = [];
  const ix = Position.x[initiatorEid];
  const iy = Position.y[initiatorEid];
  const iz = Position.z[initiatorEid];

  // Get the cell coordinates of the initiator entity.
  const { cx: initiatorCX, cy: initiatorCY, cz: initiatorCZ } = getCellCoords(ix, iy, iz);

  // Determine the search radius in terms of grid cells.
  // This means checking the initiator's cell and `cellQueryRadius` cells in each direction.
  const cellQueryRadius = Math.ceil(queryRadius / GRID_CELL_SIZE);

  // Iterate through a cubic region of cells centered on the initiator's cell.
  for (let dz = -cellQueryRadius; dz <= cellQueryRadius; dz++) {
    for (let dy = -cellQueryRadius; dy <= cellQueryRadius; dy++) {
      for (let dx = -cellQueryRadius; dx <= cellQueryRadius; dx++) {
        const checkCX = initiatorCX + dx;
        const checkCY = initiatorCY + dy;
        const checkCZ = initiatorCZ + dz;

        const key = getCellKey(checkCX, checkCY, checkCZ);
        // If the cell exists in the grid (i.e., has entities), process its occupants.
        if (spatialGrid.has(key)) {
          for (const targetEid of spatialGrid.get(key)!) {
            if (targetEid !== initiatorEid) { // Ensure the initiator is not considered its own neighbor.
              // The main socialSystem loop will perform precise distance checks.
              // This function provides a broad-phase filter.
              nearbyEids.push(targetEid);
            }
          }
        }
      }
    }
  }
  // Using Set to ensure uniqueness, primarily if an entity could somehow be added from multiple
  // perspectives (though with one entity per cell, this is mostly a safeguard for self-exclusion).
  return Array.from(new Set(nearbyEids));
}


// --- Relationship Helper Functions ---

/**
 * Retrieves the current relationship strength from an initiator entity towards a target entity.
 * Strength ranges from -1 (hostile) to 1 (friendly), with 0 being neutral.
 * @param {number} initiatorEid - The ID of the entity whose perspective is being queried.
 * @param {number} targetEid - The ID of the entity being targeted.
 * @returns {number} The relationship strength, or 0 if no relationship is explicitly stored.
 */
function getRelationshipStrength(initiatorEid: number, targetEid: number): number {
  const initiatorRelations = relationshipStrengths.get(initiatorEid);
  if (initiatorRelations) {
    return initiatorRelations.get(targetEid) || 0; // Default to 0 if no specific relation to target.
  }
  return 0; // Default to 0 if initiator has no stored relations.
}

/**
 * Updates the relationship strength between two entities by a given amount.
 * Ensures that the relationship is reciprocal (A to B strength is the same as B to A).
 * Strength values are clamped between -1 and 1.
 * @param {number} initiatorEid - The ID of the first entity.
 * @param {number} targetEid - The ID of the second entity.
 * @param {number} change - The amount to change the relationship strength by (can be positive or negative).
 */
function updateRelationshipStrength(initiatorEid: number, targetEid: number, change: number): void {
  // Ensure maps exist for both entities.
  if (!relationshipStrengths.has(initiatorEid)) {
    relationshipStrengths.set(initiatorEid, new Map());
  }
  if (!relationshipStrengths.has(targetEid)) {
    relationshipStrengths.set(targetEid, new Map());
  }

  const initiatorMap = relationshipStrengths.get(initiatorEid)!;
  const targetMap = relationshipStrengths.get(targetEid)!;

  // Get current strength (or 0 if none) and apply change.
  const currentStrengthInitiatorToTarget = initiatorMap.get(targetEid) || 0;
  const newStrength = Math.max(-1, Math.min(1, currentStrengthInitiatorToTarget + change)); // Clamp.
  
  // Set the new strength reciprocally.
  initiatorMap.set(targetEid, newStrength);
  targetMap.set(initiatorEid, newStrength); 
}

// --- Main Social System Logic ---

/**
 * The main social system, executed each simulation tick.
 * It performs the following steps:
 * 1. Updates the spatial grid with current entity positions.
 * 2. For each entity (initiator):
 *    a. Queries the spatial grid for nearby entities (potential targets).
 *    b. For each potential target:
 *       i. Iterates through defined social rules (`SOCIAL_RULES`).
 *       ii. Checks if rule preconditions (distance, relationship strength, etc.) are met.
 *       iii. If preconditions are met, applies the rule's effects (mood, energy, relationship changes).
 *       iv. Assumes only one rule can apply per pair per tick (breaks after first successful rule).
 * @param {IWorld} currentWorld - The bitECS world instance.
 * @returns {IWorld} The world instance (standard system signature).
 */
export function socialSystem(currentWorld: IWorld) {
  const entities = socialQuery(currentWorld); // Get all entities that can participate in social interactions.

  // 1. Update the spatial grid with the current positions of all social entities.
  // This allows for efficient querying of nearby entities.
  updateSpatialGrid(entities, currentWorld);

  // Outer loop: Iterate through each entity as a potential initiator of a social interaction.
  for (const initiatorEid of entities) {
    // 2. Get nearby entities for the current initiator using the spatial grid.
    // The query radius is based on `MAX_SOCIAL_INTERACTION_RADIUS`.
    const nearbyEntities = getNearbyEntities(initiatorEid, MAX_SOCIAL_INTERACTION_RADIUS);

    // Inner loop: Iterate through potential target entities found by the spatial query.
    for (const targetEid of nearbyEntities) {
      // Note: `getNearbyEntities` already ensures `initiatorEid !== targetEid`.

      // Loop through all defined social rules.
      for (const rule of SOCIAL_RULES) {
        // Currently, the system is hardcoded to process only the "Groom" rule.
        // Future enhancement: Implement a more dynamic rule selection/evaluation mechanism.
        if (rule.verb === "Groom") { 
          let preconditionsMet = true; // Assume true until a precondition fails.

          // --- Precondition Checking ---
          // Check distance precondition: Is the target close enough?
          // This is a precise distance check, performed after the broad-phase filtering by the spatial grid.
          if (rule.preconditions.distance_lt !== undefined) {
            const dX = Position.x[initiatorEid] - Position.x[targetEid];
            const dY = Position.y[initiatorEid] - Position.y[targetEid];
            const dZ = Position.z[initiatorEid] - Position.z[targetEid];
            const distanceSq = dX * dX + dY * dY + dZ * dZ; // Use squared distance for efficiency.
            if (distanceSq >= rule.preconditions.distance_lt * rule.preconditions.distance_lt) {
              preconditionsMet = false; // Target is too far.
            }
          }

          // Check relationship strength precondition: Is the relationship strong enough?
          if (preconditionsMet && rule.preconditions.relationship_gt !== undefined) {
            const strength = getRelationshipStrength(initiatorEid, targetEid);
            if (strength <= rule.preconditions.relationship_gt) {
              preconditionsMet = false; // Relationship is not strong enough.
            }
          }

          // --- Applying Effects ---
          // If all preconditions for the rule are met, apply its effects.
          if (preconditionsMet) {
            // Apply effect to target's mood (happiness).
            if (rule.effects.target?.moodHappinessChange) {
              Mood.happiness[targetEid] += rule.effects.target.moodHappinessChange;
              Mood.happiness[targetEid] = Math.max(-1, Math.min(1, Mood.happiness[targetEid])); // Clamp happiness.
            }

            // Apply effect to initiator's energy.
            if (rule.effects.initiator?.energyChange) {
              Energy.current[initiatorEid] += rule.effects.initiator.energyChange;
              Energy.current[initiatorEid] = Math.max(0, Energy.current[initiatorEid]); // Clamp energy (min 0).
            }

            // Apply change to relationship strength.
            if (rule.effects.relationshipChange) {
              updateRelationshipStrength(initiatorEid, targetEid, rule.effects.relationshipChange);
            }

            // For debugging: console.log(`Social interaction: ${initiatorEid} ${rule.verb} ${targetEid}`);

            // Assumption: Only one social rule can be successfully applied between two entities per tick.
            // Break from the rule loop to prevent applying multiple rules in one go.
            break; 
          }
        }
      }
    }
  }
  return currentWorld; // Standard system return.
}

/**
 * Initializes the social state of the simulation.
 * This primarily involves clearing all stored relationship strengths from the `relationshipStrengths` map.
 * Typically called at the beginning of a new simulation or when a full reset is required.
 */
export function initializeSocialState() {
  relationshipStrengths.clear(); // Reset the global relationship map.
  console.log("Social state (relationships) initialized (currently empty).");
}

/**
 * Restores the entire social relationship map.
 * This function is used by the persistence system (`loadState`) to repopulate
 * the `relationshipStrengths` map with data from a saved game state.
 * @param {Map<number, Map<number, number>>} newRelationships - The relationship data to load.
 *        The structure should match `relationshipStrengths`: Map<initiatorEid, Map<targetEid, strength>>.
 */
export function setRelationshipStrengths(newRelationships: Map<number, Map<number, number>>): void {
  relationshipStrengths.clear(); // Clear existing relationships before loading new ones.
  // Iterate through the loaded data and repopulate the map.
  // It's important to create new Maps for the inner structure to ensure no shared references
  // if the `newRelationships` object is modified elsewhere.
  newRelationships.forEach((innerMap, key) => {
    relationshipStrengths.set(key, new Map(innerMap));
  });
  console.log("Social relationships restored.");
}
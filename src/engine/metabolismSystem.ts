/**
 * @file Manages entity metabolism, including passive energy consumption,
 * digestion of food found in an entity's `Stomach`, and the application of
 * effects from that food (like energy gain, mood changes, and phenotype modifications)
 * based on rules defined in `evolution.json`.
 */
import { defineQuery } from 'bitecs'
import type { IWorld } from 'bitecs' // Type-only import for IWorld
import { Energy, Mood, Phenotype, Stomach } from './components'
// import { world } from './world' // Unused import removed for cleanliness.
import evolutionRules from '@/data/rules/evolution.json' // Vite handles JSON import.

// --- Rule-related Type Definitions ---
// These interfaces define the expected structure for rules loaded from evolution.json.

/**
 * Defines the trigger conditions for an evolution rule, primarily the type of food.
 * @property {string} foodType - The name of the food type that triggers this rule (e.g., "sweet").
 */
interface EvolutionRuleTrigger {
  foodType: string;
}

/**
 * Defines the effects that are applied to an entity when an evolution rule is triggered.
 * All effects are optional and are scaled by the amount of food digested.
 * @property {number} [energyChange] - Change in current energy level.
 * @property {number} [moodHappinessChange] - Change in happiness level (clamped between -1 and 1).
 * @property {number} [phenotypeRChange] - Change in the red color component of the phenotype (clamped 0-1).
 * @property {number} [phenotypeGChange] - Change in the green color component of the phenotype (clamped 0-1).
 * @property {number} [phenotypeBChange] - Change in the blue color component of the phenotype (clamped 0-1).
 * @property {number} [phenotypeSizeChange] - Change in the size component of the phenotype (clamped to be >= 0.1).
 */
interface EvolutionRuleEffect {
  energyChange?: number;
  moodHappinessChange?: number;
  phenotypeRChange?: number;
  phenotypeGChange?: number;
  phenotypeBChange?: number;
  phenotypeSizeChange?: number;
}

/**
 * Represents a single evolution rule, combining a trigger and its effects.
 * @property {string} ruleName - A descriptive name for the rule (e.g., "SweetFoodDigestion").
 * @property {EvolutionRuleTrigger} trigger - The conditions that activate this rule.
 * @property {EvolutionRuleEffect} effect - The changes applied to the entity when the rule is activated.
 */
interface EvolutionRule {
  ruleName: string;
  trigger: EvolutionRuleTrigger;
  effect: EvolutionRuleEffect;
}

/** Holds the array of evolution rules loaded from `evolution.json`. */
const rules: EvolutionRule[] = evolutionRules.rules;

/**
 * Maps string-based food types (from rules) to numerical IDs used in the `Stomach` component.
 * This is a simple mapping; a more complex system might use a central food type registry.
 * Example: "sweet" food maps to ID 1.
 */
const FOOD_TYPE_MAP: { [key: string]: number } = {
  "sweet": 1,
  // "sour": 2, // Example for future food types
};

/** Query for entities that have Stomach, Energy, Mood, and Phenotype components, relevant for metabolism. */
const metabolismQuery = defineQuery([Stomach, Energy, Mood, Phenotype]);

/** The amount of energy passively consumed by each entity per simulation tick. */
const BASAL_METABOLISM_RATE = 0.05;

/**
 * The metabolism system, executed each simulation tick.
 * It handles:
 * 1. Basal metabolism: Passive energy drain for all relevant entities.
 * 2. Digestion: Processing food in entities' stomachs and applying effects based on evolution rules.
 * @param {IWorld} currentWorld - The bitECS world instance.
 * @returns {IWorld} The world instance (standard system signature).
 */
export function metabolismSystem(currentWorld: IWorld) {
  const entities = metabolismQuery(currentWorld); // Get all entities with metabolism-related components.

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // --- 1. Basal Metabolism ---
    // All entities with energy passively lose a small amount each tick.
    Energy.current[eid] -= BASAL_METABOLISM_RATE;
    if (Energy.current[eid] < 0) {
      Energy.current[eid] = 0; // Prevent energy from dropping below zero.
      // Future enhancement: Implement consequences for zero energy (e.g., entity "death" or incapacitation).
    }

    // --- 2. Digestion Process ---
    // Check if there's food in the entity's stomach to be digested.
    const foodTypeIdToDigest = Stomach.foodTypeToDigest[eid]; // Numerical ID of the food.
    const foodAmountToDigest = Stomach.amountToDigest[eid];   // Amount of said food.

    if (foodTypeIdToDigest > 0 && foodAmountToDigest > 0) { // Food ID 0 means empty.
      // Convert numerical food type ID back to its string name for rule lookup.
      let foodTypeName = "";
      for (const [name, id] of Object.entries(FOOD_TYPE_MAP)) {
        if (id === foodTypeIdToDigest) {
          foodTypeName = name;
          break;
        }
      }

      if (foodTypeName) {
        // Find the evolution rule that corresponds to the digested food type.
        const rule = rules.find(r => r.trigger.foodType === foodTypeName);
        if (rule) {
          // --- Apply Effects from the Rule ---
          // All effects are scaled by the amount of food digested.

          // Apply energy change, clamping to max energy.
          if (rule.effect.energyChange) {
            Energy.current[eid] += rule.effect.energyChange * foodAmountToDigest;
            if (Energy.current[eid] > Energy.max[eid]) {
              Energy.current[eid] = Energy.max[eid];
            }
            // console.log(`Entity ${eid} digested ${foodTypeName}, energy: ${Energy.current[eid].toFixed(2)}`);
          }
          // Apply mood change (happiness), clamping between -1 and 1.
          if (rule.effect.moodHappinessChange) {
            Mood.happiness[eid] += rule.effect.moodHappinessChange * foodAmountToDigest;
            Mood.happiness[eid] = Math.max(-1, Math.min(1, Mood.happiness[eid]));
          }

          // Apply phenotype changes, clamping values appropriately.
          // Color components (r, g, b) are clamped between 0 and 1.
          if (rule.effect.phenotypeRChange !== undefined) {
            Phenotype.r[eid] = Math.max(0, Math.min(1, Phenotype.r[eid] + rule.effect.phenotypeRChange * foodAmountToDigest));
          }
          if (rule.effect.phenotypeGChange !== undefined) {
            Phenotype.g[eid] = Math.max(0, Math.min(1, Phenotype.g[eid] + rule.effect.phenotypeGChange * foodAmountToDigest));
          }
          if (rule.effect.phenotypeBChange !== undefined) {
            Phenotype.b[eid] = Math.max(0, Math.min(1, Phenotype.b[eid] + rule.effect.phenotypeBChange * foodAmountToDigest));
          }
          // Size is clamped to be at least 0.1 to prevent non-positive sizes.
          if (rule.effect.phenotypeSizeChange !== undefined) {
            Phenotype.size[eid] = Math.max(0.1, Phenotype.size[eid] + rule.effect.phenotypeSizeChange * foodAmountToDigest);
          }
        }
      }
      // After digestion (or attempted digestion), empty the stomach.
      // Future enhancement: Could implement partial digestion where amount is reduced instead of zeroed.
      Stomach.foodTypeToDigest[eid] = 0; // Mark stomach as empty.
      Stomach.amountToDigest[eid] = 0;   // Reset amount.
    }
  }
  return currentWorld; // Standard system return.
}

/**
 * Utility function to simulate feeding an entity.
 * This function places a specified type and amount of food into an entity's stomach,
 * making it available for processing by the `metabolismSystem` on the next tick.
 * It serves as an interface for other systems (e.g., `foragingSystem`) or external game events
 * to initiate the digestion process for an entity.
 *
 * @param {number} entityId - The ID of the entity to feed.
 * @param {string} foodType - The string identifier of the food type (e.g., "sweet").
 * @param {number} amount - The amount of food to give.
 */
export function feedCreature(entityId: number, foodType: string, amount: number) {
  // Convert the string food type to its numerical ID using FOOD_TYPE_MAP.
  const foodTypeId = FOOD_TYPE_MAP[foodType];

  // Check if the food type is known and if the entity has a Stomach component.
  // `Stomach.foodTypeToDigest[entityId]` would be undefined if the entity doesn't have the Stomach component.
  if (foodTypeId && Stomach.foodTypeToDigest[entityId] !== undefined) {
    Stomach.foodTypeToDigest[entityId] = foodTypeId; // Set the food type in the stomach.
    Stomach.amountToDigest[entityId] = amount;       // Set the amount of food.
    // console.log(`Entity ${entityId} is about to eat ${amount} of ${foodType}`);
  } else {
    // Log a warning if feeding is not possible (unknown food or entity lacks a stomach).
    console.warn(`Could not feed entity ${entityId}: Unknown foodType '${foodType}' or entity does not have Stomach component.`);
  }
}
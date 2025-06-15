import { defineComponent, Types } from 'bitecs'

/**
 * Represents the spatial position of an entity.
 * @property {number} x - The x-coordinate.
 * @property {number} y - The y-coordinate.
 * @property {number} z - The z-coordinate.
 */
export const Position = defineComponent({
  x: Types.f32, // The x-coordinate of the entity.
  y: Types.f32, // The y-coordinate of the entity.
  z: Types.f32, // The z-coordinate of the entity.
})

/**
 * Represents the velocity of an entity.
 * @property {number} x - The velocity component along the x-axis.
 * @property {number} y - The velocity component along the y-axis.
 * @property {number} z - The velocity component along the z-axis.
 */
export const Velocity = defineComponent({
  x: Types.f32, // Velocity along the x-axis.
  y: Types.f32, // Velocity along the y-axis.
  z: Types.f32, // Velocity along the z-axis.
})

// Fase 3: Kreaturkomponenter (Creature Components)

/**
 * Represents the genetic makeup of an entity.
 * Currently a placeholder, could be expanded for more complex genetic systems.
 * @property {number} id - A unique identifier for the genome type. Can be used to reference specific genetic traits.
 */
export const Genome = defineComponent({
  id: Types.ui32, // Simple ID for now, can be expanded to gene sequences later.
})

/**
 * Represents the observable characteristics (phenotype) of an entity, influenced by its genome and environment.
 * @property {number} r - Red color component (0-1 range).
 * @property {number} g - Green color component (0-1 range).
 * @property {number} b - Blue color component (0-1 range).
 * @property {number} size - The overall size of the entity.
 */
export const Phenotype = defineComponent({
  r: Types.f32,    // Red color component (normalized 0-1).
  g: Types.f32,    // Green color component (normalized 0-1).
  b: Types.f32,    // Blue color component (normalized 0-1).
  size: Types.f32, // General size of the entity.
})

/**
 * Represents the stomach contents of an entity, used for digestion.
 * @property {number} foodTypeToDigest - Numerical ID representing the type of food to be digested. 0 indicates an empty stomach.
 * @property {number} amountToDigest - The amount of the specified food type currently in the stomach.
 */
export const Stomach = defineComponent({
  // Represents what is in the stomach and is to be digested.
  foodTypeToDigest: Types.ui32, // 0 for empty, otherwise an ID matching a food type.
  amountToDigest: Types.f32,    // Amount of the food.
})

/**
 * Manages the energy levels of an entity.
 * @property {number} current - The current energy level of the entity.
 * @property {number} max - The maximum energy capacity of the entity.
 */
export const Energy = defineComponent({
  current: Types.f32, // Current energy level.
  max: Types.f32,     // Maximum possible energy.
})

/**
 * Represents the mood or emotional state of an entity.
 * @property {number} happiness - The happiness level, e.g., from -1 (unhappy) to 1 (happy).
 */
export const Mood = defineComponent({
  happiness: Types.f32, // E.g., from -1 (unhappy) to 1 (happy).
  // Other mood states can be added here (fear, curiosity, etc.).
})

// Fase 4.2: Kulturkomponenter (Cultural Components)

/**
 * Tags an entity with cultural behaviors or states.
 * @property {number} isDancingSpiral - Boolean (0 or 1) indicating if the entity is participating in a spiral dance.
 */
export const CulturalTag = defineComponent({
  isDancingSpiral: Types.ui8, // 0 for false, 1 for true, indicating participation in a spiral dance.
  // Future cultural tags can be added here.
  // Example: Target coordinates for a dance formation or current angle in a pattern.
  // spiralDanceTargetX: Types.f32,
  // spiralDanceTargetZ: Types.f32,
  // spiralDanceAngle: Types.f32,
})
/**
 * @file Manages a global "SpiralDance" festival within the simulation.
 * The festival is triggered when the average happiness of all entities
 * remains above a certain threshold for a specified duration.
 * This system controls the festival's lifecycle (start, duration, end)
 * and orchestrates the behavior of entities participating in the dance,
 * making them move in a spiral pattern.
 */
import { defineQuery } from 'bitecs'
import type { IWorld } from 'bitecs'
import { Mood, Position, Velocity, CulturalTag } from './components'
import { world } from './world' // Used to query all entities for global average happiness.

// --- Festival Triggering and Duration Constants ---

/** The minimum average happiness level across all entities required to start counting towards a festival. (Range: -1 to 1) */
const HAPPINESS_THRESHOLD = 0.8;
/** The number of consecutive simulation ticks that average happiness must stay above `HAPPINESS_THRESHOLD` to trigger the festival. */
const TICKS_FOR_HIGH_HAPPINESS_TO_TRIGGER_FESTIVAL = 30 * 10; // e.g., 30 seconds if TICK_RATE is 10 Hz.
/** The duration of the festival in simulation ticks once it starts. */
const FESTIVAL_DURATION_TICKS = 60 * 10; // e.g., Festival lasts for 60 seconds if TICK_RATE is 10 Hz.

// --- Exported Festival State Variables ---
// These variables track the current state of the festival and are exported
// to be potentially readable by other systems or UI elements, and settable by persistence.

/** Tracks the number of consecutive ticks the average entity happiness has been above `HAPPINESS_THRESHOLD`. */
export let ticksWithHighHappiness = 0;
/** A global boolean flag indicating whether the SpiralDance festival is currently active. */
export let isSpiralDanceActive = false;
/** Stores the simulation tick number (from `currentTick`) when the active festival is scheduled to end. */
export let festivalEndTick = 0;
/** A local tick counter for this system, incremented each time `festivalSystem` is called. */
export let currentTick = 0;

// --- State Setters (for Persistence) ---
// These functions allow the persistence system (e.g., `loadState` in `persistence.ts`)
// to restore the festival's state when loading a saved game.

/** Sets the `ticksWithHighHappiness` state variable. Used by persistence. */
export function setTicksWithHighHappiness(value: number) {
  ticksWithHighHappiness = value;
}
/** Sets the `isSpiralDanceActive` state variable. Used by persistence. */
export function setIsSpiralDanceActive(value: boolean) {
  isSpiralDanceActive = value;
}
/** Sets the `festivalEndTick` state variable. Used by persistence. */
export function setFestivalEndTick(value: number) {
  festivalEndTick = value;
}
/** Sets the local `currentTick` state variable for this system. Used by persistence. */
export function setCurrentTick(value: number) {
  currentTick = value;
}

// --- Entity Queries ---

/** Query for all entities that have a `Mood` component, used to calculate average happiness. */
const moodQuery = defineQuery([Mood]);
/**
 * Query for entities that can participate in the festival dance.
 * These entities require `Position` and `Velocity` (to move), `CulturalTag` (to mark them as dancers),
 * and `Mood` (potentially to influence their decision to stop dancing, though not fully utilized for that yet).
 */
const festivalParticipantQuery = defineQuery([Position, Velocity, CulturalTag, Mood]);

// --- Spiral Dance Parameters ---
// These constants define the geometry and dynamics of the spiral dance pattern.

/** The 3D coordinate {x, y, z} representing the central point of the spiral dance. */
const SPIRAL_CENTER = { x: 0, y: 0, z: 0 };
/** The base speed at which entities move towards their target position in the spiral. */
const SPIRAL_SPEED = 1.5;
/** Controls how much the radius of the spiral path for an entity increases per unit of rotation or time. Affects how quickly the spiral expands. */
const SPIRAL_RADIUS_GROWTH = 0.1;
/** Controls how fast entities rotate around the `SPIRAL_CENTER`. Higher values mean faster rotation. */
const SPIRAL_ROTATION_SPEED = 0.05;

/**
 * The main festival system, executed each simulation tick.
 * It monitors average entity happiness, manages the festival's state (starting, active, ending),
 * and controls the behavior of entities participating in the "SpiralDance".
 * @param {IWorld} currentWorld - The bitECS world instance for the current tick.
 * @returns {IWorld} The world instance (standard system signature).
 */
export function festivalSystem(currentWorld: IWorld) {
  currentTick++; // Increment local tick counter for this system.

  // --- Average Happiness Calculation ---
  // Query all entities with Mood from the global world instance to get a representative average.
  const allMoodEntities = moodQuery(world);
  let totalHappiness = 0;
  const populationCount = allMoodEntities.length;

  // If there are no entities with Mood, cannot calculate average happiness; exit.
  if (populationCount === 0) return currentWorld;

  // Sum happiness from all entities.
  for (let i = 0; i < populationCount; i++) {
    totalHappiness += Mood.happiness[allMoodEntities[i]];
  }
  const averageHappiness = totalHappiness / populationCount;

  // --- Festival State Logic ---
  if (!isSpiralDanceActive) {
    // --- Logic for Starting a Festival (when not currently active) ---
    if (averageHappiness > HAPPINESS_THRESHOLD) {
      ticksWithHighHappiness++; // Increment counter for consecutive high happiness ticks.
      // If happiness has been high for long enough, trigger the festival.
      if (ticksWithHighHappiness >= TICKS_FOR_HIGH_HAPPINESS_TO_TRIGGER_FESTIVAL) {
        isSpiralDanceActive = true; // Activate the festival.
        festivalEndTick = currentTick + FESTIVAL_DURATION_TICKS; // Schedule when it should end.
        ticksWithHighHappiness = 0; // Reset for the next potential festival.
        console.log(`SPIRALDANCE FESTIVAL STARTED! Ends at tick: ${festivalEndTick} (avg happiness: ${averageHappiness.toFixed(2)})`);
        
        // Mark all eligible entities as participants in the spiral dance.
        const participants = festivalParticipantQuery(currentWorld);
        for (let i = 0; i < participants.length; i++) {
          CulturalTag.isDancingSpiral[participants[i]] = 1; // Set their dancing flag.
        }
      }
    } else {
      // If average happiness drops below the threshold, reset the high happiness counter.
      ticksWithHighHappiness = 0;
    }
  } else {
    // --- Logic for Ending a Festival (when currently active) ---
    // End if the festival duration is reached OR if average happiness drops significantly.
    if (currentTick >= festivalEndTick || averageHappiness < HAPPINESS_THRESHOLD * 0.7) {
      isSpiralDanceActive = false; // Deactivate the festival.
      console.log("SPIRALDANCE FESTIVAL ENDED.");
      // Clear the dancing flag for all participants.
      const participants = festivalParticipantQuery(currentWorld);
      for (let i = 0; i < participants.length; i++) {
        CulturalTag.isDancingSpiral[participants[i]] = 0;
      }
    }
  }

  // --- Spiral Dance Behavior ---
  // If the festival is active, make participating entities dance.
  if (isSpiralDanceActive) {
    const dancers = festivalParticipantQuery(currentWorld); // Get all entities that should be dancing.
    for (let i = 0; i < dancers.length; i++) {
      const eid = dancers[i];
      // Check if this specific entity is marked to participate in the spiral dance.
      if (CulturalTag.isDancingSpiral[eid] === 1) {
        const posX = Position.x[eid];
        const posZ = Position.z[eid];

        // Calculate current angle and radius of the entity relative to the SPIRAL_CENTER.
        const dX = posX - SPIRAL_CENTER.x;
        const dZ = posZ - SPIRAL_CENTER.z;
        
        let currentAngle = Math.atan2(dZ, dX); // Angle in radians.
        let currentRadius = Math.sqrt(dX * dX + dZ * dZ); // Distance from center.

        // Update angle and radius to create the outward spiral motion.
        currentAngle += SPIRAL_ROTATION_SPEED; // Rotate around the center.
        // Radius grows, with growth rate decreasing slightly as radius increases (1/(radius+1) term).
        // The '0.1' factor further tunes the expansion speed.
        currentRadius += SPIRAL_RADIUS_GROWTH * (1 / (currentRadius + 1)) * 0.1;
        currentRadius = Math.max(1, currentRadius); // Ensure radius doesn't become zero or negative.

        // Calculate the entity's target X and Z coordinates on the spiral path.
        const targetX = SPIRAL_CENTER.x + currentRadius * Math.cos(currentAngle);
        const targetZ = SPIRAL_CENTER.z + currentRadius * Math.sin(currentAngle);
        // Calculate target Y with a sinusoidal wave for an up-and-down motion.
        // `currentAngle * 5` increases frequency of y-oscillation, `currentTick * 0.1` makes the wave pattern evolve over time.
        const targetY = SPIRAL_CENTER.y + Math.sin(currentAngle * 5 + currentTick * 0.1) * 5; 

        // Calculate direction vector towards the target position.
        const dirX = targetX - posX;
        const dirY = targetY - Position.y[eid]; // Use current Y position for 3D movement.
        const dirZ = targetZ - posZ;
        
        const distToTarget = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
        
        // If not already very close to the target, set velocity to move towards it.
        if (distToTarget > 0.1) {
            // Normalize the direction vector and scale by SPIRAL_SPEED.
            const invDist = SPIRAL_SPEED / distToTarget;
            Velocity.x[eid] = dirX * invDist;
            Velocity.y[eid] = dirY * invDist;
            Velocity.z[eid] = dirZ * invDist;
        } else {
            // If very close to the target for this tick, effectively stop (or greatly reduce jitter).
            Velocity.x[eid] = 0;
            Velocity.y[eid] = 0;
            Velocity.z[eid] = 0;
        }
      }
    }
  }
  return currentWorld; // Standard system return.
}

/**
 * Initializes or resets the state of the festival system.
 * This function sets all festival-related state variables to their default initial values.
 * It's typically called at the beginning of a new simulation or when a full world reset is performed.
 */
export function initializeFestivalState() {
  ticksWithHighHappiness = 0;
  isSpiralDanceActive = false;
  festivalEndTick = 0;
  currentTick = 0; // Reset local tick counter for the system.
  console.log("Festival system state initialized.");
}
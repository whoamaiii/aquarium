import { world } from './world'
import { movementSystem } from './systems'
import { boidsComputeSystem, initBoidsComputeSystem } from './boidsComputeSystem'
import { metabolismSystem } from './metabolismSystem'
import { socialSystem, initializeSocialState } from './socialSystem'
import { festivalSystem, initializeFestivalState } from './festivalSystem'
import { foragingSystem } from './foragingSystem'
import { setCriticalError, clearCriticalError } from './engineState';

/** Target simulation tick rate in Hertz (ticks per second). */
const TICK_RATE = 10 // Hz
/** Interval between ticks in milliseconds. */
const TICK_INTERVAL = 1000 / TICK_RATE

/** Timestamp of the last processed tick, used to maintain a fixed tick rate. */
let lastTickTime = 0
/** Flag indicating whether the WebGPU-based Boids compute system is initialized and ready. */
export let isBoidsGpuSystemReady = false;

/**
 * Executes a single simulation step (tick).
 * This function orchestrates the execution of various systems in a specific order.
 * It handles switching between GPU-accelerated Boids movement and CPU-based movement.
 */
async function engineTick() {
  // Movement system: GPU-accelerated Boids if available, otherwise CPU fallback.
  if (isBoidsGpuSystemReady) {
    await boidsComputeSystem(); // GPU Boids system updates positions and velocities.
    // movementSystem(world); // CPU-based movement is disabled when GPU is active.
  } else {
    movementSystem(world); // Fallback to CPU-based movement system if GPU is not available.
  }

  // Order of other systems:
  // 1. Metabolism: Entities consume energy, digest food.
  metabolismSystem(world);
  // 2. Foraging: Entities may find food.
  foragingSystem(world);
  // 3. Social: Entities interact based on social rules.
  socialSystem(world);
  // 4. Festival: Handles festival-related logic and events.
  festivalSystem(world);
}

/**
 * The main game loop, driven by `requestAnimationFrame`.
 * It aims to call `engineTick` at a fixed rate defined by `TICK_INTERVAL`.
 * @param {number} currentTime - The current time provided by `requestAnimationFrame`.
 */
function gameLoop(currentTime: number) {
  requestAnimationFrame(gameLoop); // Schedule the next frame.

  const deltaTime = currentTime - lastTickTime;

  // If enough time has passed, process one or more simulation ticks.
  if (deltaTime >= TICK_INTERVAL) {
    lastTickTime = currentTime - (deltaTime % TICK_INTERVAL); // Adjust lastTickTime to maintain fixed interval.
    engineTick(); // Execute the simulation logic for one tick.
  }
  // Note: Rendering logic is typically handled by a separate rendering loop (e.g., in a React/Three.js setup),
  // this loop is primarily for the fixed-step physics and game logic simulation.
}

/**
 * Starts the main engine loop and initializes necessary systems.
 * It attempts to initialize the WebGPU Boids system and sets up fallback mechanisms.
 * Also initializes states for other systems like social and festival.
 */
export async function startEngineLoop() {
  clearCriticalError(); // Clear any pre-existing critical errors.

  // Attempt to initialize the WebGPU-based Boids compute system.
  try {
    isBoidsGpuSystemReady = await initBoidsComputeSystem();
    if (isBoidsGpuSystemReady) {
      console.log("Engine Loop: Boids GPU system initialized and active.");
      // If successful, any previous GPU-related critical error might be implicitly resolved
      // or could be explicitly cleared if the error message was specific.
    } else {
      // GPU system failed to initialize (e.g., WebGPU not supported).
      console.warn("Engine Loop: Boids GPU system failed to initialize. Falling back to CPU movement.");
      setCriticalError("Boids GPU acceleration failed to initialize. Using CPU fallback (may be slower).");
    }
  } catch (error: any) {
    // An unexpected error occurred during GPU system initialization.
    console.error("Engine Loop: Error during Boids GPU system initialization:", error);
    isBoidsGpuSystemReady = false; // Ensure fallback to CPU movement.
    setCriticalError(`Error initializing Boids GPU: ${error.message || error}. Using CPU fallback. Check console for details.`);
  }

  // Initialize states for other core systems.
  initializeSocialState();  // e.g., clears relationship maps.
  initializeFestivalState(); // e.g., resets festival timers and states.

  // Start the game loop.
  requestAnimationFrame(gameLoop);
}

/**
 * Reinitializes engine systems, primarily for tasks needed after loading a saved state.
 * This is particularly important for the WebGPU Boids system, which may need
 * its GPU buffers updated with the newly loaded entity data.
 */
export async function reinitializeEngineSystemsAfterLoad(): Promise<void> {
  clearCriticalError(); // Clear critical errors before attempting reinitialization.
  console.log("Reinitializing engine systems after state load...");
  try {
    // Attempt to reinitialize the Boids GPU system.
    // This might involve recreating GPU buffers or updating them with loaded data.
    isBoidsGpuSystemReady = await initBoidsComputeSystem();
    if (isBoidsGpuSystemReady) {
      console.log("Boids GPU system reinitialized successfully after load.");
    } else {
      console.warn("Boids GPU system failed to reinitialize after load. Falling back to CPU movement.");
      setCriticalError("Boids GPU failed to reinitialize after load. Using CPU fallback.");
    }
    // Other systems might also need reinitialization if their state is complex
    // and not fully restored by persistence logic alone.
    // e.g., initializeSocialState(); // This is typically handled by loadState directly.
    // e.g., initializeFestivalState(); // Also typically handled by loadState.

  } catch (error: any) {
    console.error("Error reinitializing engine systems after load:", error);
    isBoidsGpuSystemReady = false; // Ensure fallback to CPU if reinitialization fails.
    setCriticalError(`Error reinitializing Boids GPU after load: ${error.message || error}. Using CPU fallback. Check console for details.`);
  }
  console.log("Engine systems reinitialization attempt finished.");
}
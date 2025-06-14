import { world } from './world'
import { movementSystem } from './systems'
import { boidsComputeSystem, initBoidsComputeSystem } from './boidsComputeSystem'
import { metabolismSystem } from './metabolismSystem'
import { socialSystem, initializeSocialState } from './socialSystem'

const TICK_RATE = 10 // Hz
const TICK_INTERVAL = 1000 / TICK_RATE

let lastTickTime = 0
export let isBoidsGpuSystemReady = false;

async function engineTick() {
  if (isBoidsGpuSystemReady) {
    await boidsComputeSystem(); // GPU Boids overtar bevegelseslogikk
    // movementSystem(world); // CPU-basert bevegelse deaktiveres når GPU er aktiv
                           // Posisjon og hastighet oppdateres nå direkte av boidsComputeSystem
  } else {
    movementSystem(world); // Fallback til CPU-bevegelse hvis GPU ikke er klar
  }

  metabolismSystem(world);

  socialSystem(world);
}

function gameLoop(currentTime: number) {
  requestAnimationFrame(gameLoop)

  const deltaTime = currentTime - lastTickTime

  if (deltaTime >= TICK_INTERVAL) {
    lastTickTime = currentTime - (deltaTime % TICK_INTERVAL)
    engineTick()
  }
  // Rendering logic will be driven by R3F's own loop, 
  // this loop is only for the fixed-step simulation.
}

export async function startEngineLoop() {
  // Prøv å initialisere WebGPU-systemet først
  try {
    isBoidsGpuSystemReady = await initBoidsComputeSystem();
    if (isBoidsGpuSystemReady) {
      console.log("Engine Loop: Boids GPU system initialized and active.");
    } else {
      console.warn("Engine Loop: Boids GPU system failed to initialize. Falling back to CPU movement.");
    }
  } catch (error) {
    console.error("Engine Loop: Error during Boids GPU system initialization:", error);
    isBoidsGpuSystemReady = false;
    console.warn("Engine Loop: Falling back to CPU movement due to error.");
  }

  // Initialiser sosial tilstand (f.eks. relasjonskart)
  initializeSocialState();

  requestAnimationFrame(gameLoop)
} 
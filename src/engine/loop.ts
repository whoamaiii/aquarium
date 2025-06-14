import { world } from './world'
import { movementSystem } from './systems'

const TICK_RATE = 10 // Hz
const TICK_INTERVAL = 1000 / TICK_RATE

let lastTickTime = 0

function engineTick() {
  movementSystem(world)
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

export function startEngineLoop() {
  requestAnimationFrame(gameLoop)
} 
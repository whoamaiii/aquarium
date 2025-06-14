import { defineQuery } from 'bitecs'
import type { IWorld } from 'bitecs'
import { Mood, Position, Velocity, CulturalTag } from './components'
import { world } from './world' // For å få tilgang til alle entiteter for globale sjekker

// --- Konstanter og Tilstand for Festivalen ---
const HAPPINESS_THRESHOLD = 0.8;
const TICKS_FOR_HIGH_HAPPINESS_TO_TRIGGER_FESTIVAL = 30 * 10; // 30 sekunder * 10 ticks/sekund
const FESTIVAL_DURATION_TICKS = 60 * 10; // Festival varer i 60 sekunder

let ticksWithHighHappiness = 0;
export let isSpiralDanceActive = false; // Global flagg for motorløkken
let festivalEndTick = 0; // Når nåværende festival slutter (basert på game ticks)
let currentTick = 0; // Enkel tick-teller for systemet

const moodQuery = defineQuery([Mood]);
const festivalParticipantQuery = defineQuery([Position, Velocity, CulturalTag, Mood]); // Mood for evt. å stoppe dans hvis ulykkelig

// Spiral Dance parametere
const SPIRAL_CENTER = { x: 0, y: 0, z: 0 }; // Dansens sentrum
const SPIRAL_SPEED = 1.5; // Hvor raskt de beveger seg i spiralen
const SPIRAL_RADIUS_GROWTH = 0.1; // Hvor mye radiusen øker per runde/tick
const SPIRAL_ROTATION_SPEED = 0.05; // Hvor raskt de roterer rundt sentrum

export function festivalSystem(currentWorld: IWorld) {
  currentTick++;
  const allMoodEntities = moodQuery(world); // Bruk den globale 'world' for å sjekke alle
  let totalHappiness = 0;
  const populationCount = allMoodEntities.length;

  if (populationCount === 0) return currentWorld;

  // 1. Beregn gjennomsnittlig lykke
  for (let i = 0; i < populationCount; i++) {
    totalHappiness += Mood.happiness[allMoodEntities[i]];
  }
  const averageHappiness = totalHappiness / populationCount;

  // 2. Sjekk om festival skal startes eller stoppes
  if (!isSpiralDanceActive) {
    if (averageHappiness > HAPPINESS_THRESHOLD) {
      ticksWithHighHappiness++;
      if (ticksWithHighHappiness >= TICKS_FOR_HIGH_HAPPINESS_TO_TRIGGER_FESTIVAL) {
        isSpiralDanceActive = true;
        festivalEndTick = currentTick + FESTIVAL_DURATION_TICKS;
        ticksWithHighHappiness = 0; // Nullstill for neste gang
        console.log(`SPIRALDANCE FESTIVAL STARTED! Ends at tick: ${festivalEndTick} (avg happiness: ${averageHappiness.toFixed(2)})`);
        
        // Aktiver dans for alle
        const participants = festivalParticipantQuery(currentWorld);
        for (let i = 0; i < participants.length; i++) {
          CulturalTag.isDancingSpiral[participants[i]] = 1;
        }
      }
    } else {
      ticksWithHighHappiness = 0; // Nullstill hvis lykken faller
    }
  } else { // Festival er aktiv
    if (currentTick >= festivalEndTick || averageHappiness < HAPPINESS_THRESHOLD * 0.7) { // Stopper også hvis lykken faller drastisk
      isSpiralDanceActive = false;
      console.log("SPIRALDANCE FESTIVAL ENDED.");
      const participants = festivalParticipantQuery(currentWorld);
      for (let i = 0; i < participants.length; i++) {
        CulturalTag.isDancingSpiral[participants[i]] = 0;
      }
    }
  }

  // 3. Hvis festivalen er aktiv, få alle til å danse i spiral
  if (isSpiralDanceActive) {
    const dancers = festivalParticipantQuery(currentWorld);
    for (let i = 0; i < dancers.length; i++) {
      const eid = dancers[i];
      if (CulturalTag.isDancingSpiral[eid] === 1) {
        const posX = Position.x[eid];
        // const posY = Position.y[eid]; // Y holdes for nå, kan gjøres om til 3D spiral
        const posZ = Position.z[eid];

        // Beregn relativ posisjon til sentrum for vinkel og radius
        const dX = posX - SPIRAL_CENTER.x;
        const dZ = posZ - SPIRAL_CENTER.z;
        
        let currentAngle = Math.atan2(dZ, dX);
        let currentRadius = Math.sqrt(dX * dX + dZ * dZ);

        // Bevegelse utover og roterende
        currentAngle += SPIRAL_ROTATION_SPEED; // Roter
        currentRadius += SPIRAL_RADIUS_GROWTH * (1 / (currentRadius + 1)) * 0.1; // Voks, saktere jo lenger ute
        currentRadius = Math.max(1, currentRadius); // Unngå null radius

        const targetX = SPIRAL_CENTER.x + currentRadius * Math.cos(currentAngle);
        const targetZ = SPIRAL_CENTER.z + currentRadius * Math.sin(currentAngle);
        // Y-posisjon kan være fast, eller f.eks. bølge opp og ned
        const targetY = SPIRAL_CENTER.y + Math.sin(currentAngle * 5 + currentTick * 0.1) * 5; 

        // Beregn hastighet mot målet
        const dirX = targetX - posX;
        const dirY = targetY - Position.y[eid]; // Bruk Position.y for 3D bevegelse
        const dirZ = targetZ - posZ;
        
        const distToTarget = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
        
        if (distToTarget > 0.1) { // Bare sett ny hastighet hvis vi ikke er for nærme
            const invDist = SPIRAL_SPEED / distToTarget;
            Velocity.x[eid] = dirX * invDist;
            Velocity.y[eid] = dirY * invDist;
            Velocity.z[eid] = dirZ * invDist;
        } else {
            // Stå mer eller mindre stille hvis målet er nådd for denne ticken
            Velocity.x[eid] = 0;
            Velocity.y[eid] = 0;
            Velocity.z[eid] = 0;
        }
      }
    }
  }
  return currentWorld;
}

// Funksjon for å initialisere festival-systemets tilstand (kan kalles ved oppstart)
export function initializeFestivalState() {
  ticksWithHighHappiness = 0;
  isSpiralDanceActive = false;
  festivalEndTick = 0;
  currentTick = 0;
  console.log("Festival system state initialized.");
} 
import { addComponent, addEntity, type IWorld } from 'bitecs' // Added IWorld for type annotation
import {
  Position,
  Velocity,
  Genome,
  Phenotype,
  Stomach,
  Energy,
  Mood,
  CulturalTag,
} from './components'
import { world } from './world'

/** The default number of entities to create when the simulation starts. */
const NUM_ENTITIES = 10000

/**
 * Initializes the default set of entities in the simulation.
 * This function populates the `bitECS` world with a predefined number of entities,
 * each configured with a standard set of components and initial randomized or default values.
 * This serves as the starting state for the simulation.
 * @param {IWorld} currentWorld - The bitECS world instance to populate.
 */
export function initializeEntities(currentWorld: IWorld = world) { // Default to global world, allow override for testing
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const eid = addEntity(currentWorld); // Create a new entity

    // --- Movement Components ---
    // Assigns a position to the entity.
    addComponent(currentWorld, Position, eid);
    // Initialize position randomly within a defined cube (e.g., -50 to +50 for each axis).
    Position.x[eid] = Math.random() * 100 - 50; // Random X between -50 and 50
    Position.y[eid] = Math.random() * 100 - 50; // Random Y between -50 and 50
    Position.z[eid] = Math.random() * 100 - 50; // Random Z between -50 and 50

    // Assigns a velocity to the entity.
    addComponent(currentWorld, Velocity, eid);
    // Initialize velocity randomly, creating varied initial movement.
    Velocity.x[eid] = (Math.random() - 0.5) * 2; // Random X-velocity between -1 and 1
    Velocity.y[eid] = (Math.random() - 0.5) * 2; // Random Y-velocity between -1 and 1
    Velocity.z[eid] = (Math.random() - 0.5) * 2; // Random Z-velocity between -1 and 1

    // --- Creature Feature Components ---
    // Assigns a genome to the entity.
    addComponent(currentWorld, Genome, eid);
    Genome.id[eid] = i; // Simple unique ID based on loop index; placeholder for more complex genetics.

    // Assigns a phenotype (visual characteristics) to the entity.
    addComponent(currentWorld, Phenotype, eid);
    Phenotype.r[eid] = Math.random();       // Random red color component.
    Phenotype.g[eid] = Math.random();       // Random green color component.
    Phenotype.b[eid] = Math.random();       // Random blue color component.
    Phenotype.size[eid] = 0.5 + Math.random() * 0.5; // Random size between 0.5 and 1.0.

    // Assigns a stomach to the entity for digestion.
    addComponent(currentWorld, Stomach, eid);
    Stomach.foodTypeToDigest[eid] = 0; // Stomach is initially empty.
    Stomach.amountToDigest[eid] = 0;   // No food amount initially.

    // Assigns energy levels to the entity.
    addComponent(currentWorld, Energy, eid);
    Energy.current[eid] = 70 + Math.random() * 30; // Initial energy between 70 and 100.
    Energy.max[eid] = 100;                         // Maximum energy capacity.

    // Assigns a mood state to the entity.
    addComponent(currentWorld, Mood, eid);
    Mood.happiness[eid] = 0; // Starts with a neutral mood.

    // --- Cultural Components ---
    // Assigns cultural tags or states to the entity.
    addComponent(currentWorld, CulturalTag, eid);
    CulturalTag.isDancingSpiral[eid] = 0; // Entity is not participating in a spiral dance at start.
  }
  console.log(
    `Initialized ${NUM_ENTITIES} entities with Position, Velocity, Genome, Phenotype, Stomach, Energy, and Mood.`,
  )
} 
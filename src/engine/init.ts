import { addComponent, addEntity } from 'bitecs'
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

const NUM_ENTITIES = 10000

export function initializeEntities() {
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const eid = addEntity(world)

    // Bevegelseskomponenter (eksisterende)
    addComponent(world, Position, eid)
    Position.x[eid] = Math.random() * 100 - 50 // Tilfeldig X mellom -50 og 50
    Position.y[eid] = Math.random() * 100 - 50 // Tilfeldig Y mellom -50 og 50
    Position.z[eid] = Math.random() * 100 - 50 // Tilfeldig Z mellom -50 og 50

    addComponent(world, Velocity, eid)
    // Initial hastighet kan settes her hvis ønskelig, f.eks. tilfeldig eller null
    Velocity.x[eid] = (Math.random() - 0.5) * 2 // Tilfeldig X-hastighet mellom -1 og 1
    Velocity.y[eid] = (Math.random() - 0.5) * 2 // Tilfeldig Y-hastighet mellom -1 og 1
    Velocity.z[eid] = (Math.random() - 0.5) * 2 // Tilfeldig Z-hastighet mellom -1 og 1

    // Nye kreaturkomponenter
    addComponent(world, Genome, eid)
    Genome.id[eid] = i // Enkel unik ID basert på loop-indeks

    addComponent(world, Phenotype, eid)
    Phenotype.r[eid] = Math.random() // Tilfeldig rødfarge
    Phenotype.g[eid] = Math.random() // Tilfeldig grønnfarge
    Phenotype.b[eid] = Math.random() // Tilfeldig blåfarge
    Phenotype.size[eid] = 0.5 + Math.random() * 0.5 // Størrelse mellom 0.5 og 1.0

    addComponent(world, Stomach, eid)
    Stomach.foodTypeToDigest[eid] = 0 // Tom mage ved start
    Stomach.amountToDigest[eid] = 0

    addComponent(world, Energy, eid)
    Energy.current[eid] = 70 + Math.random() * 30 // Energi mellom 70 og 100
    Energy.max[eid] = 100

    addComponent(world, Mood, eid)
    Mood.happiness[eid] = 0 // Nøytral stemning ved start

    // Kulturkomponent
    addComponent(world, CulturalTag, eid)
    CulturalTag.isDancingSpiral[eid] = 0 // Ikke dansende ved start
  }
  console.log(
    `Initialized ${NUM_ENTITIES} entities with Position, Velocity, Genome, Phenotype, Stomach, Energy, and Mood.`,
  )
} 
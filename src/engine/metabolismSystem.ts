import { defineQuery } from 'bitecs'
import type { IWorld } from 'bitecs' // Type-only import for IWorld
import { Energy, Mood, Phenotype, Stomach } from './components'
// import { world } from './world' // Fjernet ubrukt import
import evolutionRules from '@/data/rules/evolution.json' // Vite handles JSON import

// Typer for klarhet - disse bør samsvare med evolution.json strukturen
interface EvolutionRuleTrigger {
  foodType: string;
}

interface EvolutionRuleEffect {
  energyChange?: number;
  moodHappinessChange?: number;
  // Potensielle fremtidige effekter kan legges til her
  // phenotypeRChange?: number; 
  // phenotypeGChange?: number;
  // phenotypeBChange?: number;
  // phenotypeSizeChange?: number;
}

interface EvolutionRule {
  ruleName: string;
  trigger: EvolutionRuleTrigger;
  effect: EvolutionRuleEffect;
}

const rules: EvolutionRule[] = evolutionRules.rules;

// Enkel mapping for foodType string til en ui32 for Stomach.foodTypeToDigest
// Dette er en forenkling. I et større system ville man hatt en sentralisert mat-type registry.
const FOOD_TYPE_MAP: { [key: string]: number } = {
  "sweet": 1,
  // "sour": 2, // Eksempel på fremtidige mattyper
};

const metabolismQuery = defineQuery([Stomach, Energy, Mood, Phenotype]);

const BASAL_METABOLISM_RATE = 0.05; // Energi tapt per tick per entitet

export function metabolismSystem(currentWorld: IWorld) {
  const entities = metabolismQuery(currentWorld);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 1. Basalmetabolisme: Reduser energi litt hver tick
    Energy.current[eid] -= BASAL_METABOLISM_RATE;
    if (Energy.current[eid] < 0) {
      Energy.current[eid] = 0; // Ikke la energien gå under null
      // Her kan man legge til logikk for hva som skjer når en entitet går tom for energi (død, etc.)
    }

    // 2. Fordøyelse: Hvis det er mat i magen
    const foodTypeIdToDigest = Stomach.foodTypeToDigest[eid];
    const foodAmountToDigest = Stomach.amountToDigest[eid];

    if (foodTypeIdToDigest > 0 && foodAmountToDigest > 0) {
      let foodTypeName = "";
      for (const [name, id] of Object.entries(FOOD_TYPE_MAP)) {
        if (id === foodTypeIdToDigest) {
          foodTypeName = name;
          break;
        }
      }

      if (foodTypeName) {
        // Finn og anvend relevant regel
        const rule = rules.find(r => r.trigger.foodType === foodTypeName);
        if (rule) {
          // Anvend effekter
          if (rule.effect.energyChange) {
            Energy.current[eid] += rule.effect.energyChange * foodAmountToDigest; // Skaler med mengde
            if (Energy.current[eid] > Energy.max[eid]) {
              Energy.current[eid] = Energy.max[eid];
            }
            // console.log(`Entity ${eid} digested ${foodTypeName}, energy: ${Energy.current[eid].toFixed(2)}`);
          }
          if (rule.effect.moodHappinessChange) {
            Mood.happiness[eid] += rule.effect.moodHappinessChange * foodAmountToDigest;
            Mood.happiness[eid] = Math.max(-1, Math.min(1, Mood.happiness[eid])); // Begrens mellom -1 og 1
          }

          // TODO: Fremtidig - anvend effekter på Phenotype basert på regler
          // if (rule.effect.phenotypeRChange) Phenotype.r[eid] = Math.max(0, Math.min(1, Phenotype.r[eid] + rule.effect.phenotypeRChange));
          // ... andre phenotype endringer ...
        }
      }
      // Tøm magen etter fordøyelse (eller reduser mengde hvis delvis fordøyelse er ønskelig)
      Stomach.foodTypeToDigest[eid] = 0;
      Stomach.amountToDigest[eid] = 0;
    }
  }
  return currentWorld;
}

// En hjelpefunksjon for å "mate" en entitet (simulerer en Food event)
// Dette er en midlertidig løsning. Ideelt sett ville Food vært en egen entitet
// eller en event-mekanisme ville blitt brukt.
export function feedCreature(entityId: number, foodType: string, amount: number) {
  const foodTypeId = FOOD_TYPE_MAP[foodType];
  if (foodTypeId && Stomach.foodTypeToDigest[entityId] !== undefined) { // Sjekk at entiteten har Stomach
    Stomach.foodTypeToDigest[entityId] = foodTypeId;
    Stomach.amountToDigest[entityId] = amount;
    // console.log(`Entity ${entityId} is about to eat ${amount} of ${foodType}`);
  } else {
    console.warn(`Could not feed entity ${entityId}: Unknown foodType '${foodType}' or entity does not have Stomach component.`);
  }
} 
import { defineQuery } from 'bitecs'
import type { IWorld } from 'bitecs'
import { Position, Energy, Mood } from './components'
import { world } from './world' // Brukes for å få tilgang til alle entiteter i systemet
import socialRulesJson from '@/data/rules/social.json'

// --- Typer og Konstanter ---
interface SocialRulePrecondition {
  distance_lt?: number;
  relationship_gt?: number;
  // Andre forutsetninger kan legges til her
}

interface SocialRuleEffectTarget {
  moodHappinessChange?: number;
  // Andre effekter på målet
}

interface SocialRuleEffectInitiator {
  energyChange?: number;
  // Andre effekter på initiativtaker
}

interface SocialRuleEffect {
  target?: SocialRuleEffectTarget;
  initiator?: SocialRuleEffectInitiator;
  relationshipChange?: number;
}

interface SocialRule {
  verb: string;
  preconditions: SocialRulePrecondition;
  effects: SocialRuleEffect;
}

const SOCIAL_RULES: SocialRule[] = socialRulesJson.rules;

// Global Map for relasjonsstyrker: Map<initiatorEid, Map<targetEid, strength>>
// Styrke går fra -1 (fiendtlig) til 1 (vennlig), 0 er nøytral.
const relationshipStrengths: Map<number, Map<number, number>> = new Map();

const socialQuery = defineQuery([Position, Energy, Mood]);

// --- Hjelpefunksjoner for Relasjoner ---
function getRelationshipStrength(initiatorEid: number, targetEid: number): number {
  const initiatorRelations = relationshipStrengths.get(initiatorEid);
  if (initiatorRelations) {
    return initiatorRelations.get(targetEid) || 0;
  }
  return 0;
}

function updateRelationshipStrength(initiatorEid: number, targetEid: number, change: number): void {
  if (!relationshipStrengths.has(initiatorEid)) {
    relationshipStrengths.set(initiatorEid, new Map());
  }
  if (!relationshipStrengths.has(targetEid)) {
    relationshipStrengths.set(targetEid, new Map());
  }

  const initiatorMap = relationshipStrengths.get(initiatorEid)!;
  const targetMap = relationshipStrengths.get(targetEid)!;

  const currentStrengthInitiatorToTarget = initiatorMap.get(targetEid) || 0;
  // const currentStrengthTargetToInitiator = targetMap.get(initiatorEid) || 0; // Fjernet, da vi oppdaterer symmetrisk uansett

  const newStrength = Math.max(-1, Math.min(1, currentStrengthInitiatorToTarget + change));
  
  initiatorMap.set(targetEid, newStrength);
  targetMap.set(initiatorEid, newStrength); 

  // console.log(`Relationship ${initiatorEid} -> ${targetEid} updated to ${newStrength.toFixed(2)}`);
}

// --- Hovedsystemlogikk ---
export function socialSystem(currentWorld: IWorld) {
  const entities = socialQuery(currentWorld);
  const allEntityIds = socialQuery(world); // Få en stabil liste over alle potensielle mål

  for (let i = 0; i < entities.length; i++) {
    const initiatorEid = entities[i];

    for (let j = 0; j < allEntityIds.length; j++) {
      const targetEid = allEntityIds[j];

      if (initiatorEid === targetEid) continue; // Kan ikke interagere med seg selv

      // For hver regel (foreløpig bare "Groom")
      for (const rule of SOCIAL_RULES) {
        if (rule.verb === "Groom") { // Hardkodet for "Groom" for nå
          let preconditionsMet = true;

          // 1. Sjekk Avstand
          if (rule.preconditions.distance_lt !== undefined) {
            const dX = Position.x[initiatorEid] - Position.x[targetEid];
            const dY = Position.y[initiatorEid] - Position.y[targetEid];
            const dZ = Position.z[initiatorEid] - Position.z[targetEid];
            const distanceSq = dX * dX + dY * dY + dZ * dZ;
            if (distanceSq >= rule.preconditions.distance_lt * rule.preconditions.distance_lt) {
              preconditionsMet = false;
            }
          }

          // 2. Sjekk Relasjonsstyrke
          if (preconditionsMet && rule.preconditions.relationship_gt !== undefined) {
            const strength = getRelationshipStrength(initiatorEid, targetEid);
            if (strength <= rule.preconditions.relationship_gt) {
              preconditionsMet = false;
            }
          }

          // Hvis alle forutsetninger er møtt, utfør handlingen
          if (preconditionsMet) {
            // Anvend effekter på Målet
            if (rule.effects.target?.moodHappinessChange) {
              Mood.happiness[targetEid] += rule.effects.target.moodHappinessChange;
              Mood.happiness[targetEid] = Math.max(-1, Math.min(1, Mood.happiness[targetEid]));
              // console.log(`Entity ${targetEid} groomed by ${initiatorEid}, happiness: ${Mood.happiness[targetEid].toFixed(2)}`);
            }

            // Anvend effekter på Initiativtaker
            if (rule.effects.initiator?.energyChange) {
              Energy.current[initiatorEid] += rule.effects.initiator.energyChange;
              Energy.current[initiatorEid] = Math.max(0, Energy.current[initiatorEid]); // Ikke under 0
              // console.log(`Entity ${initiatorEid} groomed ${targetEid}, energy: ${Energy.current[initiatorEid].toFixed(2)}`);
            }

            // Oppdater relasjonsstyrke
            if (rule.effects.relationshipChange) {
              updateRelationshipStrength(initiatorEid, targetEid, rule.effects.relationshipChange);
            }
            
            // For å unngå at en entitet gjør mange handlinger på én tick, 
            // kan man bryte ut her eller ha en cooldown. For nå, la det være slik.
            // Viktig: En entitet bør ikke kunne stelle samme mål flere ganger i samme tick
            // Dette kan løses ved å la en entitet kun utføre én type sosial handling per tick,
            // eller ha en flaggmekanisme. For denne oppgaven er det ikke spesifisert.
            break; // Gå ut av regel-loopen for denne targetEid etter en vellykket handling
          }
        }
      }
    }
  }
  return currentWorld;
}

// Funksjon for å initialisere relasjonskartet (kan kalles ved oppstart)
// For nå starter vi med et tomt kart, relasjoner dannes dynamisk.
export function initializeSocialState() {
  relationshipStrengths.clear();
  // const entities = socialQuery(world); // Fjernet, da den ikke ble brukt her
  console.log("Social state (relationships) initialized (currently empty).");
} 
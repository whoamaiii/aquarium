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
export const relationshipStrengths: Map<number, Map<number, number>> = new Map();

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
  
  const newStrength = Math.max(-1, Math.min(1, currentStrengthInitiatorToTarget + change));
  
  initiatorMap.set(targetEid, newStrength);
  targetMap.set(initiatorEid, newStrength); 
}

// --- Hovedsystemlogikk ---
export function socialSystem(currentWorld: IWorld) {
  const entities = socialQuery(currentWorld);
  const allEntityIds = socialQuery(world); 

  for (let i = 0; i < entities.length; i++) {
    const initiatorEid = entities[i];

    for (let j = 0; j < allEntityIds.length; j++) {
      const targetEid = allEntityIds[j];

      if (initiatorEid === targetEid) continue; 

      for (const rule of SOCIAL_RULES) {
        if (rule.verb === "Groom") { 
          let preconditionsMet = true;

          if (rule.preconditions.distance_lt !== undefined) {
            const dX = Position.x[initiatorEid] - Position.x[targetEid];
            const dY = Position.y[initiatorEid] - Position.y[targetEid];
            const dZ = Position.z[initiatorEid] - Position.z[targetEid];
            const distanceSq = dX * dX + dY * dY + dZ * dZ;
            if (distanceSq >= rule.preconditions.distance_lt * rule.preconditions.distance_lt) {
              preconditionsMet = false;
            }
          }

          if (preconditionsMet && rule.preconditions.relationship_gt !== undefined) {
            const strength = getRelationshipStrength(initiatorEid, targetEid);
            if (strength <= rule.preconditions.relationship_gt) {
              preconditionsMet = false;
            }
          }

          if (preconditionsMet) {
            if (rule.effects.target?.moodHappinessChange) {
              Mood.happiness[targetEid] += rule.effects.target.moodHappinessChange;
              Mood.happiness[targetEid] = Math.max(-1, Math.min(1, Mood.happiness[targetEid]));
            }

            if (rule.effects.initiator?.energyChange) {
              Energy.current[initiatorEid] += rule.effects.initiator.energyChange;
              Energy.current[initiatorEid] = Math.max(0, Energy.current[initiatorEid]); 
            }

            if (rule.effects.relationshipChange) {
              updateRelationshipStrength(initiatorEid, targetEid, rule.effects.relationshipChange);
            }
            break; 
          }
        }
      }
    }
  }
  return currentWorld;
}

export function initializeSocialState() {
  relationshipStrengths.clear();
  console.log("Social state (relationships) initialized (currently empty).");
}

// For persistence.ts
export function setRelationshipStrengths(newRelationships: Map<number, Map<number, number>>): void {
  relationshipStrengths.clear();
  newRelationships.forEach((innerMap, key) => {
    relationshipStrengths.set(key, new Map(innerMap));
  });
  console.log("Social relationships restored.");
} 
/**
 * @file HUD.tsx
 * This React component renders the Heads-Up Display (HUD) for the simulation.
 * The HUD provides users with at-a-glance information about the current state
 * of the simulation. This includes:
 *
 * - Key simulation statistics:
 *   - Number of active entities (creatures).
 *   - Average mood (happiness) of all entities.
 *
 * - Status of global systems:
 *   - Whether a festival (e.g., "SpiralDance") is currently active.
 *
 * - Information from `engineState.ts`:
 *   (Note: Current implementation directly queries some engine data,
 *   but future enhancements could make it consume `engineState.ts` for
 *   last save time, critical error messages, and saving indicators.)
 *
 * The component periodically polls the simulation world and relevant system states
 * to keep the displayed information up-to-date.
 */
import React, { useState, useEffect } from 'react';
import { world } from '@/engine/world';
import { Mood, Position } from '@/engine/components'; // Position for counting actual creatures
import { isSpiralDanceActive as getFestivalStatus } from '@/engine/festivalSystem';
import { defineQuery } from 'bitecs';

// Definer en query for å telle entiteter (f.eks. de med en Posisjon)
// og en for å hente Mood data.
const creatureQuery = defineQuery([Position]);
const moodQuery = defineQuery([Mood]);

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '10px',
  padding: '10px',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  borderRadius: '5px',
  zIndex: 1000, // Sørg for at den er over lerretet
};

export function HUD() {
  const [creatureCount, setCreatureCount] = useState(0);
  const [averageMood, setAverageMood] = useState(0);
  const [isFestivalActive, setIsFestivalActive] = useState(false);

  useEffect(() => {
    const updateHUDData = () => {
      const creatures = creatureQuery(world);
      setCreatureCount(creatures.length);

      const moodEntities = moodQuery(world);
      if (moodEntities.length > 0) {
        let totalHappiness = 0;
        for (let i = 0; i < moodEntities.length; i++) {
          totalHappiness += Mood.happiness[moodEntities[i]];
        }
        setAverageMood(totalHappiness / moodEntities.length);
      } else {
        setAverageMood(0);
      }

      setIsFestivalActive(getFestivalStatus);
    };

    // Oppdater umiddelbart og deretter med intervall
    updateHUDData();
    const intervalId = setInterval(updateHUDData, 1000); // Oppdater hvert sekund

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={hudStyle}>
      <div>Kreaturer: {creatureCount}</div>
      <div>Gj.sn. Humør: {averageMood.toFixed(2)}</div>
      <div>Festival Aktiv: {isFestivalActive ? 'Ja (SpiralDans!)' : 'Nei'}</div>
    </div>
  );
} 
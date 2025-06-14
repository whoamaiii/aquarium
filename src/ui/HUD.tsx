import React, { useState, useEffect } from 'react';
import { world } from '@/engine/world';
import { Mood, Position } from '@/engine/components'; // Position for å telle faktiske kreaturer
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
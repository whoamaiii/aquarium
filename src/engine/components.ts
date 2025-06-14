import { defineComponent, Types } from 'bitecs'

export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
})

export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
})

// Fase 3: Kreaturkomponenter
export const Genome = defineComponent({
  id: Types.ui32, // Enkelt ID for nå, kan utvides til gen-sekvenser senere
})

export const Phenotype = defineComponent({
  r: Types.f32, // Fargekomponenter (0-1)
  g: Types.f32,
  b: Types.f32,
  size: Types.f32, // Generell størrelse
})

export const Stomach = defineComponent({
  // Representerer hva som er i magen og skal fordøyes
  foodTypeToDigest: Types.ui32, // 0 for tom, ellers en ID som matcher en mat-type
  amountToDigest: Types.f32,    // Mengde av maten
})

export const Energy = defineComponent({
  current: Types.f32,
  max: Types.f32,
})

export const Mood = defineComponent({
  happiness: Types.f32, // F.eks. fra -1 (ulykkelig) til 1 (lykkelig)
  // Andre stemninger kan legges til her (frykt, nysgjerrighet etc.)
}) 
import { useControls, folder } from 'leva'
import { boidsConfig } from '@/engine/boidsComputeSystem'

export function DebugPanel() {
  // Leva vil automatisk synkronisere endringer tilbake til boidsConfig-objektet
  // siden vi sender det inn direkte og Leva muterer det.
  useControls(
    'Boids Simulation', // Hovedmappe navn
    {
      General: folder({
        delta_time: {
          value: boidsConfig.delta_time,
          min: 0.01,
          max: 0.5,
          step: 0.01,
          label: 'Delta Time',
          onChange: (v) => { boidsConfig.delta_time = v; }
        },
        max_speed: {
          value: boidsConfig.max_speed,
          min: 0.1,
          max: 10,
          step: 0.1,
          label: 'Max Speed',
          onChange: (v) => { boidsConfig.max_speed = v; }
        },
        max_force: {
          value: boidsConfig.max_force,
          min: 0.01,
          max: 1.0,
          step: 0.01,
          label: 'Max Force',
          onChange: (v) => { boidsConfig.max_force = v; }
        },
      }),
      Behavior: folder({
        cohesion_factor: {
          value: boidsConfig.cohesion_factor,
          min: 0,
          max: 0.2,
          step: 0.001,
          label: 'Cohesion',
          onChange: (v) => { boidsConfig.cohesion_factor = v; }
        },
        separation_factor: {
          value: boidsConfig.separation_factor,
          min: 0,
          max: 2.0,
          step: 0.01,
          label: 'Separation',
          onChange: (v) => { boidsConfig.separation_factor = v; }
        },
        alignment_factor: {
          value: boidsConfig.alignment_factor,
          min: 0,
          max: 0.2,
          step: 0.001,
          label: 'Alignment',
          onChange: (v) => { boidsConfig.alignment_factor = v; }
        },
      }),
      Perception: folder({
        perception_radius: {
          value: boidsConfig.perception_radius,
          min: 1,
          max: 50,
          step: 0.5,
          label: 'Perception Radius',
          onChange: (v) => { boidsConfig.perception_radius = v; }
        },
        separation_distance: {
          value: boidsConfig.separation_distance,
          min: 0.1,
          max: 10,
          step: 0.1,
          label: 'Separation Distance',
          onChange: (v) => { boidsConfig.separation_distance = v; }
        },
      }),
      WorldBounds: folder({
        world_size_x: {
            value: boidsConfig.world_size_x,
            min: 10,
            max: 500,
            step: 10,
            label: 'World Width (X)',
            onChange: (v) => { boidsConfig.world_size_x = v; }
        },
        world_size_y: {
            value: boidsConfig.world_size_y,
            min: 10,
            max: 500,
            step: 10,
            label: 'World Height (Y)',
            onChange: (v) => { boidsConfig.world_size_y = v; }
        },
        world_size_z: {
            value: boidsConfig.world_size_z,
            min: 10,
            max: 500,
            step: 10,
            label: 'World Depth (Z)',
            onChange: (v) => { boidsConfig.world_size_z = v; }
        },
      }, { collapsed: true }) // Denne mappen starter lukket
    },
    [boidsConfig] // Avhengighet for å sikre at Leva oppdaterer hvis boidsConfig-objektet skulle byttes ut
                  // (selv om vi for øyeblikket muterer det direkte)
  );

  return null; // Leva-panelet rendres globalt, så denne komponenten trenger ikke returnere noe DOM
} 
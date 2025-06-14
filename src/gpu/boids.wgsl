struct Particle {
  pos: vec3<f32>,
  vel: vec3<f32>,
};

struct SimParams {
  num_particles: u32,
  delta_time: f32, // Tidsskritt for simuleringen
  cohesion_factor: f32,
  separation_factor: f32,
  alignment_factor: f32,
  perception_radius: f32,
  separation_distance: f32, // Minimumsavstand for separasjonsregelen
  max_speed: f32,
  max_force: f32, // Maksimal styringskraft
  world_size_x: f32,
  world_size_y: f32,
  world_size_z: f32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> particles_in: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particles_out: array<Particle>;

// Hjelpefunksjon for å begrense en vektor til en maksimal lengde
fn limit(vec: vec3<f32>, max_val: f32) -> vec3<f32> {
  let length_sq = dot(vec, vec);
  if (length_sq > max_val * max_val && length_sq > 0.0) {
    let ratio = max_val / sqrt(length_sq);
    return vec * ratio;
  }
  return vec;
}

// Hjelpefunksjon for periodiske grenser (wrapping)
fn wrap_around(pos: vec3<f32>) -> vec3<f32> {
  var new_pos = pos;
  // Anta at verden er sentrert rundt (0,0,0)
  let half_world_x = params.world_size_x * 0.5;
  let half_world_y = params.world_size_y * 0.5;
  let half_world_z = params.world_size_z * 0.5;

  if (new_pos.x < -half_world_x) { new_pos.x = half_world_x; }
  if (new_pos.x >  half_world_x) { new_pos.x = -half_world_x; }
  if (new_pos.y < -half_world_y) { new_pos.y = half_world_y; }
  if (new_pos.y >  half_world_y) { new_pos.y = -half_world_y; }
  if (new_pos.z < -half_world_z) { new_pos.z = half_world_z; }
  if (new_pos.z >  half_world_z) { new_pos.z = -half_world_z; }
  return new_pos;
}

@compute @workgroup_size(64) // Workgroup size, kan justeres
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= params.num_particles) {
    return;
  }

  var current_pos = particles_in[idx].pos;
  var current_vel = particles_in[idx].vel;

  var cohesion_vec = vec3<f32>(0.0, 0.0, 0.0);
  var separation_vec = vec3<f32>(0.0, 0.0, 0.0);
  var alignment_vec = vec3<f32>(0.0, 0.0, 0.0);
  var perceived_neighbors_cohesion = 0u;
  var perceived_neighbors_separation = 0u;
  var perceived_neighbors_alignment = 0u;

  // Boids logikk loop
  for (var i = 0u; i < params.num_particles; i = i + 1u) {
    if (i == idx) {
      continue;
    }

    let other_pos = particles_in[i].pos;
    let other_vel = particles_in[i].vel;
    let dist = distance(current_pos, other_pos);

    if (dist > 0.0 && dist < params.perception_radius) {
      // Cohesion: Styremot gjennomsnittlig posisjon av naboer
      cohesion_vec = cohesion_vec + other_pos;
      perceived_neighbors_cohesion = perceived_neighbors_cohesion + 1u;

      // Alignment: Styremot gjennomsnittlig hastighet av naboer
      alignment_vec = alignment_vec + other_vel;
      perceived_neighbors_alignment = perceived_neighbors_alignment + 1u;
    }
    
    // Separation: Unngå kollisjoner med nære naboer
    if (dist > 0.0 && dist < params.separation_distance) {
        var diff = current_pos - other_pos;
        diff = normalize(diff) / dist; // Vekt basert på avstand
        separation_vec = separation_vec + diff;
        perceived_neighbors_separation = perceived_neighbors_separation + 1u;
    }
  }

  var acceleration = vec3<f32>(0.0, 0.0, 0.0);

  if (perceived_neighbors_cohesion > 0u) {
    cohesion_vec = cohesion_vec / f32(perceived_neighbors_cohesion);
    var steer_cohesion = cohesion_vec - current_pos; 
    steer_cohesion = limit(steer_cohesion, params.max_force);
    acceleration = acceleration + steer_cohesion * params.cohesion_factor;
  }

  if (perceived_neighbors_alignment > 0u) {
    alignment_vec = alignment_vec / f32(perceived_neighbors_alignment);
    var steer_alignment = alignment_vec; // Direkte bruk av gjennomsnittlig hastighet som ønsket hastighet
    steer_alignment = limit(steer_alignment, params.max_force); 
    acceleration = acceleration + steer_alignment * params.alignment_factor;
  }
  
  if (perceived_neighbors_separation > 0u) {
    separation_vec = separation_vec / f32(perceived_neighbors_separation);
    var steer_separation = separation_vec;
    steer_separation = limit(steer_separation, params.max_force);
    acceleration = acceleration + steer_separation * params.separation_factor;
  }
  
  // Oppdater hastighet og posisjon
  current_vel = current_vel + acceleration * params.delta_time;
  current_vel = limit(current_vel, params.max_speed);
  current_pos = current_pos + current_vel * params.delta_time;
  
  // Bruk grense-håndtering (wrap around)
  current_pos = wrap_around(current_pos);

  particles_out[idx].pos = current_pos;
  particles_out[idx].vel = current_vel;
} 
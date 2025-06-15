// WebGPU Compute Shader for Boids Simulation
// This shader calculates the movement of a flock of boids based on
// cohesion, separation, and alignment rules.

// Defines the structure for individual particle data.
// Each particle has a 3D position and a 3D velocity.
struct Particle {
  pos: vec3<f32>, // Current position (x, y, z)
  vel: vec3<f32>, // Current velocity (vx, vy, vz)
};

// Defines the structure for simulation parameters passed from the CPU.
// These parameters control the behavior of the Boids algorithm.
struct SimParams {
  num_particles: u32,       // Total number of particles currently active in the simulation.
  delta_time: f32,          // Time step for the simulation update (e.g., 1/tick_rate).
  cohesion_factor: f32,     // Strength of the cohesion rule.
  separation_factor: f32,   // Strength of the separation rule.
  alignment_factor: f32,    // Strength of the alignment rule.
  perception_radius: f32,   // Radius within which a boid considers others as neighbors for cohesion/alignment.
  separation_distance: f32, // Minimum distance to trigger separation behavior.
  max_speed: f32,           // Maximum speed a boid can achieve.
  max_force: f32,           // Maximum steering force applicable to a boid.
  world_size_x: f32,        // Extent of the world along the X-axis for boundary handling.
  world_size_y: f32,        // Extent of the world along the Y-axis.
  world_size_z: f32,        // Extent of the world along the Z-axis.
};

// --- GPU Resource Bindings ---
// These bindings connect variables in the shader to GPU buffers created on the CPU side.

// @group(0) @binding(0): Uniform buffer for simulation parameters. Read-only.
// Maps to `simParamsBuffer` on the CPU.
@group(0) @binding(0) var<uniform> params: SimParams;

// @group(0) @binding(1): Storage buffer for input particle data. Read-only by this shader invocation.
// Maps to `particlesInGPUBuffer` on the CPU, containing particle states from the previous tick.
@group(0) @binding(1) var<storage, read> particles_in: array<Particle>;

// @group(0) @binding(2): Storage buffer for output particle data. Read-write.
// Maps to `particlesOutGPUBuffer` on the CPU, where new particle states are written.
@group(0) @binding(2) var<storage, read_write> particles_out: array<Particle>;


// Helper function to limit a vector to a maximum magnitude (length).
// Used to enforce `max_speed` and `max_force`.
fn limit(vec: vec3<f32>, max_val: f32) -> vec3<f32> {
  let length_sq = dot(vec, vec); // Calculate squared length for efficiency.
  if (length_sq > max_val * max_val && length_sq > 0.0) {
    // If length exceeds max_val, scale it down to max_val.
    let ratio = max_val / sqrt(length_sq);
    return vec * ratio;
  }
  return vec; // Return original vector if within limit.
}

// Helper function for periodic boundary conditions (wrapping around the world).
// If a boid goes off one side of the world, it reappears on the opposite side.
fn wrap_around(pos: vec3<f32>) -> vec3<f32> {
  var new_pos = pos;
  // World is assumed to be centered at (0,0,0).
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

// Main compute shader function, executed by each GPU thread.
// `@compute` indicates this is a compute shader.
// `@workgroup_size(64)` defines that 64 threads (invocations) run in a workgroup.
// This must match WORKGROUP_SIZE on the CPU side.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // Get the unique index for this shader invocation (thread).
  // This typically corresponds to the particle index.
  let idx = global_id.x;

  // Boundary check: Ensure this invocation is within the range of active particles.
  // This is important if num_particles is not a multiple of workgroup_size.
  if (idx >= params.num_particles) {
    return; // This thread does no work.
  }

  // Load current particle's state from the input buffer.
  var current_pos = particles_in[idx].pos;
  var current_vel = particles_in[idx].vel;

  // --- Boids Algorithm Accumulators ---
  // Initialize vectors to accumulate forces/steering directions.
  var cohesion_vec = vec3<f32>(0.0, 0.0, 0.0);    // Sum of positions of neighbors for cohesion.
  var separation_vec = vec3<f32>(0.0, 0.0, 0.0);  // Sum of separation vectors from close neighbors.
  var alignment_vec = vec3<f32>(0.0, 0.0, 0.0);   // Sum of velocities of neighbors for alignment.
  // Counters for the number of neighbors perceived for each rule.
  var perceived_neighbors_cohesion = 0u;
  var perceived_neighbors_separation = 0u;
  var perceived_neighbors_alignment = 0u;

  // --- Main Boids Logic Loop ---
  // Iterate through all other particles to calculate interactions.
  for (var i = 0u; i < params.num_particles; i = i + 1u) {
    if (i == idx) {
      continue; // Skip self-comparison.
    }

    let other_pos = particles_in[i].pos;
    let other_vel = particles_in[i].vel;
    let dist = distance(current_pos, other_pos); // Calculate distance to the other particle.

    // --- Cohesion and Alignment Rule ---
    // Check if the other particle is within the perception radius for cohesion and alignment.
    if (dist > 0.0 && dist < params.perception_radius) {
      // Cohesion: Accumulate position of the neighbor.
      // The goal is to steer towards the average position of local flockmates.
      cohesion_vec = cohesion_vec + other_pos;
      perceived_neighbors_cohesion = perceived_neighbors_cohesion + 1u;

      // Alignment: Accumulate velocity of the neighbor.
      // The goal is to steer towards the average heading of local flockmates.
      alignment_vec = alignment_vec + other_vel;
      perceived_neighbors_alignment = perceived_neighbors_alignment + 1u;
    }
    
    // --- Separation Rule ---
    // Check if the other particle is within the separation distance (closer than perception radius).
    if (dist > 0.0 && dist < params.separation_distance) {
        // Calculate a vector pointing away from the close neighbor.
        var diff = current_pos - other_pos;
        // Weight the separation force by inverse distance (stronger for closer neighbors).
        diff = normalize(diff) / dist;
        separation_vec = separation_vec + diff;
        perceived_neighbors_separation = perceived_neighbors_separation + 1u;
    }
  }

  // Initialize acceleration vector for this tick.
  var acceleration = vec3<f32>(0.0, 0.0, 0.0);

  // --- Apply Cohesion ---
  if (perceived_neighbors_cohesion > 0u) {
    cohesion_vec = cohesion_vec / f32(perceived_neighbors_cohesion); // Calculate average position of neighbors.
    var steer_cohesion = cohesion_vec - current_pos; // Desired velocity towards average position.
    steer_cohesion = limit(steer_cohesion, params.max_force); // Limit steering force.
    acceleration = acceleration + steer_cohesion * params.cohesion_factor; // Apply cohesion force.
  }

  // --- Apply Alignment ---
  if (perceived_neighbors_alignment > 0u) {
    alignment_vec = alignment_vec / f32(perceived_neighbors_alignment); // Calculate average velocity of neighbors.
    // The average velocity itself is the desired velocity for alignment.
    var steer_alignment = alignment_vec;
    steer_alignment = limit(steer_alignment, params.max_force); // Limit steering force.
    acceleration = acceleration + steer_alignment * params.alignment_factor; // Apply alignment force.
  }
  
  // --- Apply Separation ---
  if (perceived_neighbors_separation > 0u) {
    separation_vec = separation_vec / f32(perceived_neighbors_separation); // Calculate average separation vector.
    var steer_separation = separation_vec; // Desired velocity away from neighbors.
    steer_separation = limit(steer_separation, params.max_force); // Limit steering force.
    acceleration = acceleration + steer_separation * params.separation_factor; // Apply separation force.
  }
  
  // --- Update Velocity and Position ---
  // Apply accumulated acceleration to current velocity, scaled by delta_time.
  current_vel = current_vel + acceleration * params.delta_time;
  // Limit velocity to maximum speed.
  current_vel = limit(current_vel, params.max_speed);
  // Update position based on new velocity, scaled by delta_time.
  current_pos = current_pos + current_vel * params.delta_time;
  
  // --- Handle World Boundaries ---
  // Apply wrap-around boundary conditions.
  current_pos = wrap_around(current_pos);

  // Store the updated position and velocity in the output buffer.
  particles_out[idx].pos = current_pos;
  particles_out[idx].vel = current_vel;
}
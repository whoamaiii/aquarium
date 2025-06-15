/**
 * @file Manages the WebGPU-accelerated Boids simulation.
 * This system handles the initialization of WebGPU resources,
 * data transfer between CPU (ECS components) and GPU,
 * and the execution of the Boids compute shader each simulation tick.
 */
import { world } from '@/engine/world'
import { Position, Velocity } from '@/engine/components'
import { defineQuery } from 'bitecs'
import boidsShaderCode from '@/gpu/boids.wgsl?raw' // Imports the WGSL shader code as a raw string.

/** Maximum number of entities the GPU buffers are initially sized for. Linked to `init.ts` and shader capabilities. */
const NUM_ENTITIES = 10000; // Matches initial entity count in init.ts, shader needs to handle this max.
/** Workgroup size for the compute shader. Must match the `@workgroup_size` attribute in `boids.wgsl`. */
const WORKGROUP_SIZE = 64; // Matches workgroup_size in boids.wgsl.

/**
 * Configuration object for Boids simulation parameters.
 * These values are sent to the GPU shader and can be dynamically adjusted (e.g., via a UI like Leva)
 * to change the behavior of the Boids flock.
 */
export let boidsConfig = {
  /** Time step for the simulation update. Typically derived from TICK_RATE, but can be adjusted. */
  delta_time: 1 / 10,
  /** Factor determining how strongly boids steer towards the center of mass of their neighbors. */
  cohesion_factor: 0.02,
  /** Factor determining how strongly boids steer to avoid crowding neighbors. */
  separation_factor: 0.8,
  /** Factor determining how strongly boids steer to align their velocity with that of their neighbors. */
  alignment_factor: 0.05,
  /** Radius within which a boid considers other boids as neighbors. */
  perception_radius: 10.0,
  /** Minimum distance boids try to maintain from each other to trigger separation force. */
  separation_distance: 2.0,
  /** Maximum speed a boid can travel. */
  max_speed: 2.0,
  /** Maximum steering force that can be applied to a boid's acceleration. */
  max_force: 0.1,
  /** Size of the world bounds along the X-axis for boid movement. */
  world_size_x: 100.0, // Corresponds to the typical spread in init.ts (-50 to 50)
  /** Size of the world bounds along the Y-axis for boid movement. */
  world_size_y: 100.0,
  /** Size of the world bounds along the Z-axis for boid movement. */
  world_size_z: 100.0,
};

// --- WebGPU Resource Declarations ---
/** The WebGPU device instance, representing a connection to the GPU. */
let device: GPUDevice | null = null;
/** The WebGPU compute pipeline, containing the compiled shader and its configuration. */
let pipeline: GPUComputePipeline | null = null;
/** GPU buffer holding simulation parameters (like boidsConfig and num_particles). */
let simParamsBuffer: GPUBuffer | null = null;
/** GPU buffer holding the input particle data (positions and velocities) for the current tick. */
let particlesInGPUBuffer: GPUBuffer | null = null;
/** GPU buffer where the compute shader writes the output particle data (new positions and velocities). */
let particlesOutGPUBuffer: GPUBuffer | null = null;
/** GPU buffer used for staging data read back from the GPU to the CPU. */
let stagingGPUBuffer: GPUBuffer | null = null;
/** WebGPU bind group, defining how resources (buffers) are bound to the shader. */
let bindGroup: GPUBindGroup | null = null;

/** Query for entities that have Position and Velocity components, managed by the Boids system. */
const particleQuery = defineQuery([Position, Velocity]);

// --- Buffer Layout Definitions ---
/** Number of float32 values per particle (vec3 position + vec3 velocity = 6 floats). */
const PARTICLE_NUM_FLOATS = 6;
/** Stride in bytes for a single particle's data in the GPU buffer. */
const PARTICLE_STRIDE_BYTES = PARTICLE_NUM_FLOATS * Float32Array.BYTES_PER_ELEMENT; // 6 floats * 4 bytes/float = 24 bytes
/** Total size in bytes for the GPU buffer storing all particle data. Sized for NUM_ENTITIES. */
const PARTICLES_BUFFER_SIZE = NUM_ENTITIES * PARTICLE_STRIDE_BYTES;

/**
 * Total size in bytes for the simulation parameters buffer.
 * Calculated based on the number of properties in `boidsConfig` (all f32)
 * plus one u32 for `num_particles`.
 */
const SIM_PARAMS_SIZE = Uint32Array.BYTES_PER_ELEMENT + // For num_particles (u32)
                        (Object.keys(boidsConfig).length) * Float32Array.BYTES_PER_ELEMENT; // For f32 parameters

/**
 * Initializes the WebGPU Boids compute system.
 * This involves:
 * 1. Requesting a WebGPU adapter and device.
 * 2. Creating GPU buffers for simulation parameters and particle data.
 * 3. Compiling the WGSL shader code.
 * 4. Creating a compute pipeline with the compiled shader.
 * 5. Creating a bind group to link GPU buffers to shader bindings.
 * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
 */
export async function initBoidsComputeSystem(): Promise<boolean> {
  // Check for WebGPU support in the browser.
  if (!navigator.gpu) {
    console.error("WebGPU not supported on this browser.");
    return false; // Indicate failure.
  }

  // Request a GPU adapter (physical or virtual GPU).
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter.");
    return false; // Indicate failure.
  }

  // Request a GPU device (logical connection to the GPU).
  device = await adapter.requestDevice();
  if (!device) {
    console.error("Failed to get GPU device.");
    return false; // Indicate failure.
  }

  // --- Create GPU Buffers ---
  // Buffer for simulation parameters (uniform buffer).
  simParamsBuffer = device.createBuffer({
    size: SIM_PARAMS_SIZE,
    // Usage: UNIFORM for shader parameters, COPY_DST to allow writing data from CPU.
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Input buffer for particle data (storage buffer).
  particlesInGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    // Usage: STORAGE for shader read/write access, COPY_DST to allow writing initial data.
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Output buffer for particle data (storage buffer).
  particlesOutGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    // Usage: STORAGE for shader read/write access, COPY_SRC to allow copying data to staging buffer.
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Staging buffer for reading data back to CPU.
  stagingGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    // Usage: MAP_READ to allow CPU to read data, COPY_DST to allow copying data from GPU output buffer.
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // --- Shader and Pipeline Setup ---
  // Create a shader module from the WGSL code.
  const shaderModule = device.createShaderModule({
    code: boidsShaderCode, // Raw WGSL shader string.
  });

  // Create a compute pipeline.
  pipeline = device.createComputePipeline({
    layout: 'auto', // WebGPU infers the bind group layout from the shader.
    compute: {
      module: shaderModule,
      entryPoint: "main", // The main function in the compute shader.
    },
  });

  // --- Bind Group Setup ---
  // Create a bind group to link buffers to shader bindings.
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0), // Get layout from the pipeline (group 0).
    entries: [
      { binding: 0, resource: { buffer: simParamsBuffer } },      // Bind simParamsBuffer to binding 0.
      { binding: 1, resource: { buffer: particlesInGPUBuffer } }, // Bind particlesInGPUBuffer to binding 1.
      { binding: 2, resource: { buffer: particlesOutGPUBuffer } },// Bind particlesOutGPUBuffer to binding 2.
    ],
  });
  
  console.log("Boids Compute System Initialized successfully.");
  return true; // Indicate success.
}

// --- CPU-Side Data Buffers ---
/** CPU-side typed array to hold particle data (positions, velocities) before writing to GPU. */
const particleDataForGPU = new Float32Array(NUM_ENTITIES * PARTICLE_NUM_FLOATS);
/**
 * CPU-side ArrayBuffer for simulation parameters.
 * Uses different views (U32 for num_particles, F32 for boidsConfig) for type-correct access.
 */
const simParamsDataForGPU = new ArrayBuffer(SIM_PARAMS_SIZE);
/** Uint32 view into `simParamsDataForGPU` for `num_particles`. */
const simParamsViewU32 = new Uint32Array(simParamsDataForGPU, 0, 1); // Accesses the first 4 bytes as u32.
/** Float32 view into `simParamsDataForGPU` for `boidsConfig` parameters, offset by the size of `num_particles`. */
const simParamsViewF32 = new Float32Array(simParamsDataForGPU, Uint32Array.BYTES_PER_ELEMENT);

/**
 * Executes the Boids compute shader for one simulation tick.
 * This function performs the following steps:
 * 1. Checks if WebGPU resources are initialized.
 * 2. Prepares particle and simulation parameter data on the CPU.
 * 3. Writes this data to the corresponding GPU buffers.
 * 4. Encodes and dispatches the compute shader commands.
 * 5. Copies the results from the GPU output buffer to a staging buffer.
 * 6. Submits the commands to the GPU queue.
 * 7. Reads the results back from the staging buffer to the CPU.
 * 8. Updates the ECS components (Position, Velocity) with the new data from the GPU.
 */
export async function boidsComputeSystem() {
  // Ensure all necessary WebGPU resources are available.
  if (!device || !pipeline || !bindGroup || !simParamsBuffer || !particlesInGPUBuffer || !particlesOutGPUBuffer || !stagingGPUBuffer) {
    console.warn("Boids Compute System not initialized or critical resources are missing. Skipping GPU update.");
    return;
  }

  const entities = particleQuery(world); // Get all entities with Position and Velocity.
  const numActiveEntities = entities.length; // Actual number of entities to process.

  // --- 1. Prepare data for GPU ---
  // Marshal particle data (Position, Velocity) from ECS components into `particleDataForGPU`.
  for (let i = 0; i < numActiveEntities; i++) {
    const eid = entities[i];
    const offset = i * PARTICLE_NUM_FLOATS; // Calculate base offset for this particle's data.
    particleDataForGPU[offset + 0] = Position.x[eid];
    particleDataForGPU[offset + 1] = Position.y[eid];
    particleDataForGPU[offset + 2] = Position.z[eid];
    particleDataForGPU[offset + 3] = Velocity.x[eid];
    particleDataForGPU[offset + 4] = Velocity.y[eid];
    particleDataForGPU[offset + 5] = Velocity.z[eid];
  }
  // Write the prepared particle data to the GPU input buffer.
  // Only write data for the currently active entities.
  device.queue.writeBuffer(particlesInGPUBuffer, 0, particleDataForGPU, 0, numActiveEntities * PARTICLE_NUM_FLOATS);

  // Prepare simulation parameters data.
  simParamsViewU32[0] = numActiveEntities; // Set the actual number of particles for the shader.
  simParamsViewF32[0] = boidsConfig.delta_time;
  simParamsViewF32[1] = boidsConfig.cohesion_factor;
  simParamsViewF32[2] = boidsConfig.separation_factor;
  simParamsViewF32[3] = boidsConfig.alignment_factor;
  simParamsViewF32[4] = boidsConfig.perception_radius;
  simParamsViewF32[5] = boidsConfig.separation_distance;
  simParamsViewF32[6] = boidsConfig.max_speed;
  simParamsViewF32[7] = boidsConfig.max_force;
  simParamsViewF32[8] = boidsConfig.world_size_x;
  simParamsViewF32[9] = boidsConfig.world_size_y;
  simParamsViewF32[10] = boidsConfig.world_size_z;
  // Write the simulation parameters to the GPU uniform buffer.
  device.queue.writeBuffer(simParamsBuffer, 0, simParamsDataForGPU);

  // --- 2. Create command encoder and dispatch compute shader ---
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass(); // Start a compute pass.
  passEncoder.setPipeline(pipeline);                     // Set the compute pipeline.
  passEncoder.setBindGroup(0, bindGroup);                // Set the bind group for resource access.

  // Calculate the number of workgroups needed based on the number of active entities and workgroup size.
  const numWorkgroups = Math.ceil(numActiveEntities / WORKGROUP_SIZE);
  if (numWorkgroups > 0) { // Ensure at least one workgroup is dispatched if there are entities.
      passEncoder.dispatchWorkgroups(numWorkgroups); // Dispatch the compute shader.
  }
  passEncoder.end(); // End the compute pass.

  // --- 3. Copy result from output buffer to staging buffer ---
  // This command copies the data from the GPU-only output buffer to the staging buffer (mappable by CPU).
  commandEncoder.copyBufferToBuffer(
    particlesOutGPUBuffer,    // Source buffer (output from shader).
    0,                        // Source offset.
    stagingGPUBuffer,         // Destination buffer (staging).
    0,                        // Destination offset.
    numActiveEntities * PARTICLE_STRIDE_BYTES // Size of data to copy (only for active entities).
  );

  // --- 4. Submit commands to the GPU queue ---
  device.queue.submit([commandEncoder.finish()]); // Finish encoding and submit.

  // --- 5. Read results from staging buffer ---
  // Map the staging buffer to make its contents accessible from the CPU.
  // This is an asynchronous operation.
  await stagingGPUBuffer.mapAsync(GPUMapMode.READ, 0, numActiveEntities * PARTICLE_STRIDE_BYTES);
  // Get a copy of the mapped range as an ArrayBuffer.
  const resultsArrayBuffer = stagingGPUBuffer.getMappedRange(0, numActiveEntities * PARTICLE_STRIDE_BYTES);
  // Create a Float32Array view from a slice (copy) of the ArrayBuffer to avoid issues with unmapping.
  const resultsData = new Float32Array(resultsArrayBuffer.slice(0));
  stagingGPUBuffer.unmap(); // Unmap the staging buffer, making it available for reuse by the GPU.

  // --- 6. Update ECS components with results from GPU ---
  // Demarshal the data from `resultsData` back into the ECS Position and Velocity components.
  for (let i = 0; i < numActiveEntities; i++) {
    const eid = entities[i];
    const offset = i * PARTICLE_NUM_FLOATS; // Calculate base offset for this particle's data.
    Position.x[eid] = resultsData[offset + 0];
    Position.y[eid] = resultsData[offset + 1];
    Position.z[eid] = resultsData[offset + 2];
    Velocity.x[eid] = resultsData[offset + 3];
    Velocity.y[eid] = resultsData[offset + 4];
    Velocity.z[eid] = resultsData[offset + 5];
  }
}
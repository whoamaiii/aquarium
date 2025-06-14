import { world } from '@/engine/world'
import { Position, Velocity } from '@/engine/components'
import { defineQuery } from 'bitecs'
import boidsShaderCode from '@/gpu/boids.wgsl?raw'

const NUM_ENTITIES = 10000; // Matcher init.ts
const WORKGROUP_SIZE = 64; // Matcher workgroup_size i boids.wgsl

// Boids parametere (kan gjøres dynamiske senere)
const SIM_PARAMS = {
  delta_time: 1 / 10, // Fra TICK_RATE i loop.ts (10 Hz)
  cohesion_factor: 0.02,
  separation_factor: 0.8,
  alignment_factor: 0.05,
  perception_radius: 10.0,
  separation_distance: 2.0,
  max_speed: 2.0,
  max_force: 0.1,
  world_size_x: 100.0, // Matcher spredningen i init.ts (-50 til 50)
  world_size_y: 100.0,
  world_size_z: 100.0,
};

let device: GPUDevice | null = null;
let pipeline: GPUComputePipeline | null = null;
let simParamsBuffer: GPUBuffer | null = null;
let particlesInGPUBuffer: GPUBuffer | null = null;
let particlesOutGPUBuffer: GPUBuffer | null = null;
let stagingGPUBuffer: GPUBuffer | null = null;
let bindGroup: GPUBindGroup | null = null;

const particleQuery = defineQuery([Position, Velocity]);

// Hver partikkel har pos (vec3) og vel (vec3) = 6 floats
const PARTICLE_NUM_FLOATS = 6;
const PARTICLE_STRIDE_BYTES = PARTICLE_NUM_FLOATS * Float32Array.BYTES_PER_ELEMENT; // 24 bytes
const PARTICLES_BUFFER_SIZE = NUM_ENTITIES * PARTICLE_STRIDE_BYTES;

// SimParams struct: 1 u32 (num_particles) + 11 f32 = 4 + 44 = 48 bytes
// num_particles: u32, delta_time: f32, cohesion_factor: f32, separation_factor: f32, 
// alignment_factor: f32, perception_radius: f32, separation_distance: f32, 
// max_speed: f32, max_force: f32, world_size_x: f32, world_size_y: f32, world_size_z: f32
const SIM_PARAMS_SIZE = Uint32Array.BYTES_PER_ELEMENT + (Object.keys(SIM_PARAMS).length) * Float32Array.BYTES_PER_ELEMENT;

export async function initBoidsComputeSystem(): Promise<boolean> {
  if (!navigator.gpu) {
    console.error("WebGPU not supported on this browser.");
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter.");
    return false;
  }
  device = await adapter.requestDevice();
  if (!device) {
    console.error("Failed to get GPU device.");
    return false;
  }

  // Create buffers
  simParamsBuffer = device.createBuffer({
    size: SIM_PARAMS_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  particlesInGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  particlesOutGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  stagingGPUBuffer = device.createBuffer({
    size: PARTICLES_BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Create shader module
  const shaderModule = device.createShaderModule({
    code: boidsShaderCode,
  });

  // Create pipeline
  pipeline = device.createComputePipeline({
    layout: 'auto', // Let WebGPU infer the layout from the shader
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  // Create bind group
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: simParamsBuffer } },
      { binding: 1, resource: { buffer: particlesInGPUBuffer } },
      { binding: 2, resource: { buffer: particlesOutGPUBuffer } },
    ],
  });
  
  console.log("Boids Compute System Initialized");
  return true;
}

const particleDataForGPU = new Float32Array(NUM_ENTITIES * PARTICLE_NUM_FLOATS);
const simParamsDataForGPU = new ArrayBuffer(SIM_PARAMS_SIZE);
const simParamsViewU32 = new Uint32Array(simParamsDataForGPU, 0, 1);
const simParamsViewF32 = new Float32Array(simParamsDataForGPU, 4);

export async function boidsComputeSystem() {
  if (!device || !pipeline || !bindGroup || !simParamsBuffer || !particlesInGPUBuffer || !particlesOutGPUBuffer || !stagingGPUBuffer) {
    console.warn("Boids Compute System not initialized or resources missing.");
    return;
  }

  const entities = particleQuery(world);
  if (entities.length !== NUM_ENTITIES) {
    // This system assumes a fixed number of entities matching NUM_ENTITIES
    // console.warn(`Mismatch in entity count: ECS (${entities.length}) vs GPU (${NUM_ENTITIES})`);
    // For now, we'll proceed but this could lead to issues if not handled.
    // If entities can change, the GPU setup (buffers, NUM_ENTITIES param) needs to be dynamic.
  }

  // 1. Prepare data for GPU
  // Particle data (pos, vel)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const offset = i * PARTICLE_NUM_FLOATS;
    particleDataForGPU[offset + 0] = Position.x[eid];
    particleDataForGPU[offset + 1] = Position.y[eid];
    particleDataForGPU[offset + 2] = Position.z[eid];
    particleDataForGPU[offset + 3] = Velocity.x[eid];
    particleDataForGPU[offset + 4] = Velocity.y[eid];
    particleDataForGPU[offset + 5] = Velocity.z[eid];
  }
  device.queue.writeBuffer(particlesInGPUBuffer, 0, particleDataForGPU, 0, entities.length * PARTICLE_NUM_FLOATS);

  // Sim params data
  simParamsViewU32[0] = NUM_ENTITIES;
  simParamsViewF32[0] = SIM_PARAMS.delta_time;
  simParamsViewF32[1] = SIM_PARAMS.cohesion_factor;
  simParamsViewF32[2] = SIM_PARAMS.separation_factor;
  simParamsViewF32[3] = SIM_PARAMS.alignment_factor;
  simParamsViewF32[4] = SIM_PARAMS.perception_radius;
  simParamsViewF32[5] = SIM_PARAMS.separation_distance;
  simParamsViewF32[6] = SIM_PARAMS.max_speed;
  simParamsViewF32[7] = SIM_PARAMS.max_force;
  simParamsViewF32[8] = SIM_PARAMS.world_size_x;
  simParamsViewF32[9] = SIM_PARAMS.world_size_y;
  simParamsViewF32[10] = SIM_PARAMS.world_size_z;
  device.queue.writeBuffer(simParamsBuffer, 0, simParamsDataForGPU);

  // 2. Create command encoder and dispatch compute shader
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  const numWorkgroups = Math.ceil(NUM_ENTITIES / WORKGROUP_SIZE);
  passEncoder.dispatchWorkgroups(numWorkgroups);
  passEncoder.end();

  // 3. Copy result from output buffer to staging buffer
  commandEncoder.copyBufferToBuffer(
    particlesOutGPUBuffer,
    0, // Source offset
    stagingGPUBuffer,
    0, // Destination offset
    PARTICLES_BUFFER_SIZE
  );

  // 4. Submit commands
  device.queue.submit([commandEncoder.finish()]);

  // 5. Read results from staging buffer
  await stagingGPUBuffer.mapAsync(GPUMapMode.READ, 0, PARTICLES_BUFFER_SIZE);
  const resultsArrayBuffer = stagingGPUBuffer.getMappedRange(0, PARTICLES_BUFFER_SIZE);
  const resultsData = new Float32Array(resultsArrayBuffer.slice(0)); // Create a copy
  stagingGPUBuffer.unmap();

  // 6. Update ECS components with results from GPU
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const offset = i * PARTICLE_NUM_FLOATS;
    Position.x[eid] = resultsData[offset + 0];
    Position.y[eid] = resultsData[offset + 1];
    Position.z[eid] = resultsData[offset + 2];
    Velocity.x[eid] = resultsData[offset + 3];
    Velocity.y[eid] = resultsData[offset + 4];
    Velocity.z[eid] = resultsData[offset + 5];
  }
} 
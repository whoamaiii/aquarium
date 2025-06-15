/**
 * @file Handles the saving and loading of the entire simulation state
 * to and from the browser's IndexedDB. This includes entity component data
 * (positions, velocities, moods, etc.) and specific states from various systems
 * like the social and festival systems. The state is serialized as JSON,
 * compressed using pako (zlib), and stored as a Uint8Array.
 */
import { world } from './world';
import { resetWorld, addEntity, addComponent, type IWorld } from 'bitecs'; // Added IWorld for type safety in future use
import pako from 'pako';
import {
  Position,
  Velocity,
  Genome,
  Phenotype,
  Stomach,
  Energy,
  Mood,
  CulturalTag,
} from './components';
import {
  relationshipStrengths as getSocialRelationshipsMap,
  setRelationshipStrengths as setSocialRelationships,
  initializeSocialState,
} from './socialSystem';
import {
  ticksWithHighHappiness as getFestivalTicksState,
  isSpiralDanceActive as getFestivalActiveState,
  festivalEndTick as getFestivalEndTickState,
  currentTick as getFestivalCurrentTickState,
  setTicksWithHighHappiness as setFestivalTicks,
  setIsSpiralDanceActive as setFestivalActive,
  setFestivalEndTick,
  setCurrentTick as setFestivalCurrentTick,
  initializeFestivalState,
} from './festivalSystem';
import { setCriticalError, setLastSaveTime, setIsSaving } from './engineState';

// --- IndexedDB Configuration Constants ---
/** Name of the IndexedDB database used for storing simulation state. */
const DB_NAME = 'akvariumDB';
/** Name of the object store within the database where the simulation state is saved. */
const STORE_NAME = 'simulationState';
/** Version of the database schema. Used for handling upgrades in `onupgradeneeded`. */
const DB_VERSION = 1;

/**
 * Array defining which bitECS components should be persisted.
 * Each object in the array specifies:
 *  - `name`: A string key used for serializing this component's data.
 *  - `store`: The actual bitECS component definition (e.g., `Position`, `Velocity`).
 * This list controls what component data is saved and subsequently loaded.
 */
const ComponentsToPersist = [
  { name: 'Position', store: Position },    // Spatial position (x, y, z)
  { name: 'Velocity', store: Velocity },    // Movement velocity (vx, vy, vz)
  { name: 'Genome', store: Genome },        // Genetic makeup (currently simple ID)
  { name: 'Phenotype', store: Phenotype },  // Observable characteristics (color, size)
  { name: 'Stomach', store: Stomach },      // Stomach contents for digestion
  { name: 'Energy', store: Energy },          // Entity energy levels (current, max)
  { name: 'Mood', store: Mood },            // Entity mood (e.g., happiness)
  { name: 'CulturalTag', store: CulturalTag },// Tags for cultural behaviors (e.g., isDancingSpiral)
];

// --- Serialization Interface Definitions ---
// These interfaces define the structure of the data that is serialized to JSON
// and stored in IndexedDB. Understanding this structure is key to debugging
// save/load issues or extending the persistence format.

/**
 * Represents the saved data for a single property of a component (e.g., Position.x).
 * It's an object where keys are property names (like "x", "y", "z") and values are arrays of numbers.
 * The array index corresponds to the entity ID (eid) at the time of saving.
 * @property {number[]} [prop] - An array of numbers, where each number is the value of the property for a given entity.
 */
interface ISavedComponentData { [prop: string]: number[] }

/**
 * Represents the saved data for all persisted components.
 * It's an object where keys are component names (e.g., "Position", "Velocity")
 * and values are `ISavedComponentData` objects for that component.
 * @property {ISavedComponentData} [componentName] - Saved data for a specific component.
 */
interface ISavedComponents { [componentName: string]: ISavedComponentData }

/**
 * Defines the structure for saving the state of the social system.
 * @property {[number, [number, number][]][]} relationships - An array representing the relationship map.
 *   Each top-level entry is `[initiatorEid, arrayOfTargetRelations]`.
 *   `arrayOfTargetRelations` is `[targetEid, strength][]`.
 */
interface ISavedSocialState { relationships: [number, [number, number][]][]; }

/**
 * Defines the structure for saving the state of the festival system.
 * @property {number} ticksWithHighHappiness - Counter for consecutive high happiness ticks.
 * @property {boolean} isSpiralDanceActive - Flag indicating if the festival is active.
 * @property {number} festivalEndTick - Tick number when the current festival ends.
 * @property {number} currentTick - The festival system's internal tick counter at save time.
 */
interface ISavedFestivalState {
  ticksWithHighHappiness: number;
  isSpiralDanceActive: boolean;
  festivalEndTick: number;
  currentTick: number;
}

/**
 * Container for the saved states of various game systems.
 * @property {ISavedSocialState} social - Saved state of the social system.
 * @property {ISavedFestivalState} festival - Saved state of the festival system.
 */
interface ISavedSystemStates {
  social: ISavedSocialState;
  festival: ISavedFestivalState;
}

/**
 * Defines the overall structure of the entire simulation state saved to IndexedDB.
 * @property {number} nextEid - The next available entity ID from `world._nextEid` at save time.
 * @property {number[]} eids - An array of all active entity IDs at save time.
 * @property {number[]} deleted - An array of entity IDs that have been deleted (for bitECS internal reuse).
 * @property {ISavedComponents} components - Contains the data for all persisted components.
 * @property {ISavedSystemStates} systems - Contains the saved states of various game systems.
 * @property {number} timestamp - Timestamp (from `Date.now()`) when the save operation occurred.
 */
interface ISavedWorldState {
  nextEid: number;
  eids: number[];
  deleted: number[];
  components: ISavedComponents;
  systems: ISavedSystemStates;
  timestamp: number;
}

// --- IndexedDB Helper Functions ---

/**
 * Opens (and upgrades if necessary) the IndexedDB database.
 * This function handles the creation of the object store if it doesn't exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the IDBDatabase instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Called if the database version changes or if the database is new.
    request.onupgradeneeded = (event) => {
      const dbTarget = event.target as IDBOpenDBRequest;
      if (dbTarget && dbTarget.result) {
        const db = dbTarget.result;
        // Create the object store if it doesn't already exist.
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    };

    request.onsuccess = (event) => {
      const dbTarget = event.target as IDBOpenDBRequest;
      if (dbTarget && dbTarget.result) {
        resolve(dbTarget.result); // Database opened successfully.
      } else {
        reject('Error opening IndexedDB: Event target or result is null');
      }
    };

    request.onerror = (event) => {
        const dbTarget = event.target as IDBOpenDBRequest;
        reject('Error opening IndexedDB: ' + (dbTarget ? dbTarget.error : 'Unknown error'));
    };
  });
}

/**
 * Retrieves data from the IndexedDB object store by key.
 * @param {string} key - The key of the data to retrieve (e.g., "worldState").
 * @returns {Promise<Uint8Array | undefined>} A promise that resolves with the data (as Uint8Array) or undefined if not found.
 */
async function dbGet(key: string): Promise<Uint8Array | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key) as IDBRequest<Uint8Array | undefined>;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Error getting data from IndexedDB: ' + request.error);
  });
}

/**
 * Stores data into the IndexedDB object store.
 * @param {string} key - The key under which to store the data (e.g., "worldState").
 * @param {Uint8Array} value - The data to store (as Uint8Array, typically compressed).
 * @returns {Promise<void>} A promise that resolves when the data is successfully stored.
 */
async function dbSet(key: string, value: Uint8Array): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error setting data in IndexedDB: ' + request.error);
  });
}

// --- Save State Logic ---

/**
 * Saves the entire current simulation state to IndexedDB.
 * The process involves:
 * 1. Collecting data for all entities and their persisted components.
 * 2. Collecting state from relevant systems (social, festival).
 * 3. Gathering bitECS internal metadata (`_nextEid`, `_eids`, `_deleted`).
 * 4. Serializing the collected state to a JSON string.
 * 5. Compressing the JSON string using pako (zlib).
 * 6. Storing the compressed data in IndexedDB.
 * Updates global engine state (`isSaving`, `lastSaveTime`, `criticalErrorMessage`).
 */
export async function saveState(): Promise<void> {
  setIsSaving(true); // Notify UI/engine that saving is in progress.
  try {
    console.log('Starting to save state...');
    const internalWorld = world as any; // Cast to access bitECS internal properties.
    // `maxEid` is used to slice component arrays, ensuring only relevant data up to the highest used EID is saved.
    const maxEid = internalWorld._nextEid;

    // --- Component Data Collection ---
    // Iterate through `ComponentsToPersist` to gather data for each specified component.
    const componentData: ISavedComponents = {};
    ComponentsToPersist.forEach(comp => {
      componentData[comp.name] = {};
      for (const propKey in comp.store) {
        // Ensure only actual data arrays (TypedArrays) are processed, not internal properties like `_tid`.
        if (ArrayBuffer.isView(comp.store[propKey as keyof typeof comp.store])) {
            const typedArray = comp.store[propKey as keyof typeof comp.store] as unknown as ArrayLike<number>;
            // Convert TypedArray to a regular array and slice it up to `maxEid`.
            // This ensures that data for entities beyond `maxEid` (if any) is not included.
            componentData[comp.name][propKey] = Array.from(typedArray).slice(0, maxEid);
        }
      }
    });

    // --- System States Collection ---
    // Retrieve and structure data from the social system (relationship map).
    const socialRelationships = getSocialRelationshipsMap; // Assumes this getter returns the Map.
    const systemStates: ISavedSystemStates = {
      social: {
        // Convert Map-based relationship data to a serializable array format.
        relationships: Array.from(socialRelationships.entries()).map(([eid1, innerMap]: [number, Map<number, number>]) => {
          return [eid1, Array.from(innerMap.entries())] as [number, [number, number][]];
        })
      },
      // Retrieve and structure data from the festival system.
      festival: {
        ticksWithHighHappiness: getFestivalTicksState,
        isSpiralDanceActive: getFestivalActiveState,
        festivalEndTick: getFestivalEndTickState,
        currentTick: getFestivalCurrentTickState,
      }
    };

    // --- Assemble Full State Object ---
    // Combine all collected data into the `ISavedWorldState` structure.
    const fullState: ISavedWorldState = {
      nextEid: internalWorld._nextEid, // Next available EID.
      eids: Array.from(internalWorld._eids as ArrayLike<number>).slice(0, maxEid), // List of active EIDs.
      deleted: Array.from(internalWorld._deleted as ArrayLike<number>).slice(0, internalWorld._deleted.length), // List of deleted EIDs.
      components: componentData,    // All persisted component data.
      systems: systemStates,        // Saved states of various systems.
      timestamp: Date.now(),        // Timestamp of the save operation.
    };

    // --- Serialization, Compression, and Storage ---
    const jsonString = JSON.stringify(fullState);      // Serialize to JSON.
    const compressed = pako.deflate(jsonString);       // Compress JSON string using zlib.
    await dbSet('worldState', compressed);             // Store compressed data in IndexedDB under 'worldState' key.

    setLastSaveTime(Date.now()); // Update global state with the time of this successful save.
    console.log(`State saved successfully. Size: ${jsonString.length} bytes, Compressed: ${compressed.length} bytes`);
  } catch (error: any) {
    // Handle errors during the save process.
    console.error('Failed to save state:', error);
    setCriticalError(`Failed to save simulation state: ${error.message || error}. Check console.`);
    // Note: The error is not re-thrown here to allow the application to potentially continue
    // running even if saving fails. The critical error message will be available to the UI.
  } finally {
    setIsSaving(false); // Notify UI/engine that saving process has completed (success or fail).
  }
}

// --- Load State Logic ---

/**
 * Loads the simulation state from IndexedDB.
 * The process involves:
 * 1. Retrieving compressed data from IndexedDB.
 * 2. Decompressing and parsing the JSON data.
 * 3. Resetting the current world and system states.
 * 4. Re-creating entities and mapping old entity IDs to new ones.
 * 5. Restoring component data for each new entity based on its old ID.
 * 6. Restoring specific system states (social, festival) using the EID map.
 * Updates global engine state (`criticalErrorMessage`) in case of failure.
 * @returns {Promise<boolean>} True if loading was successful, false otherwise.
 */
export async function loadState(): Promise<boolean> {
  try {
    console.log('Starting to load state...');
    // 1. Retrieve and Decompress Data
    const compressedState = await dbGet('worldState'); // Get data from IndexedDB.
    if (!compressedState) {
      console.log('No saved state found in IndexedDB.');
      // Initialize systems to a default state if no save data is found.
      initializeSocialState();
      initializeFestivalState();
      return false; // Indicate that no state was loaded.
    }

    const jsonString = pako.inflate(compressedState, { to: 'string' }); // Decompress.
    const loadedFullState = JSON.parse(jsonString) as ISavedWorldState; // Parse JSON to ISavedWorldState.

    // 2. Reset World and Initialize Systems
    // Ensure a clean slate before populating with loaded data.
    resetWorld(world);              // Clear all entities and component data from the current world.
    initializeSocialState();        // Reset social system state (e.g., clear relationship map).
    initializeFestivalState();      // Reset festival system state.
    console.log('World and system states reset.');

    // 3. Create Entity ID Map and Re-create Entities
    // This map is crucial for correctly linking data from old EIDs to newly created EIDs.
    const oldToNewEidMap = new Map<number, number>();
    if (loadedFullState.eids && loadedFullState.eids.length > 0) {
      // Iterate through the list of EIDs that were active at the time of saving.
      loadedFullState.eids.forEach(oldEid => {
        // Ensure the oldEID is within the bounds of the saved component data arrays.
        // `loadedFullState.nextEid` was the `_nextEid` at save time.
        if (oldEid < loadedFullState.nextEid) {
          const newEid = addEntity(world);        // Create a new entity in the current world.
          oldToNewEidMap.set(oldEid, newEid); // Map the old EID to the new EID.
        }
      });
      console.log(`Created ${oldToNewEidMap.size} new entities and mapped old eIDs.`);
    } else {
      // If no EIDs were saved, it's effectively an empty state or an issue with the save file.
      console.log('No entities to load from saved state or eids list is empty.');
      initializeSocialState(); // Ensure systems are in a valid initial state.
      initializeFestivalState();
      return true; // Consider this a "successful" load of an empty state.
    }
    
    // 4. Restore Component Data
    // Iterate through each component type that was persisted.
    ComponentsToPersist.forEach(comp => {
      const savedCompData = loadedFullState.components[comp.name]; // Get saved data for this component type.
      if (savedCompData) {
        // Iterate through the mapped EIDs (oldEid -> newEid).
        oldToNewEidMap.forEach((newEid, oldEid) => {
          // Check if the old entity actually had this component by seeing if any property has data.
          // This assumes that if an entity had a component, at least one of its properties
          // would have a defined value in the saved data arrays (indexed by oldEid).
          let componentHasDataForOldEid = false;
          for (const propKey in comp.store) {
            if (ArrayBuffer.isView(comp.store[propKey as keyof typeof comp.store]) &&
                savedCompData[propKey] &&
                savedCompData[propKey][oldEid] !== undefined) {
              componentHasDataForOldEid = true;
              break;
            }
          }

          if (componentHasDataForOldEid) {
            addComponent(world, comp.store, newEid); // Add the component to the new entity.
            // Copy property values from saved data (indexed by oldEid) to the new entity's component (indexed by newEid).
            for (const propKey in comp.store) {
              if (ArrayBuffer.isView(comp.store[propKey as keyof typeof comp.store]) &&
                  savedCompData[propKey] &&
                  savedCompData[propKey][oldEid] !== undefined) {
                (comp.store[propKey as keyof typeof comp.store] as any)[newEid] = savedCompData[propKey][oldEid];
              }
            }
          }
        });
      }
    });
    console.log('Component data restored for new eIDs.');

    // 5. Restore System States
    if (loadedFullState.systems) {
      // --- Social System State Restoration ---
      if (loadedFullState.systems.social && loadedFullState.systems.social.relationships) {
        const newRelationships = new Map<number, Map<number, number>>();
        // Iterate through the saved relationship data.
        loadedFullState.systems.social.relationships.forEach(([oldInitiatorEid, relations]) => {
          const newInitiatorEid = oldToNewEidMap.get(oldInitiatorEid); // Map old initiator EID to new.
          if (newInitiatorEid !== undefined) {
            const newInnerMap = new Map<number, number>();
            relations.forEach(([oldTargetEid, strength]) => {
              const newTargetEid = oldToNewEidMap.get(oldTargetEid); // Map old target EID to new.
              if (newTargetEid !== undefined) {
                newInnerMap.set(newTargetEid, strength);
              }
            });
            if (newInnerMap.size > 0) {
              newRelationships.set(newInitiatorEid, newInnerMap);
            }
          }
        });
        setSocialRelationships(newRelationships); // Set the restored relationship map in the social system.
        console.log('Social relationships restored with new eIDs.');
      } else {
        initializeSocialState(); // Fallback if social system data is missing.
      }

      // --- Festival System State Restoration ---
      // These are simple state variables and don't require EID mapping.
      if (loadedFullState.systems.festival) {
        setFestivalTicks(loadedFullState.systems.festival.ticksWithHighHappiness || 0);
        setFestivalActive(loadedFullState.systems.festival.isSpiralDanceActive || false);
        setFestivalEndTick(loadedFullState.systems.festival.festivalEndTick || 0);
        // Note: Restoring `currentTick` might need care if game loop timing is critical.
        // For now, it restores the festival system's internal tick.
        setFestivalCurrentTick(loadedFullState.systems.festival.currentTick || 0);
        console.log('Festival state restored.');
      } else {
        initializeFestivalState(); // Fallback if festival system data is missing.
      }
    } else {
      // Fallback if the entire 'systems' object is missing from the save data.
      initializeSocialState();
      initializeFestivalState();
    }

    console.log(`State loaded successfully. Timestamp: ${new Date(loadedFullState.timestamp).toLocaleString()}`);
    return true; // Indicate successful load.
  } catch (error: any) {
    // Handle errors during the load process.
    console.error('Failed to load state:', error);
    setCriticalError(`Failed to load simulation state: ${error.message || error}. Initializing new world. Check console.`);
    // If loading fails, reset the world and systems to a clean initial state.
    resetWorld(world);
    initializeSocialState();
    initializeFestivalState();
    return false; // Indicate load failure.
  }
}
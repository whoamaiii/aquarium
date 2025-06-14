import { world } from './world';
import { resetWorld } from 'bitecs';
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

const DB_NAME = 'akvariumDB';
const STORE_NAME = 'simulationState';
const DB_VERSION = 1;

// Liste over alle komponenter som skal lagres og lastes.
// Navnet er for serialisering, 'store' er selve bitECS komponent-objektet.
const ComponentsToPersist = [
  { name: 'Position', store: Position },
  { name: 'Velocity', store: Velocity },
  { name: 'Genome', store: Genome },
  { name: 'Phenotype', store: Phenotype },
  { name: 'Stomach', store: Stomach },
  { name: 'Energy', store: Energy },
  { name: 'Mood', store: Mood },
  { name: 'CulturalTag', store: CulturalTag },
];

// Definerer strukturen på det lagrede objektet
interface ISavedComponentData { [prop: string]: number[] }
interface ISavedComponents { [componentName: string]: ISavedComponentData }
interface ISavedSocialState { relationships: [number, [number, number][]][]; }
interface ISavedFestivalState {
  ticksWithHighHappiness: number;
  isSpiralDanceActive: boolean;
  festivalEndTick: number;
  currentTick: number;
}
interface ISavedSystemStates {
  social: ISavedSocialState;
  festival: ISavedFestivalState;
}
interface ISavedWorldState {
  nextEid: number;
  eids: number[];
  deleted: number[];
  components: ISavedComponents;
  systems: ISavedSystemStates;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const dbTarget = event.target as IDBOpenDBRequest;
      if (dbTarget && dbTarget.result) {
        const db = dbTarget.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    };
    request.onsuccess = (event) => {
      const dbTarget = event.target as IDBOpenDBRequest;
      if (dbTarget && dbTarget.result) {
        resolve(dbTarget.result);
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

// --- Lagringslogikk ---
export async function saveState(): Promise<void> {
  try {
    console.log('Starting to save state...');
    const internalWorld = world as any; // Cast for internal properties
    const maxEid = internalWorld._nextEid;

    const componentData: ISavedComponents = {};
    ComponentsToPersist.forEach(comp => {
      componentData[comp.name] = {};
      for (const propKey in comp.store) {
        // Sikrer at vi kun tar med faktiske data-arrays, ikke _tid e.l.
        if (ArrayBuffer.isView(comp.store[propKey as keyof typeof comp.store])) {
            const typedArray = comp.store[propKey as keyof typeof comp.store] as unknown as ArrayLike<number>;
            componentData[comp.name][propKey] = Array.from(typedArray).slice(0, maxEid);
        }
      }
    });

    const socialRelationships = getSocialRelationshipsMap;
    const systemStates: ISavedSystemStates = {
      social: {
        relationships: Array.from(socialRelationships.entries()).map(([eid1, innerMap]: [number, Map<number, number>]) => {
          return [eid1, Array.from(innerMap.entries())] as [number, [number, number][]];
        })
      },
      festival: {
        ticksWithHighHappiness: getFestivalTicksState,
        isSpiralDanceActive: getFestivalActiveState,
        festivalEndTick: getFestivalEndTickState,
        currentTick: getFestivalCurrentTickState,
      }
    };

    const fullState: ISavedWorldState = {
      nextEid: internalWorld._nextEid,
      eids: Array.from(internalWorld._eids as ArrayLike<number>).slice(0, maxEid),
      deleted: Array.from(internalWorld._deleted as ArrayLike<number>).slice(0, internalWorld._deleted.length),
      components: componentData,
      systems: systemStates,
      timestamp: Date.now(),
    };

    const jsonString = JSON.stringify(fullState);
    const compressed = pako.deflate(jsonString);
    await dbSet('worldState', compressed);
    console.log(`State saved successfully. Size: ${jsonString.length} bytes, Compressed: ${compressed.length} bytes`);
  } catch (error) {
    console.error('Failed to save state:', error);
    throw error;
  }
}

// --- Lastingslogikk ---
export async function loadState(): Promise<boolean> {
  try {
    console.log('Starting to load state...');
    const compressedState = await dbGet('worldState');
    if (!compressedState) {
      console.log('No saved state found in IndexedDB.');
      initializeSocialState(); // Sørg for at systemer er i en gyldig starttilstand
      initializeFestivalState();
      return false;
    }

    const jsonString = pako.inflate(compressedState, { to: 'string' });
    const loadedFullState = JSON.parse(jsonString) as ISavedWorldState;
    const internalWorld = world as any; // Cast for internal properties

    // 1. Nullstill verden
    resetWorld(world);
    console.log('World reset.');

    // 2. Gjenopprett bitECS metadata
    internalWorld._nextEid = loadedFullState.nextEid;
    // Fyll _eids og _deleted. Sørg for at arrayene har riktig lengde først om nødvendig.
    // For bitECS, er det viktigere at _nextEid er korrekt, og at _eids og _deleted 
    // reflekterer den lagrede tilstanden. `addComponent` vil vanligvis håndtere _eids.
    // Direkte setting av _eids og _deleted kan være skjørt.
    // Vi stoler på at component data setting for eids < _nextEid vil dekke dette.
    // En mer robust måte er å addEntity for hver eid i loadedFullState.eids og så sette data,
    // men det er tregere. For nå prøver vi direkte restaurering av arrayene.
    // Viktig: .set() for TypedArrays forventer en ArrayLike<number> eller TypedArray.
    // Det er mulig vi må manuelt fylle disse etter å ha satt _nextEid.
    
    // Tøm eksisterende _eids og _deleted før fylling for å unngå duplikater hvis resetWorld ikke er nok
    internalWorld._eids.fill(0); 
    internalWorld._deleted.fill(0);

    loadedFullState.eids.forEach((eid: number, index: number) => { if(index < internalWorld._eids.length) internalWorld._eids[index] = eid; });
    loadedFullState.deleted.forEach((eid: number, index: number) => { if(index < internalWorld._deleted.length) internalWorld._deleted[index] = eid; });
    // Sørg for at lengden på _deleted (som er en queue) er korrekt satt, selv om dette er litt hacky.
    // `world._freeCursor` er den faktiske pekeren for `_deleted`.
    // La oss anta at `resetWorld` og `_nextEid` setting er nok for nå. 
    // Fokus på komponentdata.

    console.log(`Restoring metadata: nextEid=${internalWorld._nextEid}`);

    // 3. Gjenopprett komponentdata
    ComponentsToPersist.forEach(comp => {
      const savedCompData = loadedFullState.components[comp.name];
      if (savedCompData) {
        for (const propKey in comp.store) {
          if (ArrayBuffer.isView(comp.store[propKey as keyof typeof comp.store]) && savedCompData[propKey]) {
            const targetArray = comp.store[propKey as keyof typeof comp.store] as { [index: number]: number; length: number };
            const sourceArray = savedCompData[propKey];
            for(let i = 0; i < sourceArray.length; i++) {
                if (i < targetArray.length) {
                    targetArray[i] = sourceArray[i];
                }
            }
          }
        }
      }
    });
    console.log('Component data restored.');

    // 4. Gjenopprett systemtilstander
    if (loadedFullState.systems) {
      if (loadedFullState.systems.social && loadedFullState.systems.social.relationships) {
        const newRelationships = new Map<number, Map<number, number>>();
        loadedFullState.systems.social.relationships.forEach((entry) => {
          newRelationships.set(entry[0], new Map(entry[1]));
        });
        setSocialRelationships(newRelationships);
      } else {
        initializeSocialState(); // Fallback
      }

      if (loadedFullState.systems.festival) {
        setFestivalTicks(loadedFullState.systems.festival.ticksWithHighHappiness || 0);
        setFestivalActive(loadedFullState.systems.festival.isSpiralDanceActive || false);
        setFestivalEndTick(loadedFullState.systems.festival.festivalEndTick || 0);
        setFestivalCurrentTick(loadedFullState.systems.festival.currentTick || 0);
      } else {
        initializeFestivalState(); // Fallback
      }
    } else {
      initializeSocialState();
      initializeFestivalState();
    }
    console.log('System states restored.');

    console.log(`State loaded successfully. Timestamp: ${new Date(loadedFullState.timestamp).toLocaleString()}`);
    return true;
  } catch (error) {
    console.error('Failed to load state:', error);
    // Hvis lasting feiler, er det best å initialisere systemene til en ren tilstand
    initializeSocialState();
    initializeFestivalState();
    return false;
  }
} 
import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import './index.css'
import { Scene } from '@/components/Scene'
import { initializeEntities } from '@/engine/init'
import { startEngineLoop, reinitializeEngineSystemsAfterLoad } from '@/engine/loop'
import { saveState, loadState } from '@/engine/persistence'

const AUTOSAVE_INTERVAL = 60000; // 1 minutt

function App() {
  const engineInitialized = useRef(false);

  useEffect(() => {
    // Sikre at motor og entiteter kun initialiseres én gang
    if (!engineInitialized.current) {
      console.log("Main.tsx: Initializing entities and starting engine loop...");
      initializeEntities();
      startEngineLoop().then(async () => {
        console.log("Main.tsx: Engine loop started. Attempting initial state load...");
        try {
          const loaded = await loadState();
          if (loaded) {
            console.log("Main.tsx: Initial state loaded successfully. Reinitializing systems...");
            await reinitializeEngineSystemsAfterLoad();
          } else {
            console.log("Main.tsx: No saved state found or load failed. Continuing with fresh state.");
          }
        } catch (error) {
          console.error("Main.tsx: Error during initial loadState:", error);
        }
      }).catch(error => {
        console.error("Main.tsx: Error starting engine loop:", error);
      });
      engineInitialized.current = true;
    }

    // Autolagring
    const saveIntervalId = setInterval(() => {
      console.log("Main.tsx: Autosaving state...");
      saveState().catch(error => console.error("Main.tsx: Autosave failed:", error));
    }, AUTOSAVE_INTERVAL);

    // Manuell lasting
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'l') {
        console.log("Main.tsx: 'L' key pressed. Attempting manual state load...");
        try {
          const loaded = await loadState();
          if (loaded) {
            console.log("Main.tsx: Manual state loaded successfully. Reinitializing systems...");
            await reinitializeEngineSystemsAfterLoad();
          } else {
            console.log("Main.tsx: Manual load found no state or failed.");
          }
        } catch (error) {
          console.error("Main.tsx: Error during manual loadState:", error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Opprydding
    return () => {
      clearInterval(saveIntervalId);
      window.removeEventListener('keydown', handleKeyDown);
      console.log("Main.tsx: Autosave interval and keydown listener cleaned up.");
    };
  }, []); // Tomt avhengighetsarray sikrer at denne effekten kun kjøres én gang (ved mount/unmount)

  return (
    <Canvas camera={{ position: [0, 0, 70], fov: 50 }}>
      <ambientLight intensity={Math.PI / 2} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <Scene />
    </Canvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

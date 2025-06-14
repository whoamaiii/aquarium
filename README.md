# Akvarium Prosjekt

Akvarium er et simuleringsprosjekt bygget med Vite, React, TypeScript, react-three-fiber (R3F), drei, Three.js (med WebGPURenderer), og bitECS. Målet er å simulere et økosystem med tusenvis av interagerende kreaturer med høy ytelse, med fokus på Boids-flokkatferd, grunnleggende metabolisme, sosiale interaksjoner, og kulturelle fenomener som synkronisert dans.

## Funksjoner

*   **ECS-basert motor**: Bruker `bitECS` for effektiv håndtering av titusenvis av entiteter.
*   **GPU-akselerert Boids**: Boids-algoritmen (samling, separasjon, justering) kjøres på GPU via WebGPU compute shaders for maksimal ytelse.
*   **Kreaturlogikk**: Inkluderer komponenter for genom, fenotyp (farge, størrelse), energi, og humør.
*   **Metabolisme**: Enkelt system for energiforbruk og påfyll (simulert).
*   **Sosialt System**: Kreaturer kan utføre handlinger (f.eks. "Groom") som påvirker relasjoner, energi og humør.
*   **Kultur og Festivaler**: System for gruppeatferd, som en "SpiralDance"-festival når globalt humør er høyt.
*   **Lagring/Lasting**: Simuleringstilstanden kan lagres til og lastes fra IndexedDB (automatisk hvert minutt, manuelt med 'L'-tasten).
*   **Dynamisk Debugging**: Et `leva`-basert kontrollpanel for sanntidsjustering av Boids-parametere.
*   **Heads-Up Display (HUD)**: Viser nøkkelinformasjon som antall kreaturer, gjennomsnittlig humør, og festivalstatus.

## Installasjon

For å installere nødvendige avhengigheter, naviger til `akvarium`-mappen (prosjektets rotmappe) og kjør:

```bash
pnpm install
```

(Hvis du foretrekker `npm`, kan du bruke `npm install` i stedet.)

## Kjøre Prosjektet

For å starte utviklingsserveren, kjør fra `akvarium`-mappen:

```bash
pnpm dev
```

Dette vil vanligvis starte applikasjonen på `http://localhost:5173` (eller en annen port hvis 5173 er opptatt).

## Kontroller

*   **Kamerakontroller**: Standard `OrbitControls` fra `@react-three/drei` brukes. Du kan bruke musen til å:
    *   **Venstreklikk + dra**: Rotere kameraet.
    *   **Høyreklikk + dra**: Panorere kameraet.
    *   **Scrollehjul**: Zoome inn og ut.
*   **Lagring/Lasting**:
    *   Simuleringen lagres automatisk til nettleserens IndexedDB hvert minutt.
    *   Trykk på **L**-tasten for å manuelt laste den sist lagrede tilstanden.
*   **Debug-panel**:
    *   Et panel (drevet av `leva`) vises vanligvis øverst til høyre. Dette panelet lar deg justere ulike Boids-parametere (som `cohesionForce`, `separationForce`, `perceptionRadius`, etc.) i sanntid for å observere effekten på flokkatferden.

## Teknologistabel

*   **Byggverktøy**: Vite
*   **Rammeverk/Bibliotek**: React, TypeScript
*   **3D Rendering**: react-three-fiber (R3F), drei, Three.js
*   **GPU Compute**: WebGPU
*   **Entity Component System (ECS)**: bitECS
*   **Komprimering**: pako (for lagring/lasting)
*   **UI Kontrollpanel**: leva

## Mappestruktur (forenklet oversikt i `akvarium/src`)

Prosjektets rotmappe (`akvarium`) inneholder `README.md` (denne filen), `package.json`, `vite.config.ts`, etc.
Kjernelogikken for simuleringen ligger i `akvarium/src/`:

```
/akvarium/src
├── assets/         
├── components/     
├── data/           
├── engine/         
│   ├── components.ts 
│   ├── systems.ts    
│   ├── world.ts      
│   ├── init.ts       
│   ├── loop.ts       
│   ├── boidsComputeSystem.ts 
│   ├── metabolismSystem.ts 
│   ├── socialSystem.ts   
│   ├── festivalSystem.ts 
│   └── persistence.ts  
├── gpu/            
├── hooks/          
├── shaders/        
├── ui/             
├── util/           
├── main.tsx        
└── index.css       
```

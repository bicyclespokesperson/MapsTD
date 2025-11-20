# Maps Tower Defense - Developer Guide

## Project Overview
Maps Tower Defense is a web-based game that combines real-world maps (via OpenStreetMap) with tower defense mechanics. Players select a real-world location, choose a point to defend, and place towers to stop enemies traveling along actual roads.

## Tech Stack
- **Framework**: [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Map Rendering**: [Leaflet](https://leafletjs.com/) (OSM Tiles)
- **Game Engine**: [Phaser 3](https://phaser.io/) (Arcade Physics)
- **Data**: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (Road data)

## Quick Start

### Prerequisites
- Node.js (v16+)
- npm

### Commands
```bash
# Install dependencies
npm install

# Start development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
/src
  /game           # Phaser game logic (Scenes, Sprites, Managers)
    WaveManager.ts  # Handles enemy spawning and waves
    Enemy.ts        # Enemy class and behavior
  
  /assets         # Static assets (images, sounds) - *if applicable*
  
  main.ts         # Entry point, initializes Leaflet and Phaser
  mapSelector.ts  # Handles map area selection UI/Logic
  roadNetwork.ts  # Parses OSM data into game-usable graph
  overpassClient.ts # Fetches data from Overpass API
  coordinateConverter.ts # Bridges Leaflet (Lat/Lng) and Phaser (Pixels)
  style.css       # Global styles
```

## Architecture Summary
The application runs two layers simultaneously:
1.  **Bottom Layer (Leaflet)**: Renders the standard map tiles. Handles panning and zooming of the view.
2.  **Top Layer (Phaser)**: A transparent canvas overlay. Renders game entities (enemies, towers, effects).

**Key Concept**: `CoordinateConverter`
This utility class translates geographic coordinates (Latitude/Longitude) from OpenStreetMap into screen coordinates (x, y) for Phaser. It updates constantly as the user pans or zooms the map to keep game elements anchored to their real-world locations.

## Common Tasks

### 1. Modifying Game Balance
- **Enemy Stats**: Check `src/game/Enemy.ts` for speed, health, and rewards.
- **Wave Logic**: Check `src/game/WaveManager.ts` for spawn rates and wave composition.

### 2. UI/Styling
- **Layout**: `index.html` contains the main structure.
- **Styles**: `src/style.css` handles the look and feel. *Note: We use standard CSS, no preprocessors.*

### 3. Map Data Logic
- **Road Parsing**: `src/roadNetwork.ts` handles converting raw OSM nodes/ways into a connected graph.
- **Data Fetching**: `src/overpassClient.ts` constructs the queries sent to the Overpass API.

## Troubleshooting
- **"Map not loading"**: Check network tab for Overpass API errors. The API can be rate-limited.
- **"Enemies floating"**: Ensure `CoordinateConverter` is being updated in the Phaser `update` loop.

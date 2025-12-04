# Maps Tower Defense

A tower defense game where you defend real-world locations using actual map data and road networks.

[Play the Game Here!](https://bicyclespokesperson.github.io/MapsTD/)

## Concept

Select any area in the real world, choose a point to defend (like a building or landmark), and place towers to stop enemies that travel along actual roads and paths. The game combines real-world geography with classic tower defense mechanics.

## Game Design

### Core Mechanics

- **Map Selection**: Choose a rectangular area (0.5-5 miles per side) on a real-world map
- **Defend Point**: Select a specific location (building, landmark) to protect
- **Enemy Spawning**: Enemies appear at all roads entering the map boundary
- **Enemy Navigation**: Enemies follow actual road geometry using waypoint-based pathfinding
- **Tower Placement**: Place towers anywhere except within a radius of the defend point
- **Lives System**: Start with 10 lives, lose 1 per enemy that reaches the defend point
- **Wave-Based**: Survive waves of enemies with fixed enemy count per wave

### Planned Features

- Multiple tower types with different abilities
- Tower upgrades
- Money/resource system
- Tower statistics (enemies killed, damage dealt)
- Map sharing - players can save and share interesting map configurations
- Variable difficulty based on natural road layout

## Technical Architecture

### Tech Stack

- **Language**: TypeScript
- **Build Tool**: Vite
- **Map Rendering**: Leaflet.js with OpenStreetMap tiles
- **Game Engine**: Phaser 3 (with Arcade Physics)
- **Map Data**: OpenStreetMap via Overpass API
- **Package Manager**: npm

### Architecture Overview

```
┌─────────────────────────────────────┐
│   Leaflet Map Layer                 │  ← Real-world map tiles
│   - OSM tile rendering              │
│   - Map pan/zoom controls           │
│   - Geographic coordinates          │
└─────────────────────────────────────┘
              ↕ Coordinate Conversion
┌─────────────────────────────────────┐
│   Phaser Game Layer                 │  ← Game elements overlay
│   - Towers, enemies, projectiles    │
│   - Physics simulation              │
│   - Screen coordinates              │
└─────────────────────────────────────┘
```

### Key Components

**CoordinateConverter**: Bridges between Leaflet's lat/lng geographic coordinates and Phaser's pixel screen coordinates. Essential for:
- Rendering game elements at correct map positions
- Converting user clicks to map locations
- Calculating distances in real-world meters

**Leaflet Integration**:
- Renders map tiles as background layer
- Handles map interaction (pan, zoom)
- Manages geographic data

**Phaser Integration**:
- Transparent canvas overlay on top of map
- Renders all game elements (towers, enemies, UI)
- Handles game logic and physics
- Updates every frame to track map position changes

## Current Status

### ✅ Completed

- [x] Project setup (Vite + TypeScript)
- [x] Leaflet integration with OSM tiles
- [x] Phaser 3 integration with transparent overlay
- [x] Coordinate conversion system
- [x] Proof of concept: game elements track map positions
- [x] OSM Data Integration
- [x] Map Selection UI
- [x] Enemy Pathfinding
- [x] Tower System with multiple types and upgrades
- [x] Core Game Loop (Waves, Money, Lives)

### 🚧 Next Steps

1. **Polish & Features**
   - Sound effects
   - More enemy types
   - Map save/load system (partially implemented)
   - UI/UX improvements

## Design Decisions

### Why Leaflet + Phaser?

- **Leaflet**: Lightweight, excellent OSM integration, simple API
- **Phaser**: Full game framework with physics, proven for 2D games
- **Overlay approach**: Keeps map rendering separate from game logic, best of both worlds

### Why Waypoint Navigation?

- OSM roads are already polylines (series of points)
- Simple to implement and performant
- Good enough visual fidelity
- Avoids complexity of curved path following

## Development

### Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173/ to see the prototype.

### Build

```bash
npm run build
npm run preview
```

### Deployment

The game is deployed to GitHub Pages.

To deploy a new version:
```bash
npm run deploy
```

## License

MIT
# Maps Tower Defense

A tower defense game where you defend real-world locations using actual map data and road networks.

[Play the Game Here!](https://bicyclespokesperson.github.io/MapsTD/)

## Overview

This project is a tower defense game built with **TypeScript**, **Leaflet.js**, and **Phaser 3**. It leverages real-world map data from OpenStreetMap to create unique game levels where enemies traverse actual road networks.

Players select a defensive area and a point to protect on a real-world map. Towers are then strategically placed to intercept waves of enemies that follow the roads.

## Technologies Used

-   **TypeScript**: For type-safe and scalable code.
-   **Leaflet.js**: For interactive map rendering and handling geographic coordinates.
-   **Phaser 3**: As the game engine for managing game objects, physics, and game logic.
-   **OpenStreetMap (via Overpass API)**: To fetch real-world road network data.
-   **Vite**: For fast development and optimized builds.

## Development

### Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173/ to see the prototype.

### Deployment

The game is deployed to GitHub Pages. To deploy a new version:

```bash
npm run deploy
```

## License

MIT

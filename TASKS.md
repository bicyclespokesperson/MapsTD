# Maps Tower Defense - Development Checklist

## ✅ Foundation (Completed)

- [x] Project setup with Vite + TypeScript
- [x] Leaflet integration with OSM tiles
- [x] Phaser 3 overlay integration
- [x] Coordinate conversion system (lat/lng ↔ pixels)
- [x] Proof of concept: game elements track map positions
- [x] Project documentation (README.md)

## ✅ OSM Data Integration (Completed)

- [x] Overpass API client implementation
- [x] Road data fetching for bounded areas
- [x] Road network parsing into game format
- [x] Road visualization in Phaser overlay
- [x] Boundary crossing detection (segment intersection)
- [x] Entry point identification and visualization

## 🚧 Map Selection & Setup

- [ ] Rectangle selection tool for map boundary
  - [ ] UI to enter drawing mode
  - [ ] Draw rectangle on map by dragging
  - [ ] Visual feedback during drawing
  - [ ] Confirm/cancel selection
- [ ] Defend point selection
  - [ ] Click to place defend point marker
  - [ ] Validate point is inside boundary
  - [ ] Visual radius showing no-build zone
- [ ] Map configuration panel
  - [ ] Display selected area size
  - [ ] Show number of roads/entry points
  - [ ] Estimated difficulty indicator
- [ ] Start game button (locks in map configuration)

## 🎮 Core Game Loop

### Enemy System
- [ ] Enemy class with properties (health, speed, position)
- [ ] Enemy spawning from entry points
  - [ ] Wave-based spawning system
  - [ ] Limit to ~25 enemies on screen
  - [ ] Stagger spawns across entry points
- [ ] Enemy movement along road waypoints
  - [ ] Follow road geometry
  - [ ] Smooth interpolation between waypoints
  - [ ] Speed variations by enemy type
- [ ] Enemy reaches defend point
  - [ ] Remove enemy from game
  - [ ] Deduct 1 life
  - [ ] Visual/audio feedback
- [ ] Enemy death
  - [ ] Award money/resources
  - [ ] Death animation/effect
  - [ ] Remove from game

### Tower System
- [ ] Tower placement UI
  - [ ] Click to enter placement mode
  - [ ] Show valid placement areas (outside no-build zone)
  - [ ] Preview tower range while placing
  - [ ] Cost display and validation
- [ ] Tower class with properties
  - [ ] Position, range, damage, fire rate
  - [ ] Different tower types (basic, sniper, splash, etc.)
  - [ ] Visual representation
- [ ] Tower targeting logic
  - [ ] Find enemies in range
  - [ ] Targeting strategies (first, last, strongest, etc.)
  - [ ] Rotate to face target
- [ ] Tower attacking
  - [ ] Projectile system
  - [ ] Hit detection
  - [ ] Damage calculation
  - [ ] Visual effects
- [ ] Tower upgrades
  - [ ] Upgrade UI (click tower to show options)
  - [ ] Increase damage/range/speed
  - [ ] Cost system for upgrades
  - [ ] Visual changes on upgrade

### Game State Management
- [ ] Lives system (start with 10)
- [ ] Money/resource system
  - [ ] Starting money
  - [ ] Earn on enemy kill
  - [ ] Spend on towers/upgrades
- [ ] Wave system
  - [ ] Wave counter display
  - [ ] Fixed enemies per wave
  - [ ] Wave difficulty progression
  - [ ] Delay between waves
- [ ] Win/lose conditions
  - [ ] Lose: Lives reach 0
  - [ ] Win: Complete X waves
  - [ ] Game over screen with stats

## 🎨 UI/UX

- [ ] HUD (Heads-Up Display)
  - [ ] Lives counter
  - [ ] Money counter
  - [ ] Current wave number
  - [ ] Next wave timer/button
- [ ] Tower selection menu
  - [ ] Show available tower types
  - [ ] Display stats and cost
  - [ ] Keyboard shortcuts
- [ ] Tower info panel
  - [ ] Show selected tower stats
  - [ ] Upgrade options
  - [ ] Sell option
- [ ] Game controls
  - [ ] Pause/resume
  - [ ] Speed up (2x, 4x)
  - [ ] Restart game
- [ ] Visual polish
  - [ ] Road highlighting on hover
  - [ ] Enemy health bars
  - [ ] Tower range circles (show on hover)
  - [ ] Particle effects (explosions, hits)

## 📊 Statistics & Analytics

- [ ] Tower statistics
  - [ ] Enemies killed
  - [ ] Total damage dealt
  - [ ] Shots fired / hit rate
- [ ] Game statistics
  - [ ] Total enemies defeated
  - [ ] Money earned
  - [ ] Waves completed
  - [ ] Time survived
- [ ] End-game summary screen
  - [ ] Display all stats
  - [ ] Performance rating
  - [ ] Share/save results

## 💾 Map Sharing & Persistence

- [ ] Map configuration save/load
  - [ ] Serialize map bounds + defend point
  - [ ] Generate shareable code/URL
  - [ ] Load from code/URL
- [ ] Local storage
  - [ ] Save game progress
  - [ ] Remember last played maps
- [ ] Replay popular maps
  - [ ] Curated map list
  - [ ] Community maps (future)

## 🔧 Performance & Optimization

- [ ] Road rendering optimization
  - [ ] Cull roads outside viewport
  - [ ] Simplify geometry for distant roads
- [ ] Enemy pooling
  - [ ] Reuse enemy objects
  - [ ] Limit active enemies
- [ ] Pathfinding optimization
  - [ ] Cache paths from entry points
  - [ ] Pre-calculate during setup
- [ ] Frame rate monitoring
  - [ ] FPS counter (debug mode)
  - [ ] Performance warnings

## 🎯 Future Enhancements

- [ ] Multiple tower types
  - [ ] Basic: Balanced stats
  - [ ] Sniper: Long range, slow fire
  - [ ] Machine gun: Fast fire, short range
  - [ ] Splash: Area damage
  - [ ] Slow: Reduces enemy speed
- [ ] Enemy types
  - [ ] Fast: Low health, high speed
  - [ ] Tank: High health, slow
  - [ ] Flying: Ignores roads (future)
- [ ] Special abilities
  - [ ] Tower abilities (boost nearby towers, etc.)
  - [ ] Player abilities (air strike, slow time)
- [ ] Terrain features (post-MVP)
  - [ ] Elevation data
  - [ ] Line-of-sight calculations
  - [ ] Height advantages
- [ ] Sound effects & music
  - [ ] Background music
  - [ ] Tower firing sounds
  - [ ] Enemy death sounds
  - [ ] UI click sounds
- [ ] Mobile support
  - [ ] Touch controls
  - [ ] Responsive UI
  - [ ] Performance optimization for mobile

## 🐛 Known Issues & Tech Debt

- [ ] Test with various map sizes and road densities
- [ ] Handle edge cases (no roads, no entry points, etc.)
- [ ] Error handling for Overpass API failures
- [ ] Loading states and progress indicators
- [ ] TypeScript strict mode improvements

---

**Current Status:** OSM Integration Complete ✨
**Next Milestone:** Map Selection & Setup
**Version:** 0.1.0-alpha

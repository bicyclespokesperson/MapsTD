# Game Improvement Ideas

## Known Bug Fixes Needed
- **Helicopter range isn't visible**: The range indicator should be displayed when selecting or hovering over the helicopter tower
- **Helicopter pauses flying when sniper shoots**: If the helicopter is in range of a sniper tower, it incorrectly pauses its patrol movement when the sniper fires

---


## Defense Units on Roads
- **Ground-based defense units** that must follow road networks
  - **Cars**: Fast-moving units with light weapons, good for intercepting enemies
  - **Soldiers**: Slower infantry units that can be deployed at strategic road intersections
  - **Tanks**: Heavy armored vehicles with powerful weapons but slow movement
  - **Armored Personnel Carriers (APCs)**: Can transport soldiers to different road positions
  - **Motorcycles**: Very fast scouts with minimal firepower
  
### Implementation Considerations
- Units would use the existing road pathfinding system
- Could patrol between waypoints or be stationed at specific road locations
- Movement speed affected by road type (highways vs local roads)
- Strategic placement at intersections for maximum coverage
- Potential for traffic management (units blocking each other)

## Elevation-Based Tower Range
- **3D range calculations** that account for terrain elevation
  - Higher elevation = increased range (line of sight advantage)
  - Lower elevation = reduced range (blocked by terrain)
  - Towers on hills could see and shoot further
  - Valleys and depressions create blind spots

### Implementation Details
- Use Google Maps Elevation API to get terrain height data
- Calculate true 3D distance instead of 2D distance
- Visual feedback showing effective range based on elevation
- Bonus range multiplier for height advantage
- Penalty for shooting downhill into valleys
- Consider line-of-sight raytracing for advanced terrain blocking

## Smaller Tower Ranges & Road-Based Shooting
- **Reduce overall tower ranges** to make positioning more strategic and critical
  - Forces players to place towers closer to roads
  - Creates more challenging decisions about coverage vs. cost
  - Increases importance of tower placement and map knowledge
  
- **Road-constrained shooting mechanics**
  - **Line-of-sight towers**: Can only shoot along visible road segments
  - **Road-following projectiles**: Bullets/missiles that travel along road paths to hit targets
  - **Intersection towers**: Specialized towers that excel at road junctions but have limited range
  - **Roadblock towers**: Static defenses placed directly on roads that enemies must pass
  
### Implementation Considerations
- Use road geometry to calculate valid shooting lanes
- Projectiles could pathfind along roads to reach targets
- Visual indicators showing which road segments are covered
- Balance between road-based and traditional area-effect towers
- Curved roads create blind spots and strategic chokepoints
- Highway overpasses and underpasses add vertical complexity

## Additional Ideas

### Tower Enhancements
- **Upgrade system**: Improve existing towers with better range, damage, or special abilities
- **Tower synergies**: Certain tower combinations provide bonuses when placed near each other
- **Specialized towers**:
  - Anti-air towers for flying enemies
  - Slow towers that reduce enemy speed
  - Area-of-effect towers for clustered enemies
  - Sniper towers with extreme range but slow fire rate

### Enemy Variety
- **Flying enemies**: Helicopters, drones that ignore roads
- **Armored enemies**: Require more hits to destroy
- **Fast enemies**: Speed through defenses quickly
- **Boss enemies**: Appear every N waves with massive health
- **Stealth enemies**: Invisible until close to towers

### Map Features
- **Dynamic weather**: Fog reduces tower range, rain slows enemies
- **Day/night cycle**: Different enemy types spawn at night
- **Destructible terrain**: Towers can modify the landscape
- **Bridges and tunnels**: Create chokepoints and strategic opportunities
- **No-build zones**: Forests, water bodies, buildings that restrict tower placement

### Economy & Resources
- **Resource types**: Money, energy, materials
- **Income buildings**: Generators that produce resources over time
- **Tower maintenance costs**: Ongoing cost to keep towers active
- **Sell towers**: Recover partial cost when removing towers
- **Interest system**: Bonus money for saving resources between waves

### Gameplay Modes
- **Endless mode**: Waves continue until defeat
- **Challenge mode**: Specific constraints (limited tower types, restricted budget)
- **Co-op mode**: Multiple players defend the same map
- **PvP mode**: Players send enemies to each other's maps
- **Speedrun mode**: Complete waves as fast as possible

### UI/UX Improvements
- **Tower preview**: Show range and coverage before placing
- **Hotkeys**: Quick access to frequently used towers
- **Wave preview**: See upcoming enemy types before wave starts
- **Statistics**: Track kills, damage, efficiency per tower
- **Replay system**: Watch and share successful defenses

### Real-World Integration
- **Weather sync**: Match in-game weather to real-world conditions
- **Time sync**: Day/night cycle matches real time
- **Traffic data**: Enemy spawn rates influenced by real traffic patterns
- **POI integration**: Special bonuses/penalties for defending landmarks
- **Satellite imagery updates**: Map changes when real-world construction occurs

### Progression System
- **Player levels**: Unlock new towers and abilities
- **Achievement system**: Rewards for completing challenges
- **Tower blueprints**: Discover new tower types through gameplay
- **Persistent upgrades**: Meta-progression that carries between maps
- **Leaderboards**: Compare scores with other players on same maps

### Visual & Audio
- **Particle effects**: Explosions, muzzle flashes, impact effects
- **Sound design**: Unique sounds for each tower and enemy type
- **Camera controls**: Zoom, rotate, tilt for better viewing angles
- **Minimap**: Overview of entire battlefield
- **Damage numbers**: Visual feedback for hits and kills

### Performance Optimizations
- **Level of detail (LOD)**: Reduce detail for distant objects
- **Object pooling**: Reuse projectile and effect objects
- **Spatial partitioning**: Optimize collision and range checks
- **Lazy loading**: Load map data as needed
- **WebGL rendering**: Hardware-accelerated graphics for complex scenes

# Tower Defense Game - Design Questions

## Map Data & Pathfinding

**Q: What's your plan for getting real-world map data?**

- OpenStreetMap is the obvious choice for roads/paths. Are you comfortable with that level of complexity, or would you rather use a simpler mapping API?

A: Probably OpenStreetMap, yeah.

**Q: How would enemies navigate?**

- Follow exact road geometry, or use simplified pathfinding on a road network graph?

A: I think follow exact road geometry? What do you think? How feasible is this to implement?

**Q: How do you handle areas with different road network complexity?**

- What about areas with complex road networks (like downtown areas with grids) vs simple areas (rural roads)? The gameplay could vary wildly.

A: Yeah this is ok, the idea is that the gameplay could vary wildly. You could share a particular map setup, and people could replay the most popular ones.

## Game Mechanics

**Q: How do enemies spawn?**

- Do enemies spawn from all roads entering the map boundary, or specific spawn points (highway entrances, etc.)?

A: Probably all roads. The idea kind of being that if you were actually trying to defend a location, you'd have to assume all the roads might be used

**Q: What are the win/lose conditions?**

- Is it wave-based (survive X waves) or endless? What happens when enemies reach the defended point?

A: Wave based, and you lose if any enemies reach the end point

**Q: Where can towers be placed?**

- Can towers go anywhere, or only in specific locations (adjacent to roads, on buildings, etc.)? Real-world constraints could make this interesting but also frustrating.

A: Not sure how much detail is available, or how complicated to make it. Lets say they can go everywhere

## Balancing & Design Issues

**Q: How do you handle map variability in difficulty?**

- Some areas will be naturally easier/harder to defend based on road layout. A cul-de-sac vs a major intersection would be completely different difficulties. How do you balance this?

A: For starters, lets not worry about balancing it too much. Maybe you have X enemies per wave which is constant, but some maps will be much easier than others. We could make a map setup shareable / loadable, so people could replay popular areas

**Q: What's the typical map size you're envisioning?**

- 500m x 500m? 2km x 2km? This affects how much road data you need to process and render.

A: Maybe a couple square miles? But configurable, say, a rectangle that can be 0.5-5 miles across in each direction.

**Q: Are you using terrain features?**

- Are you using elevation data? Water features? Or just roads on a flat plane?

A: What do you think is best here? I'm thinking roads on a flat plane is easiest to start

**Q: What's the appeal for players?**

- Is part of the appeal that players defend places they know (their neighborhood, workplace)? Or is it about discovering interesting map layouts?

A: Probably both, but especially the first one

## Technology Stack

**Q: What platform are you thinking for implementation?**

- Web-based (Leaflet/Mapbox + JavaScript game engine)?
- Native mobile (would fit the real-world theme)?
- Desktop game?

A: Do you think it's doable in browser in typescript? That would be most accessible for players

**Q: Any preferences on programming language or frameworks?**

A: See above

## Other Considerations

**Q: What aspects of the design are you most uncertain about?**

A: Pathfinding for enemies, maybe? And performance, and making sure the gameplay is engaging

**Q: Any other game mechanics or features you're considering?**

- Different tower types?
- Upgrades?
- Special abilities?
- Multiplayer?

A: Yeah, we'll need different tower types, money, tower upgrades, stats for the towers (enemies killed, that sort of thing). Probably no multiplayer

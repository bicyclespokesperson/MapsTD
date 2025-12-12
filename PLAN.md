# Implementation Plan: Custom Area Selection

## Summary
Add support for selecting non-rectangular (quadrilateral) game areas by clicking 4 corners, enabling gameplay on rotated landmarks like Central Park.

## Architecture Overview

The current system uses `L.LatLngBounds` (axis-aligned rectangles) throughout:
- **MapSelector**: Drag-to-select creates `L.LatLngBounds`
- **MapConfiguration**: Stores/serializes bounds as `{north, south, east, west}`
- **OverpassClient**: Queries roads with rectangular bbox
- **TowerManager/MapConfiguration**: Uses `bounds.contains()` for placement validation
- **RoadNetwork**: Detects boundary crossings on N/S/E/W edges only

The approach: Use option 1 from the feature doc (simpler) - keep rectangular viewport for coordinate conversion, use polygon only for containment checking.

---

## Phase 1: Data Model Changes

### 1.1 Add Polygon Types (`src/mapConfiguration.ts`)
```typescript
interface LatLngPoint {
  lat: number;
  lng: number;
}

interface CustomAreaData {
  corners: [LatLngPoint, LatLngPoint, LatLngPoint, LatLngPoint];
}
```

### 1.2 Update MapConfigData
- Bump version to `2.0.0`
- Add optional `customArea?: CustomAreaData` field
- Keep existing `bounds` for backward compatibility and bbox queries
- When `customArea` is present, `bounds` represents the enclosing bbox of the polygon

### 1.3 Add Point-in-Polygon Utility
Create `src/geometry.ts`:
- `pointInPolygon(point: L.LatLng, corners: L.LatLng[]): boolean` - ray casting algorithm
- `computeBoundingBox(corners: L.LatLng[]): L.LatLngBounds` - get enclosing rectangle

### 1.4 Update MapConfiguration Class
- Add `customArea?: L.LatLng[]` property (4 corners)
- Update constructor to accept optional corners
- Update `isValidTowerPosition()` to use polygon containment when `customArea` is set
- Update `toJSON()` / `fromJSON()` for new format
- Add `isCustomArea(): boolean` helper

**Files modified:** `src/mapConfiguration.ts`, new `src/geometry.ts`

---

## Phase 2: Selection UI

### 2.1 Add Selection Mode Types (`src/mapSelector.ts`)
```typescript
type SelectionType = 'rectangle' | 'custom';
type SelectionMode = 'none' | 'drawing-bounds' | 'clicking-corners' | 'placing-base';
```

### 2.2 Update MapSelector Class
Add new state:
- `selectionType: SelectionType`
- `customCorners: L.LatLng[]` (accumulate up to 4)
- `tempPolygon: L.Polygon | null` (preview during selection)
- `cornerMarkers: L.CircleMarker[]` (show clicked corners)

Add new methods:
- `startCustomSelection()`: Enter 4-click mode
- `onCornerClick()`: Handle each corner click, update preview
- `completeCustomSelection()`: Validate and finalize polygon

### 2.3 Update UI (`index.html`, `src/main.ts`)
- Split "Select Area" into dropdown or two buttons:
  - "Select Rectangle" (existing behavior)
  - "Select Custom Area" (new 4-corner mode)
- Show corner count feedback: "Click corner 1/4", "Click corner 2/4", etc.

### 2.4 Visual Feedback
- After each click, draw small circle marker at corner position
- Draw polygon outline connecting placed corners
- Color-code validity (green valid, red if too small/large)
- Show size tooltip (area or dimensions)

**Files modified:** `src/mapSelector.ts`, `index.html`, `src/main.ts`, `src/style.css`

---

## Phase 3: Containment Logic Updates

### 3.1 MapConfiguration (`src/mapConfiguration.ts`)
Update `isValidTowerPosition()`:
```typescript
isValidTowerPosition(position: L.LatLng): boolean {
  // Check polygon containment if custom area
  if (this.customArea) {
    if (!pointInPolygon(position, this.customArea)) {
      return false;
    }
  } else {
    if (!this.bounds.contains(position)) {
      return false;
    }
  }

  // Existing no-build radius check
  const distanceToBase = position.distanceTo(this.baseLocation);
  if (distanceToBase < GAME_CONFIG.MAP.NO_BUILD_RADIUS_METERS) {
    return false;
  }

  return true;
}
```

### 3.2 TowerManager (`src/game/TowerManager.ts`)
Update `isValidPlacement()`:
- For HELICOPTER/BOMB: Check polygon containment instead of `bounds.contains()`
- Already delegates to `mapConfig.isValidTowerPosition()` for normal towers

### 3.3 Base Location Validation (`src/mapSelector.ts`)
Update `onBaseLocationClick()` to use polygon containment check for custom areas.

**Files modified:** `src/mapConfiguration.ts`, `src/game/TowerManager.ts`, `src/mapSelector.ts`

---

## Phase 4: Road Network & Data Fetching

### 4.1 OverpassClient (`src/overpassClient.ts`)
No changes needed - still queries the enclosing bounding box. The polygon is only used for containment, not for filtering roads (roads outside polygon are fine - enemies travel on them before entering the play area).

### 4.2 RoadNetwork Boundary Detection (`src/roadNetwork.ts`)
This is the most complex change. Currently `findRoadBoundaryIntersections()` only checks N/S/E/W edges.

For custom polygons:
- Need to find intersections with each of the 4 polygon edges
- Each edge is a line segment from `corner[i]` to `corner[(i+1) % 4]`
- Calculate line-segment intersection for each road segment
- Determine which side is "outside" to identify entry points

Update `findBoundaryEntries()`:
```typescript
findBoundaryEntries(targetPoint: L.LatLng, customArea?: L.LatLng[]): BoundaryEntry[] {
  if (customArea) {
    return this.findPolygonBoundaryEntries(targetPoint, customArea);
  }
  // existing rectangle logic
}
```

Add `findPolygonBoundaryEntries()`:
- For each polygon edge (4 edges for quadrilateral)
- For each road segment, check intersection with that edge
- Use winding number or cross product to determine if road is entering or exiting

**Files modified:** `src/roadNetwork.ts`

---

## Phase 5: Visual Display During Gameplay

### 5.1 Update MapSelector Display
When loading/displaying a custom area config:
- Use `L.Polygon` instead of `L.Rectangle` for the boundary
- Keep same styling (blue border, semi-transparent fill)

### 5.2 loadConfiguration() Update
```typescript
loadConfiguration(config: MapConfiguration): void {
  // ...existing code...

  if (config.customArea) {
    this.boundsPolygon = L.polygon(config.customArea, {
      color: '#3388ff',
      weight: 3,
      fillOpacity: 0.1,
    }).addTo(this.map);
  } else {
    this.boundsRectangle = L.rectangle(config.bounds, {
      color: '#3388ff',
      weight: 3,
      fillOpacity: 0.1,
    }).addTo(this.map);
  }
}
```

**Files modified:** `src/mapSelector.ts`

---

## Phase 6: Backward Compatibility & Serialization

### 6.1 Version Handling (`src/mapConfiguration.ts`)
```typescript
static fromJSON(data: MapConfigData): MapConfiguration {
  // v1.0.0: Rectangle only
  if (!data.customArea) {
    const bounds = L.latLngBounds(...);
    return new MapConfiguration(bounds, baseLocation);
  }

  // v2.0.0: Custom area
  const corners = data.customArea.corners.map(c => L.latLng(c.lat, c.lng));
  const bounds = computeBoundingBox(corners); // for Overpass queries
  return new MapConfiguration(bounds, baseLocation, corners);
}
```

### 6.2 toJSON() Update
```typescript
toJSON(): MapConfigData {
  const data: MapConfigData = {
    version: MapConfiguration.VERSION,
    bounds: {
      north: this.bounds.getNorth(),
      south: this.bounds.getSouth(),
      east: this.bounds.getEast(),
      west: this.bounds.getWest(),
    },
    baseLocation: {
      lat: this.baseLocation.lat,
      lng: this.baseLocation.lng,
    },
    metadata: this.metadata,
  };

  if (this.customArea) {
    data.customArea = {
      corners: this.customArea.map(c => ({ lat: c.lat, lng: c.lng }))
    };
  }

  return data;
}
```

**Files modified:** `src/mapConfiguration.ts`

---

## Implementation Order

1. **Phase 1** - Data model (`geometry.ts`, `mapConfiguration.ts` types)
2. **Phase 6** - Serialization (can test save/load early)
3. **Phase 3** - Containment logic (foundation for everything else)
4. **Phase 2** - Selection UI (user-facing feature)
5. **Phase 4** - Road network boundary detection
6. **Phase 5** - Visual display

---

## Testing Strategy

### Manual Testing
1. Select a rotated area (e.g., Central Park coordinates)
2. Verify polygon displays correctly
3. Verify base placement works within polygon
4. Verify towers can only be placed inside polygon
5. Verify enemies spawn from correct boundary entry points
6. Save/load config and verify polygon persists
7. Load a v1.0.0 config and verify backward compatibility

### Test Coordinates for Central Park
```
NW: 40.7968, -73.9580
NE: 40.8002, -73.9499
SE: 40.7645, -73.9734
SW: 40.7678, -73.9816
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Polygon edge intersection math complexity | Use well-tested line intersection algorithm; add unit tests |
| Performance with many roads | Only check polygon containment when needed; bbox prefilter |
| Non-convex quadrilaterals | Validate corners form convex shape, or support non-convex |
| User selects corners in wrong order | Auto-sort corners to form valid quadrilateral |

---

## Out of Scope (per feature doc)
- Arbitrary polygon shapes (>4 corners)
- Curved/circular selections
- Dynamic polygon editing after selection

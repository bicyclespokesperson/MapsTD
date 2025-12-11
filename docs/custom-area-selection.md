# Custom Area Selection Feature

## Overview
Add support for selecting non-rectangular game areas by clicking 4 custom corners, enabling gameplay on rotated landmarks like Central Park.

## User Story
As a player, I want to select areas that aren't perfectly aligned north/south/east/west, so I can play on interesting rotated landmarks like Central Park, diagonal streets, or angled neighborhoods.

## Current Limitation
The current "Select Area" feature only supports axis-aligned rectangles (perfectly N/S/E/W aligned). This works well for grid-based city blocks but poorly for rotated areas:

- **Central Park, NYC**: Rotated ~29° from true north
- **Diagonal streets**: Many cities have diagonal boulevards
- **Angled neighborhoods**: Areas that don't align with cardinal directions

Selecting these areas currently includes significant unwanted space outside the landmark.

## Proposed Solution
Split the "Select Area" button into two modes:

### Rectangle Mode (Current)
- Drag to select a rectangular area
- Fast and simple for grid-aligned areas

### Custom Mode (New)
- Click 4 corners individually to define a quadrilateral
- Visual feedback showing the selected polygon
- Polygon boundary remains visible during gameplay

## Use Cases
- Central Park, New York
- The National Mall, Washington DC
- Golden Gate Park, San Francisco
- Any rotated park, campus, or neighborhood
- Diagonal street systems (e.g., DC, Barcelona)

## Technical Challenges

### Data Model
- Current system stores bounds as north/south/east/west values
- Need to support both rectangular bounds (for compatibility) and custom 4-corner polygons
- Serialization format must support both representations

### Containment Checking
- Tower placement validation currently uses simple rectangular bounds checking
- Custom areas require point-in-polygon algorithms
- Need efficient containment checks that work for both modes

### Road Data Fetching
- Overpass API (OpenStreetMap) only accepts rectangular bounding boxes
- Must query the bounding box of custom polygon, then filter roads client-side
- May fetch extra roads outside the actual play area

### Coordinate Mapping
- Current system assumes rectangular viewport for coordinate conversion
- Custom polygons create challenges for screen-to-map coordinate transformation
- Two potential approaches:
  1. Keep rectangular viewport, use polygon only for containment (simpler)
  2. Implement perspective transformation for true rotated gameplay (complex)

### Backward Compatibility
- Existing saved maps use rectangular bounds format
- Must support loading old configurations
- Share/load functionality needs to handle both formats

## Out of Scope
- Arbitrary polygon shapes (only 4-corner quadrilaterals)
- Curved or circular selection areas
- Dynamic polygon editing after selection

## Future Considerations
- May want to add visual indicators showing which areas are outside the custom polygon but inside the bounding box
- Could add rotation hints or angle measurements during selection
- Might need performance optimizations for very large custom areas

## Implementation Priority
- **Priority**: Medium-Low (nice to have, not critical)
- **Estimated Effort**: 6-8 hours for basic implementation
- **Dependencies**: None (can be added independently)

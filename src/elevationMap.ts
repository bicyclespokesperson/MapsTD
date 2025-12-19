import * as L from 'leaflet';

export class ElevationMap {
  private grid: number[][];
  private bounds: L.LatLngBounds;
  private rows: number;
  private cols: number;

  constructor(grid: number[][], bounds: L.LatLngBounds) {
    this.grid = grid;
    this.bounds = bounds;
    this.rows = grid.length;
    this.cols = grid.length > 0 ? grid[0].length : 0;
  }

  /**
   * Get elevation at a specific coordinate using Nearest Neighbor.
   * Matches the blocky visualization.
   */
  getElevation(lat: number, lng: number): number {
    if (this.rows < 2 || this.cols < 2) return 0;
    if (!this.bounds.contains(L.latLng(lat, lng))) return 0;

    const south = this.bounds.getSouth();
    const north = this.bounds.getNorth();
    const west = this.bounds.getWest();
    const east = this.bounds.getEast();

    // Normalized coordinates (0 to 1)
    const latNorm = (north - lat) / (north - south);
    const lngNorm = (lng - west) / (east - west);

    const r = Math.floor(latNorm * (this.rows - 1));
    const c = Math.floor(lngNorm * (this.cols - 1));

    // Clamp just in case
    const rClamped = Math.max(0, Math.min(this.rows - 1, r));
    const cClamped = Math.max(0, Math.min(this.cols - 1, c));

    return this.grid[rClamped][cClamped];
  }

  /**
   * Check Line of Sight between two points.
   * "Arcade" Logic: Terrain only blocks if it is strictly higher than the ray
   * AND (Permissive Rule) higher than the start point (optional, but helps avoid self-occlusion artifacts).
   * Actually, with Nearest Neighbor, simply checking ray vs ground is robust enough usually.
   * But let's add a small grace tolerance.
   */
  checkLineOfSight(
    p1: { lat: number; lng: number; heightOffset: number },
    p2: { lat: number; lng: number; heightOffset: number },
    toleranceMeters: number = 10
  ): boolean {
    const startElev = this.getElevation(p1.lat, p1.lng) + p1.heightOffset;
    const endElev = this.getElevation(p2.lat, p2.lng) + p2.heightOffset;

    const dist = Math.sqrt(
      Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)
    );
    const steps = Math.ceil(dist / 0.0001); // Check every ~10 meters

    if (steps <= 1) return true;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const lat = p1.lat + (p2.lat - p1.lat) * t;
      const lng = p1.lng + (p2.lng - p1.lng) * t;

      const groundElev = this.getElevation(lat, lng);
      
      // General Permissive Rule (Arcade Physics):
      // An obstacle only blocks if it sticks up ABOVE the "structural" line of sight.
      // If the ground is lower than my feet (start) OR lower than the target (end),
      // it is considered part of the "slope" found in valleys or hillsides, and ignored.
      // It must be strictly higher than BOTH to constrain the view (e.g. a peak between two valleys).
      // This solves:
      // 1. "Plateau Edge": I can see down (ground <= start).
      // 2. "Staircase Clipping": I can see up a monotonic slope (ground <= end).
      const startGround = startElev - p1.heightOffset;
      const endGround = endElev - p2.heightOffset;
      const permissiveHeight = Math.max(startGround, endGround);
      
      if (groundElev <= permissiveHeight) continue;

      const rayElev = startElev + (endElev - startElev) * t;

      // Add tolerance: Ground must be SIGNIFICANTLY higher than ray to block.
      // e.g. rayElev + 5m.
      if (groundElev >= rayElev + toleranceMeters) {
        return false; // Blocked
      }
    }

    return true;
  }

  /**
   * Get the underlying grid and dimensions.
   * Useful for visualization.
   */
  getGridData() {
    return {
      grid: this.grid,
      rows: this.rows,
      cols: this.cols,
      bounds: this.bounds
    };
  }

  /**
   * Calculate a polygon representing the area visible from a point.
   */
  public calculateVisibilityPolygon(
    center: { lat: number; lng: number; heightOffset: number },
    baseRangeMeters: number,
    numRays: number = 72, 
    maxStepsPerRay: number = 20
  ): L.LatLng[] {
    const vertices: L.LatLng[] = [];
    const centerLatLng = L.latLng(center.lat, center.lng);
    const startElev = this.getElevation(center.lat, center.lng) + center.heightOffset;
    
    // Scan further than base range to account for potential bonuses (max +50%)
    const scanDistance = baseRangeMeters * 1.5;

    // Approximate meters per degree
    const metersPerLat = 111320; 
    const metersPerLng = 40075000 * Math.cos(center.lat * Math.PI / 180) / 360;

    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * 2 * Math.PI;
        const dxMeters = Math.cos(angle) * scanDistance;
        const dyMeters = Math.sin(angle) * scanDistance;

        const dLat = dyMeters / metersPerLat;
        const dLng = dxMeters / metersPerLng;
        
        const endLat = center.lat + dLat;
        const endLng = center.lng + dLng;
        
        let hitPoint = L.latLng(endLat, endLng);
        let blocked = false;
        let previousValidPoint = centerLatLng;

        for (let s = 1; s <= maxStepsPerRay; s++) {
             const t = s / maxStepsPerRay;
             const currentLat = center.lat + (endLat - center.lat) * t;
             const currentLng = center.lng + (endLng - center.lng) * t;
             const distToPoint = scanDistance * t; 
             
             if (distToPoint < 1) continue; 
             
             const groundElev = this.getElevation(currentLat, currentLng);
             
             // Dynamic Range Check
             const diff = startElev - center.heightOffset - groundElev; 
             const factor = Math.max(-0.3, Math.min(0.5, diff * 0.007));
             const effectiveRange = baseRangeMeters * (1 + factor);
             
             if (distToPoint > effectiveRange) {
                  // Out of range
                  hitPoint = previousValidPoint;
                  blocked = true;
                  break;
             }
             
             // General Permissive Rule for Polygon
             const startGround = startElev - center.heightOffset;
             // For the polygon, we scan out. 'groundElev' is the "current lookup".
             // But we don't know the "target" height because this is a scan.
             // HOWEVER, the user said "series of tiles in a row that are each uphill".
             // This implies checking the gradient relative to PREVIOUS points? No.
             // The simple proxy for "Target Elevation" in a scan is "Current Elevation".
             // Because we are asking "Can I see THIS point?"
             // So endGround = groundElev.
             // Thus: permissiveHeight = Math.max(startGround, groundElev).
             // Which means: if intermediate ground is <= max(start, current_target), ignore.
             // But we are iterating `t`. We need to handle intermediate obstacles for a SPECIFIC target `d`.
             // But here we are optimizing by raycasting continuous.
             // The standard polygon algorithm checks "Can I see point d?".
             // If yes, `maxSlope` is updated.
             // The "Arcade Slope" logic is hard to apply to the "Max Slope" algorithm directly because Max Slope preserves strict LoS.
             
             // Alternative: Run the discrete check for the current point `d` (at t=1 for this step)?
             // No, `t` varies.
             
             // Simplification:
             // If we are looking at `currentLat/Lng` as a POTENTIAL target.
             // We want to know if it's visible.
             // The loop structure here (`maxSlope`) accumulates blocks.
             // If we encounter a block `slope > maxSlope`...
             // BUT that block is "Permissive".
             // i.e. The block height `groundElev` is <= `startGround` OR `groundElev` <= `targetZ`.
             // If true, we should NOT update `maxSlope`? 
             // Or update it but don't count it as a block?
             
             // Logic:
             // If `groundElev <= startGround` -> High Ground rule. Ignore.
             // If `groundElev <= targetZ (of the point we are trying to see)`?
             // But we are stepping `t`. `targetZ` usually means the END of the ray.
             // Here, every step `s` is a potential end of the ray (visible surface).
             // If step `s` is the target, then inherent `groundElev` == `targetZ` (ground).
             // So `groundElev <= targetZ` is always true for the target itself.
             // But what about PREVIOUS obstacles blocking THIS target?
             // The "Max Slope" algorithm implicitly checks all previous obstacles.
             // `maxSlope` stores the highest `slope` seen so far.
             // `slope = (groundZ - startZ) / dist`.
             // If `currentSlope < maxSlope`, we are blocked.
             
             // TO FIX "Staircase Clipping" in Slope Algorithm:
             // We generally want to allow looking UP a slope.
             // A monotonic slope has INCREASING slopes?
             // Or at least non-decreasing angles?
             // Actually, a concave slope has increasing slope. A convex slope has decreasing slope.
             // If slope decreases, it's blocked (convex / hill).
             // If slope increases, it's visible (concave / valley).
             // "Staircase" is tiny convexities ("corners").
             // We want to ignore tiny convexities.
             // Method: Reduce `maxSlope` slightly? No.
             // Method: Only update `maxSlope` IF `groundElev > startGround`? 
             // (This implements High Ground rule: looking down, `maxSlope` is negative. We don't let bumps block us?)
             
             // Let's implement the "Permissive High Ground" (Arcade) rule here first:
             // If `groundElev <= startGround`, we effectively "reset" or "ignore" the slope requirement?
             // Effectively, if you are looking down, you can ALWAYS see (per previous rule).
             // So if `groundElev <= startGround`, we treat `slope` as `-Infinity` (doesn't block anything)?
             
             if (groundElev <= startGround) {
                 // High Ground Rule: This ground cannot block future points, nor is it blocked by previous points?
                 // Be careful. Low ground CAN be blocked by a previous high bump.
                 // But low ground CANNOT block a future point?
                 // If I look over a valley (low) to a peak (high).
                 // The valley doesn't block the peak. Correct.
                 // So "ignore update to maxSlope" if low?
                 // But we need to know if THIS point is visible.
                 // It is visible if `slope >= maxSlope`.
                 // So we DO check.
                 // But do we update `maxSlope`? 
                 // If we update it, a "bump" in the valley might block the far side.
                 // If `groundElev <= startGround`, it's lower than us.
                 // Can a lower point block a higher point?
                 // No, usually not, unless it's a huge wall.
                 // But `slope` takes care of angles.
                 
                 // Let's stick to the user's "Uphill" request.
                 // "don't account for the angle between them potentially obscuring a target"
                 // This implies: If `maxSlope` prevents us from seeing a point `P`,
                 // BUT `P.elev > startElev` (Uphill), 
                 // AND `P.elev >= prevObstacle.elev` (Monotonic-ish),
                 // We should see it.
                 
                 // This is hard to cram into the `maxSlope` optimization.
                 // Let's degrade `calculateVisibilityPolygon` to use `checkLineOfSight` for every step/point?
                 // It's O(N^2) per ray. N=20. Fine. 20 steps * 20 sub-steps * 72 rays = 28,800 checks. 
                 // Might be heavy for JS frame loop?
                 // Actually 72 * 20 checkLineOfSight calls.
                 // checkLineOfSight is O(dist). Dist is ~20 steps.
                 // So ~30k ops. Modern JS can handle millions.
                 // Let's SWITCH to using `checkLineOfSight` explicitly.
                 // It ensures absolute consistency with the logic we just wrote.
                 
                 // Switch loop methodology:
                 // Check visibility of `currentLat, currentLng`.
                 // If visible, update `hitPoint` and continue.
                 // If NOT visible, break.
             }
             
             // NEW LOOP LOGIC (replacing Max Slope):
                          
             // Note: checkLineOfSight uses full logic (Permissive High Ground + Permissive Uphill)
             const hasLoS = this.checkLineOfSight(
                { lat: center.lat, lng: center.lng, heightOffset: center.heightOffset },
                { lat: currentLat, lng: currentLng, heightOffset: 2 } // Check visibility of Ground+2m
             );
             
             if (hasLoS) {
                 previousValidPoint = L.latLng(currentLat, currentLng);
             } else {
                 hitPoint = previousValidPoint;
                 blocked = true;
                 break;
             }
        }
        
        if (!blocked) {
            hitPoint = L.latLng(endLat, endLng);
        }
        
        vertices.push(hitPoint);
    }

    return vertices;
  }
}

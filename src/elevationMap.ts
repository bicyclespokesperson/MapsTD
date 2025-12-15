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
   * Get elevation at a specific coordinate using bilinear interpolation.
   */
  getElevation(lat: number, lng: number): number {
    if (this.rows < 2 || this.cols < 2) return 0;
    if (!this.bounds.contains(L.latLng(lat, lng))) return 0;

    const south = this.bounds.getSouth();
    const north = this.bounds.getNorth();
    const west = this.bounds.getWest();
    const east = this.bounds.getEast();

    // Normalized coordinates (0 to 1)
    // Remember rows go North -> South (0 -> rows-1)
    const latNorm = (north - lat) / (north - south);
    const lngNorm = (lng - west) / (east - west);

    const r = latNorm * (this.rows - 1);
    const c = lngNorm * (this.cols - 1);

    const r0 = Math.floor(r);
    const r1 = Math.min(this.rows - 1, r0 + 1);
    const c0 = Math.floor(c);
    const c1 = Math.min(this.cols - 1, c0 + 1);

    // Grid values
    const z00 = this.grid[r0][c0];
    const z01 = this.grid[r0][c1];
    const z10 = this.grid[r1][c0];
    const z11 = this.grid[r1][c1];

    // Fractional parts
    const dr = r - r0;
    const dc = c - c0;

    // Interpolate
    const z0 = z00 * (1 - dc) + z01 * dc; // Top row interpolation
    const z1 = z10 * (1 - dc) + z11 * dc; // Bottom row interpolation

    return z0 * (1 - dr) + z1 * dr;
  }

  /**
   * Check Line of Sight between two points.
   * Checks if the terrain blocks the view between p1 and p2.
   * @param p1 Source point {lat, lng, heightOffset}
   * @param p2 Target point {lat, lng, heightOffset}
   * @returns true if Line of Sight is clear, false if blocked
   */
  checkLineOfSight(
    p1: { lat: number; lng: number; heightOffset: number },
    p2: { lat: number; lng: number; heightOffset: number }
  ): boolean {
    const startElev = this.getElevation(p1.lat, p1.lng) + p1.heightOffset;
    const endElev = this.getElevation(p2.lat, p2.lng) + p2.heightOffset;

    const dist = Math.sqrt(
      Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)
    );
    const steps = Math.ceil(dist / 0.0001); // Check every ~10 meters (approx)

    if (steps <= 1) return true;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const lat = p1.lat + (p2.lat - p1.lat) * t;
      const lng = p1.lng + (p2.lng - p1.lng) * t;

      const groundElev = this.getElevation(lat, lng);
      const rayElev = startElev + (endElev - startElev) * t;

      if (groundElev > rayElev) {
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
   * Assumes 360 degree field of view.
   * @param center Source point {lat, lng, heightOffset}
   * @param maxRangeMeters Maximum distance to check
   * @param numRays Number of rays to cast (e.g., 36 or 72 for smoother polygon)
   * @param maxStepsPerRay maximum interpolation steps
   * @returns Array of LatLng vertices defining the polygon
   */
  /**
   * Calculate a polygon representing the area visible from a point.
   * Assumes 360 degree field of view.
   * @param center Source point {lat, lng, heightOffset}
   * @param baseRangeMeters Base range of the tower
   * @param numRays Number of rays to cast (e.g., 36 or 72 for smoother polygon)
   * @param maxStepsPerRay maximum interpolation steps
   * @returns Array of LatLng vertices defining the polygon
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
        let maxSlope = -Infinity;
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
             // Recalculate effective range for THIS target point
             const diff = startElev - center.heightOffset - groundElev; // tower base - target ground
             const factor = Math.max(-0.3, Math.min(0.5, diff * 0.01));
             const effectiveRange = baseRangeMeters * (1 + factor);
             
             if (distToPoint > effectiveRange) {
                  // Out of range
                  hitPoint = previousValidPoint;
                  blocked = true;
                  break;
             }
             
             const targetZ = groundElev + 2; 
             const slope = (targetZ - startElev) / distToPoint;
             
             if (s === 1) {
                 maxSlope = slope;
                 previousValidPoint = L.latLng(currentLat, currentLng);
             } else {
                 if (slope < maxSlope) {
                     // Blocked!
                     hitPoint = previousValidPoint;
                     blocked = true;
                     break;
                 } else {
                     // Visible
                     maxSlope = slope;
                     previousValidPoint = L.latLng(currentLat, currentLng);
                 }
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

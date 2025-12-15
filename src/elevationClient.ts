import * as L from 'leaflet';

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

export class ElevationClient {
  private readonly endpoint = 'https://api.open-elevation.com/api/v1/lookup';

  /**
   * Fetches a grid of elevation points covering the given bounds.
   * @param bounds The bounding box to cover
   * @param rows Number of rows in the grid
   * @param cols Number of columns in the grid
   * @returns A 2D array of elevation values (meters), indexed by [row][col]
   */
  async fetchGrid(bounds: L.LatLngBounds, rows: number, cols: number): Promise<number[][]> {
    const locations: { latitude: number; longitude: number }[] = [];
    
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    const latStep = (north - south) / (rows - 1);
    const lngStep = (east - west) / (cols - 1);

    // Generate grid points
    // We iterate rows from North to South (top to bottom) to match 2D array intuition
    // And cols from West to East (left to right)
    for (let r = 0; r < rows; r++) {
      const lat = north - r * latStep;
      for (let c = 0; c < cols; c++) {
        const lng = west + c * lngStep;
        locations.push({ latitude: lat, longitude: lng });
      }
    }

    console.log(`Fetching elevation for ${locations.length} points...`);

    try {
      // The API accepts a list of locations.
      // We might need to batch this if it's too large, but for 30x30=900 points it should be fine in one go.
      // Max payload is usually reasonable.
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locations }),
      });

      if (!response.ok) {
        throw new Error(`Elevation API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results: ElevationPoint[] = data.results;

      if (results.length !== rows * cols) {
        console.warn(`Expected ${rows * cols} elevation points, got ${results.length}. Grid may be malformed.`);
      }

      // Reassemble into 2D grid
      const grid: number[][] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        const row: number[] = [];
        for (let c = 0; c < cols; c++) {
          if (idx < results.length) {
            row.push(results[idx].elevation);
          } else {
            row.push(0); // Fallback
          }
          idx++;
        }
        grid.push(row);
      }

      return grid;

    } catch (error) {
      console.error('Failed to fetch elevation data using fallback flat terrain:', error);
      // Fallback: return 0 elevation for all points
      return Array(rows).fill(0).map(() => Array(cols).fill(0));
    }
  }
}

import * as L from 'leaflet';

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      // Non-retryable HTTP errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      // Server errors (5xx) - retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Request failed after retries');
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
    for (let r = 0; r < rows; r++) {
      const lat = north - r * latStep;
      for (let c = 0; c < cols; c++) {
        const lng = west + c * lngStep;
        locations.push({ latitude: lat, longitude: lng });
      }
    }

    console.log(`Fetching elevation for ${locations.length} points...`);

    try {
      const response = await fetchWithRetry(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locations }),
      });

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
            row.push(0);
          }
          idx++;
        }
        grid.push(row);
      }

      return grid;

    } catch (error) {
      console.error('Failed to fetch elevation data, using fallback flat terrain:', error);
      return Array(rows).fill(0).map(() => Array(cols).fill(0));
    }
  }
}

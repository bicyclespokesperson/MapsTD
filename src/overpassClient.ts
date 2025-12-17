import * as L from 'leaflet';

export interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OSMRelation {
  type: 'relation';
  id: number;
  members: Array<{
    type: string;
    ref: number;
    role: string;
  }>;
  tags?: Record<string, string>;
}

export type OSMElement = OSMNode | OSMWay | OSMRelation;

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OSMElement[];
}

export interface RoadSegment {
  id: number;
  points: L.LatLng[];
  nodeIds: number[];
  tags: Record<string, string>;
  highway: string;
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

export class OverpassClient {
  private readonly endpoint = 'https://overpass-api.de/api/interpreter';
  private readonly timeout = 25;

  async queryRoads(bounds: L.LatLngBounds): Promise<RoadSegment[]> {
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    const query = `
      [out:json][timeout:${this.timeout}];
      (
        way["highway"]["highway"!~"footway|path|cycleway|steps|pedestrian|service"]
          (${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;
    `;

    console.log('Querying Overpass API:', { south, west, north, east });

    try {
      const response = await fetchWithRetry(this.endpoint, {
        method: 'POST',
        body: query,
      });

      const data: OverpassResponse = await response.json();
      console.log('Received OSM data:', data);

      return this.parseRoads(data);
    } catch (error) {
      console.error('Failed to fetch OSM data:', error);
      throw error;
    }
  }

  private parseRoads(data: OverpassResponse): RoadSegment[] {
    const nodes = new Map<number, OSMNode>();
    const ways: OSMWay[] = [];

    for (const element of data.elements) {
      if (element.type === 'node') {
        nodes.set(element.id, element);
      } else if (element.type === 'way') {
        ways.push(element);
      }
    }

    const roads: RoadSegment[] = [];

    for (const way of ways) {
      if (!way.tags?.highway) continue;

      const points: L.LatLng[] = [];
      const nodeIds: number[] = [];
      
      for (const nodeId of way.nodes) {
        const node = nodes.get(nodeId);
        if (node) {
          points.push(L.latLng(node.lat, node.lon));
          nodeIds.push(nodeId);
        }
      }

      if (points.length >= 2) {
        roads.push({
          id: way.id,
          points,
          nodeIds,
          tags: way.tags || {},
          highway: way.tags.highway,
        });
      }
    }

    console.log(`Parsed ${roads.length} road segments`);
    return roads;
  }
}

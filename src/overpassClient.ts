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
  tags: Record<string, string>;
  highway: string;
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
      const response = await fetch(this.endpoint, {
        method: 'POST',
        body: query,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

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
      for (const nodeId of way.nodes) {
        const node = nodes.get(nodeId);
        if (node) {
          points.push(L.latLng(node.lat, node.lon));
        }
      }

      if (points.length >= 2) {
        roads.push({
          id: way.id,
          points,
          tags: way.tags || {},
          highway: way.tags.highway,
        });
      }
    }

    console.log(`Parsed ${roads.length} road segments`);
    return roads;
  }
}

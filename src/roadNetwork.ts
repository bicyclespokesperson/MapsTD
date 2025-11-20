import * as L from 'leaflet';
import { RoadSegment } from './overpassClient';

export interface RoadPath {
  roadId: number;
  waypoints: L.LatLng[];
  highway: string;
}

export interface BoundaryEntry {
  position: L.LatLng;
  roadPath: RoadPath;
  edge: 'north' | 'south' | 'east' | 'west';
}

interface GraphNode {
  id: number;
  latLng: L.LatLng;
  neighbors: Map<number, number>; // neighborId -> distance
}

export class RoutingGraph {
  private nodes: Map<number, GraphNode> = new Map();

  constructor(roads: RoadSegment[]) {
    this.buildGraph(roads);
  }

  private buildGraph(roads: RoadSegment[]) {
    // 1. Create nodes for all intersections and endpoints
    // Actually, for simplicity and accuracy, let's treat EVERY OSM node as a graph node.
    // This ensures we follow the road geometry exactly.
    
    for (const road of roads) {
      for (let i = 0; i < road.points.length; i++) {
        const nodeId = road.nodeIds[i];
        const point = road.points[i];
        
        if (!this.nodes.has(nodeId)) {
          this.nodes.set(nodeId, {
            id: nodeId,
            latLng: point,
            neighbors: new Map()
          });
        }
      }
    }

    // 2. Connect nodes based on road segments
    for (const road of roads) {
      for (let i = 0; i < road.nodeIds.length - 1; i++) {
        const uId = road.nodeIds[i];
        const vId = road.nodeIds[i+1];
        
        const u = this.nodes.get(uId)!;
        const v = this.nodes.get(vId)!;
        
        const dist = u.latLng.distanceTo(v.latLng);
        
        u.neighbors.set(vId, dist);
        v.neighbors.set(uId, dist); // Roads are bidirectional for now
      }
    }
    
    console.log(`Built routing graph with ${this.nodes.size} nodes`);
  }

  findShortestPath(startNodeId: number, endNodeId: number): L.LatLng[] | null {
    // Dijkstra's Algorithm
    const distances = new Map<number, number>();
    const previous = new Map<number, number>();
    const unvisited = new Set<number>();

    // Initialize
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    distances.set(startNodeId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentId: number | null = null;
      let minDist = Infinity;

      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId)!;
        if (dist < minDist) {
          minDist = dist;
          currentId = nodeId;
        }
      }

      if (currentId === null || minDist === Infinity) {
        break; // No reachable nodes left
      }

      if (currentId === endNodeId) {
        // Reconstruct path
        const path: L.LatLng[] = [];
        let curr: number | undefined = endNodeId;
        
        while (curr !== undefined) {
          path.unshift(this.nodes.get(curr)!.latLng);
          curr = previous.get(curr);
        }
        return path;
      }

      unvisited.delete(currentId);

      // Update neighbors
      const currentNode = this.nodes.get(currentId)!;
      for (const [neighborId, weight] of currentNode.neighbors) {
        if (!unvisited.has(neighborId)) continue;

        const alt = distances.get(currentId)! + weight;
        if (alt < distances.get(neighborId)!) {
          distances.set(neighborId, alt);
          previous.set(neighborId, currentId);
        }
      }
    }

    return null; // No path found
  }

  findClosestNode(point: L.LatLng): number | null {
    let closestId: number | null = null;
    let minSqDist = Infinity;

    for (const node of this.nodes.values()) {
      const dSq = this.distSq(point, node.latLng);
      if (dSq < minSqDist) {
        minSqDist = dSq;
        closestId = node.id;
      }
    }

    return closestId;
  }

  private distSq(p1: L.LatLng, p2: L.LatLng): number {
    return (p1.lat - p2.lat) * (p1.lat - p2.lat) + (p1.lng - p2.lng) * (p1.lng - p2.lng);
  }
}

export class RoadNetwork {
  private roads: RoadSegment[];
  private bounds: L.LatLngBounds;
  private graph: RoutingGraph;

  constructor(roads: RoadSegment[], bounds: L.LatLngBounds) {
    this.roads = roads;
    this.bounds = bounds;
    this.graph = new RoutingGraph(roads);
  }

  getAllRoads(): RoadSegment[] {
    return this.roads;
  }

  findBoundaryEntries(targetPoint: L.LatLng): BoundaryEntry[] {
    const entries: BoundaryEntry[] = [];

    // 1. Find closest graph node to target (defend point)
    const targetNodeId = this.graph.findClosestNode(targetPoint);
    if (targetNodeId === null) {
      console.warn('No graph nodes found near target');
      return [];
    }

    for (const road of this.roads) {
      const boundaryPoints = this.findRoadBoundaryIntersections(road);

      for (const bp of boundaryPoints) {
        // 2. Find closest graph node to entry point
        // Since intersections happen on segments, we can look at the road's nodes.
        // The intersection is on the segment between points[i] and points[i+1].
        // So the closest node is either nodeIds[i] or nodeIds[i+1].
        
        const p1 = road.points[bp.pointIndex];
        const p2 = road.points[bp.pointIndex + 1];
        const id1 = road.nodeIds[bp.pointIndex];
        const id2 = road.nodeIds[bp.pointIndex + 1];
        
        const d1 = bp.position.distanceTo(p1);
        const d2 = bp.position.distanceTo(p2);
        
        const startNodeId = d1 < d2 ? id1 : id2;

        // 3. Calculate path
        const pathPoints = this.graph.findShortestPath(startNodeId, targetNodeId);
        
        if (pathPoints && pathPoints.length > 0) {
          // Prepend the exact boundary intersection point
          pathPoints.unshift(bp.position);
          // Append the exact target point
          pathPoints.push(targetPoint);
          
          entries.push({
            position: bp.position,
            roadPath: {
              roadId: road.id,
              waypoints: pathPoints,
              highway: road.highway
            },
            edge: bp.edge,
          });
        }
      }
    }

    console.log(`Found ${entries.length} boundary entry points with valid paths`);
    return entries;
  }

  private findRoadBoundaryIntersections(
    road: RoadSegment
  ): Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> {
    const intersections: Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> = [];
    const north = this.bounds.getNorth();
    const south = this.bounds.getSouth();
    const east = this.bounds.getEast();
    const west = this.bounds.getWest();

    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];

      const crossesNorth = this.segmentCrossesHorizontal(p1, p2, north);
      if (crossesNorth) {
        const intersection = this.horizontalIntersection(p1, p2, north);
        if (intersection && this.isWithinBounds(intersection, 'horizontal')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'north' });
        }
      }

      const crossesSouth = this.segmentCrossesHorizontal(p1, p2, south);
      if (crossesSouth) {
        const intersection = this.horizontalIntersection(p1, p2, south);
        if (intersection && this.isWithinBounds(intersection, 'horizontal')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'south' });
        }
      }

      const crossesEast = this.segmentCrossesVertical(p1, p2, east);
      if (crossesEast) {
        const intersection = this.verticalIntersection(p1, p2, east);
        if (intersection && this.isWithinBounds(intersection, 'vertical')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'east' });
        }
      }

      const crossesWest = this.segmentCrossesVertical(p1, p2, west);
      if (crossesWest) {
        const intersection = this.verticalIntersection(p1, p2, west);
        if (intersection && this.isWithinBounds(intersection, 'vertical')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'west' });
        }
      }
    }

    return intersections;
  }

  private segmentCrossesHorizontal(p1: L.LatLng, p2: L.LatLng, lat: number): boolean {
    return (p1.lat <= lat && p2.lat >= lat) || (p1.lat >= lat && p2.lat <= lat);
  }

  private segmentCrossesVertical(p1: L.LatLng, p2: L.LatLng, lng: number): boolean {
    return (p1.lng <= lng && p2.lng >= lng) || (p1.lng >= lng && p2.lng <= lng);
  }

  private horizontalIntersection(p1: L.LatLng, p2: L.LatLng, lat: number): L.LatLng | null {
    const latDiff = p2.lat - p1.lat;
    if (Math.abs(latDiff) < 1e-10) return null;

    const t = (lat - p1.lat) / latDiff;
    const lng = p1.lng + t * (p2.lng - p1.lng);

    return L.latLng(lat, lng);
  }

  private verticalIntersection(p1: L.LatLng, p2: L.LatLng, lng: number): L.LatLng | null {
    const lngDiff = p2.lng - p1.lng;
    if (Math.abs(lngDiff) < 1e-10) return null;

    const t = (lng - p1.lng) / lngDiff;
    const lat = p1.lat + t * (p2.lat - p1.lat);

    return L.latLng(lat, lng);
  }

  private isWithinBounds(point: L.LatLng, direction: 'horizontal' | 'vertical'): boolean {
    if (direction === 'horizontal') {
      return point.lng >= this.bounds.getWest() && point.lng <= this.bounds.getEast();
    } else {
      return point.lat >= this.bounds.getSouth() && point.lat <= this.bounds.getNorth();
    }
  }

  getBounds(): L.LatLngBounds {
    return this.bounds;
  }

  isPointOnRoad(point: L.LatLng, toleranceMeters: number = 20): boolean {
    // Convert tolerance from meters to degrees (approximate)
    // 1 degree latitude is approx 111km
    const toleranceDegrees = toleranceMeters / 111000;

    for (const road of this.roads) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const p1 = road.points[i];
        const p2 = road.points[i + 1];
        
        const dist = this.distanceToSegment(point, p1, p2);
        if (dist < toleranceDegrees) {
          return true;
        }
      }
    }
    return false;
  }

  private distanceToSegment(p: L.LatLng, v: L.LatLng, w: L.LatLng): number {
    const l2 = this.distSq(v, w);
    if (l2 === 0) return this.distSq(p, v);
    
    let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projection = L.latLng(
      v.lat + t * (w.lat - v.lat),
      v.lng + t * (w.lng - v.lng)
    );
    
    return Math.sqrt(this.distSq(p, projection));
  }

  private distSq(p1: L.LatLng, p2: L.LatLng): number {
    return (p1.lat - p2.lat) * (p1.lat - p2.lat) + (p1.lng - p2.lng) * (p1.lng - p2.lng);
  }
}

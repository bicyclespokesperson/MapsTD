import * as L from 'leaflet';
import { RoadSegment } from './overpassClient';
import { lineSegmentIntersection, pointInPolygon } from './geometry';

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

class MinHeap {
  private heap: Array<{ nodeId: number; priority: number }> = [];
  private positions: Map<number, number> = new Map();

  insert(nodeId: number, priority: number): void {
    const index = this.heap.length;
    this.heap.push({ nodeId, priority });
    this.positions.set(nodeId, index);
    this.bubbleUp(index);
  }

  extractMin(): { nodeId: number; priority: number } | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) {
      const item = this.heap.pop()!;
      this.positions.delete(item.nodeId);
      return item;
    }

    const min = this.heap[0];
    this.positions.delete(min.nodeId);

    const last = this.heap.pop()!;
    this.heap[0] = last;
    this.positions.set(last.nodeId, 0);
    this.bubbleDown(0);

    return min;
  }

  decreaseKey(nodeId: number, newPriority: number): void {
    const index = this.positions.get(nodeId);
    if (index === undefined) return;

    this.heap[index].priority = newPriority;
    this.bubbleUp(index);
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  has(nodeId: number): boolean {
    return this.positions.has(nodeId);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIndex].priority) break;

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;

    this.positions.set(this.heap[i].nodeId, i);
    this.positions.set(this.heap[j].nodeId, j);
  }
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
    // Dijkstra's Algorithm with Priority Queue
    const distances = new Map<number, number>();
    const previous = new Map<number, number>();
    const heap = new MinHeap();
    const visited = new Set<number>();

    // Initialize
    for (const nodeId of this.nodes.keys()) {
      const dist = nodeId === startNodeId ? 0 : Infinity;
      distances.set(nodeId, dist);
      heap.insert(nodeId, dist);
    }

    while (!heap.isEmpty()) {
      const current = heap.extractMin();
      if (!current) break;

      const currentId = current.nodeId;
      const currentDist = current.priority;

      if (currentDist === Infinity) break; // No more reachable nodes

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

      visited.add(currentId);

      // Update neighbors
      const currentNode = this.nodes.get(currentId)!;
      for (const [neighborId, weight] of currentNode.neighbors) {
        if (visited.has(neighborId)) continue;

        const alt = currentDist + weight;
        const oldDist = distances.get(neighborId)!;

        if (alt < oldDist) {
          distances.set(neighborId, alt);
          previous.set(neighborId, currentId);
          heap.decreaseKey(neighborId, alt);
        }
      }
    }

    return null; // No path found
  }

  computeShortestPathsFrom(sourceNodeId: number): { distances: Map<number, number>; previous: Map<number, number> } {
    // Run Dijkstra once to find shortest paths from source to ALL nodes
    const distances = new Map<number, number>();
    const previous = new Map<number, number>();
    const heap = new MinHeap();
    const visited = new Set<number>();

    // Initialize
    for (const nodeId of this.nodes.keys()) {
      const dist = nodeId === sourceNodeId ? 0 : Infinity;
      distances.set(nodeId, dist);
      heap.insert(nodeId, dist);
    }

    while (!heap.isEmpty()) {
      const current = heap.extractMin();
      if (!current) break;

      const currentId = current.nodeId;
      const currentDist = current.priority;

      if (currentDist === Infinity) break; // No more reachable nodes

      visited.add(currentId);

      // Update neighbors
      const currentNode = this.nodes.get(currentId)!;
      for (const [neighborId, weight] of currentNode.neighbors) {
        if (visited.has(neighborId)) continue;

        const alt = currentDist + weight;
        const oldDist = distances.get(neighborId)!;

        if (alt < oldDist) {
          distances.set(neighborId, alt);
          previous.set(neighborId, currentId);
          heap.decreaseKey(neighborId, alt);
        }
      }
    }

    return { distances, previous };
  }

  reconstructPath(endNodeId: number, previous: Map<number, number>): L.LatLng[] | null {
    if (!previous.has(endNodeId)) {
      return null; // No path to this node
    }

    const path: L.LatLng[] = [];
    let curr: number | undefined = endNodeId;

    while (curr !== undefined) {
      path.push(this.nodes.get(curr)!.latLng);
      curr = previous.get(curr);
    }

    return path;
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

  getNodesInRadius(center: L.LatLng, radiusMeters: number): number[] {
    const nodesToRemove: number[] = [];
    // Convert radius to approximate degrees
    const radiusDegrees = radiusMeters / 111000;
    const radiusSq = radiusDegrees * radiusDegrees;

    for (const node of this.nodes.values()) {
      const dSq = this.distSq(center, node.latLng);
      if (dSq <= radiusSq) {
        nodesToRemove.push(node.id);
      }
    }
    return nodesToRemove;
  }

  removeNode(nodeId: number) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove edges to this node from neighbors
    for (const neighborId of node.neighbors.keys()) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        neighbor.neighbors.delete(nodeId);
      }
    }

    this.nodes.delete(nodeId);
  }

  checkConnectivity(startPoints: L.LatLng[], endPoint: L.LatLng, ignoredNodeIds: Set<number>): boolean {
    const endNodeId = this.findClosestNode(endPoint);
    if (endNodeId === null || ignoredNodeIds.has(endNodeId)) return false;

    // We only need to find if AT LEAST ONE start point can reach the end point.
    // Optimization: Run BFS backwards from endNodeId until we hit any start node's closest graph node.
    
    // 1. Map start points to closest valid graph nodes
    const validStartNodeIds = new Set<number>();
    for (const p of startPoints) {
      const id = this.findClosestNode(p);
      if (id !== null && !ignoredNodeIds.has(id)) {
        validStartNodeIds.add(id);
      }
    }

    if (validStartNodeIds.size === 0) return false;

    // 2. BFS from endNodeId
    const queue: number[] = [endNodeId];
    const visited = new Set<number>();
    visited.add(endNodeId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      if (validStartNodeIds.has(currentId)) {
        return true; // Found a path!
      }

      const node = this.nodes.get(currentId);
      if (!node) continue;

      for (const neighborId of node.neighbors.keys()) {
        if (!visited.has(neighborId) && !ignoredNodeIds.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    return false;
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

  findBoundaryEntries(targetPoint: L.LatLng, area: L.LatLng[]): BoundaryEntry[] {
    const entries: BoundaryEntry[] = [];

    // 1. Find closest graph node to target (defend point)
    const targetNodeId = this.graph.findClosestNode(targetPoint);
    if (targetNodeId === null) {
      console.warn('No graph nodes found near target');
      return [];
    }

    // 2. Run Dijkstra ONCE from target to compute all shortest paths
    const { previous } = this.graph.computeShortestPathsFrom(targetNodeId);

    for (const road of this.roads) {
      const boundaryPoints = this.findRoadPolygonIntersections(road, area);

      for (const bp of boundaryPoints) {
        // 3. Find closest graph node to entry point
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

        // 4. Reconstruct path from cached results
        const pathPoints = this.graph.reconstructPath(startNodeId, previous);

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

  private findRoadPolygonIntersections(
    road: RoadSegment,
    polygon: L.LatLng[]
  ): Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> {
    const intersections: Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> = [];

    for (let i = 0; i < road.points.length - 1; i++) {
      const roadP1 = road.points[i];
      const roadP2 = road.points[i + 1];

      // Check intersection with each polygon edge
      for (let j = 0; j < polygon.length; j++) {
        const polyP1 = polygon[j];
        const polyP2 = polygon[(j + 1) % polygon.length];

        const intersection = lineSegmentIntersection(roadP1, roadP2, polyP1, polyP2);

        if (intersection) {
          // Determine if this is an entry point (road going from outside to inside)
          const roadP1Inside = pointInPolygon(roadP1, polygon);
          const roadP2Inside = pointInPolygon(roadP2, polygon);

          // Only count as entry if going from outside to inside
          if (!roadP1Inside && roadP2Inside) {
            // Determine approximate edge direction for compatibility
            const edge = this.getPolygonEdgeDirection(polyP1, polyP2);
            intersections.push({ position: intersection, pointIndex: i, edge });
          }
        }
      }
    }

    return intersections;
  }

  private getPolygonEdgeDirection(p1: L.LatLng, p2: L.LatLng): 'north' | 'south' | 'east' | 'west' {
    const latDiff = Math.abs(p2.lat - p1.lat);
    const lngDiff = Math.abs(p2.lng - p1.lng);

    if (latDiff > lngDiff) {
      // More vertical edge
      const avgLng = (p1.lng + p2.lng) / 2;
      const centerLng = (this.bounds.getWest() + this.bounds.getEast()) / 2;
      return avgLng > centerLng ? 'east' : 'west';
    } else {
      // More horizontal edge
      const avgLat = (p1.lat + p2.lat) / 2;
      const centerLat = (this.bounds.getSouth() + this.bounds.getNorth()) / 2;
      return avgLat > centerLat ? 'north' : 'south';
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

  simulateNodeRemoval(center: L.LatLng, radiusMeters: number, baseLocation: L.LatLng, entryPoints: BoundaryEntry[]): boolean {
    const nodesToRemove = this.graph.getNodesInRadius(center, radiusMeters);
    if (nodesToRemove.length === 0) return true; // No damage to graph, so safe

    const ignoredNodes = new Set<number>(nodesToRemove);
    const startPoints = entryPoints.map(e => e.position);

    return this.graph.checkConnectivity(startPoints, baseLocation, ignoredNodes);
  }

  removeRoadsInRadius(center: L.LatLng, radiusMeters: number): void {
    const nodesToRemove = this.graph.getNodesInRadius(center, radiusMeters);
    for (const nodeId of nodesToRemove) {
      this.graph.removeNode(nodeId);
    }
  }

  findPath(start: L.LatLng, end: L.LatLng): L.LatLng[] | null {
    const startNodeId = this.graph.findClosestNode(start);
    const endNodeId = this.graph.findClosestNode(end);

    if (startNodeId === null || endNodeId === null) return null;

    const path = this.graph.findShortestPath(startNodeId, endNodeId);
    if (path) {
        // Prepend start and append end for accuracy
        return [start, ...path, end];
    }
    return null;
  }
}

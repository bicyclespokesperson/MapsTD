import * as L from 'leaflet';
import { RoadSegment } from './overpassClient';
import { pointInPolygon, lineSegmentPolygonIntersection } from './geometry';

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
  private entryPointsFromClipping: Array<{ position: L.LatLng; roadId: number; nodeId: number }> = [];
  private nextSyntheticNodeId = -1;

  constructor(roads: RoadSegment[], bounds: L.LatLngBounds, area?: L.LatLng[]) {
    // Filter and clip roads to only include segments within the area
    if (area) {
      this.roads = this.filterAndClipRoadsByArea(roads, area);
      console.log(`Filtered roads: ${roads.length} total roads -> ${this.roads.length} road segments within area`);
      console.log(`Found ${this.entryPointsFromClipping.length} entry points during clipping`);
    } else {
      this.roads = roads;
    }
    this.bounds = bounds;
    this.graph = new RoutingGraph(this.roads);
  }

  private generateSyntheticNodeId(): number {
    return this.nextSyntheticNodeId--;
  }

  private filterAndClipRoadsByArea(roads: RoadSegment[], area: L.LatLng[]): RoadSegment[] {
    console.log('Filtering roads by area:', {
      areaCorners: area.length,
      area: area.map(p => `(${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`),
      totalRoads: roads.length
    });

    const clippedRoads: RoadSegment[] = [];
    let nextSegmentId = roads.length;

    for (const road of roads) {
      const segments = this.splitRoadByArea(road, area, nextSegmentId);
      clippedRoads.push(...segments);
      nextSegmentId += segments.length;
    }

    console.log(`Clipping result: ${roads.length} roads -> ${clippedRoads.length} clipped segments`);
    return clippedRoads;
  }

  private splitRoadByArea(road: RoadSegment, area: L.LatLng[], baseId: number): RoadSegment[] {
    const segments: RoadSegment[] = [];
    let currentSegmentPoints: L.LatLng[] = [];
    let currentSegmentNodeIds: number[] = [];
    let segmentIndex = 0;
    let entryNodeId: number | null = null;

    for (let i = 0; i < road.points.length; i++) {
      const currentPoint = road.points[i];
      const currentInside = pointInPolygon(currentPoint, area);

      if (i > 0) {
        const prevPoint = road.points[i - 1];
        const prevInside = pointInPolygon(prevPoint, area);

        if (!prevInside && !currentInside) {
          // Both points outside - check if segment passes through polygon
          const intersections = this.findAllIntersections(prevPoint, currentPoint, area);
          if (intersections.length >= 2) {
            // Segment passes through polygon - create a segment from first to second intersection
            const entryId = this.generateSyntheticNodeId();
            const exitId = this.generateSyntheticNodeId();

            segments.push({
              id: baseId + segmentIndex,
              points: [intersections[0], intersections[1]],
              nodeIds: [entryId, exitId],
              tags: road.tags,
              highway: road.highway,
            });

            // Both intersections are entry points (enemies can come from either direction)
            this.entryPointsFromClipping.push({
              position: intersections[0],
              roadId: baseId + segmentIndex,
              nodeId: entryId
            });
            this.entryPointsFromClipping.push({
              position: intersections[1],
              roadId: baseId + segmentIndex,
              nodeId: exitId
            });

            segmentIndex++;
          }
        } else if (!prevInside && currentInside) {
          // Entering: add intersection point to start new segment
          const intersection = lineSegmentPolygonIntersection(prevPoint, currentPoint, area);
          if (intersection) {
            entryNodeId = this.generateSyntheticNodeId();
            currentSegmentPoints.push(intersection);
            currentSegmentNodeIds.push(entryNodeId);
          }
        }
      }

      if (currentInside) {
        currentSegmentPoints.push(currentPoint);
        currentSegmentNodeIds.push(road.nodeIds[i]);
      }

      if (i < road.points.length - 1) {
        const nextPoint = road.points[i + 1];
        const nextInside = pointInPolygon(nextPoint, area);

        if (currentInside && !nextInside) {
          // Exiting: add intersection point and close segment
          const intersection = lineSegmentPolygonIntersection(currentPoint, nextPoint, area);
          if (intersection) {
            const exitNodeId = this.generateSyntheticNodeId();
            currentSegmentPoints.push(intersection);
            currentSegmentNodeIds.push(exitNodeId);

            this.entryPointsFromClipping.push({
              position: intersection,
              roadId: baseId + segmentIndex,
              nodeId: exitNodeId
            });
          }

          if (entryNodeId !== null && currentSegmentPoints.length >= 2) {
            this.entryPointsFromClipping.push({
              position: currentSegmentPoints[0],
              roadId: baseId + segmentIndex,
              nodeId: entryNodeId
            });
          }

          if (currentSegmentPoints.length >= 2) {
            segments.push({
              id: baseId + segmentIndex,
              points: currentSegmentPoints,
              nodeIds: currentSegmentNodeIds,
              tags: road.tags,
              highway: road.highway,
            });
            segmentIndex++;
          }

          currentSegmentPoints = [];
          currentSegmentNodeIds = [];
          entryNodeId = null;
        }
      }
    }

    // Add final segment if it exists and has at least 2 points
    if (currentSegmentPoints.length >= 2) {
      if (entryNodeId !== null) {
        this.entryPointsFromClipping.push({
          position: currentSegmentPoints[0],
          roadId: baseId + segmentIndex,
          nodeId: entryNodeId
        });
      }

      segments.push({
        id: baseId + segmentIndex,
        points: currentSegmentPoints,
        nodeIds: currentSegmentNodeIds,
        tags: road.tags,
        highway: road.highway,
      });
    }

    return segments;
  }

  private findAllIntersections(p1: L.LatLng, p2: L.LatLng, polygon: L.LatLng[]): L.LatLng[] {
    const intersections: Array<{ point: L.LatLng; t: number }> = [];

    for (let i = 0; i < polygon.length; i++) {
      const edgeStart = polygon[i];
      const edgeEnd = polygon[(i + 1) % polygon.length];

      const intersection = this.lineSegmentIntersectionWithT(p1, p2, edgeStart, edgeEnd);
      if (intersection) {
        intersections.push(intersection);
      }
    }

    // Sort by parameter t (position along p1->p2)
    intersections.sort((a, b) => a.t - b.t);
    return intersections.map(i => i.point);
  }

  private lineSegmentIntersectionWithT(
    p1: L.LatLng, p2: L.LatLng,
    p3: L.LatLng, p4: L.LatLng
  ): { point: L.LatLng; t: number } | null {
    const x1 = p1.lng, y1 = p1.lat;
    const x2 = p2.lng, y2 = p2.lat;
    const x3 = p3.lng, y3 = p3.lat;
    const x4 = p4.lng, y4 = p4.lat;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-12) {
      return null;
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const x = x1 + t * (x2 - x1);
      const y = y1 + t * (y2 - y1);
      return { point: L.latLng(y, x), t };
    }

    return null;
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

    // 3. Use entry points discovered during road clipping
    for (const entryPoint of this.entryPointsFromClipping) {
      // Find the road this entry belongs to
      const road = this.roads.find(r => r.id === entryPoint.roadId);
      if (!road) continue;

      // The entry point is the first point of the clipped road segment
      const startNodeId = entryPoint.nodeId;

      // Reconstruct path from entry node to target
      const pathPoints = this.graph.reconstructPath(startNodeId, previous);

      if (pathPoints && pathPoints.length > 0) {
        // Prepend the exact boundary intersection point
        pathPoints.unshift(entryPoint.position);
        // Append the exact target point
        pathPoints.push(targetPoint);

        // Determine which edge this entry point is on
        const edge = this.determineEdge(entryPoint.position, area);

        entries.push({
          position: entryPoint.position,
          roadPath: {
            roadId: road.id,
            waypoints: pathPoints,
            highway: road.highway
          },
          edge,
        });
      }
    }

    console.log(`Found ${entries.length} boundary entry points with valid paths`);
    return entries;
  }

  private determineEdge(point: L.LatLng, area: L.LatLng[]): 'north' | 'south' | 'east' | 'west' {
    // Find which polygon edge is closest to this point
    let closestEdge: 'north' | 'south' | 'east' | 'west' = 'north';
    let closestDistance = Infinity;

    for (let i = 0; i < area.length; i++) {
      const edgeStart = area[i];
      const edgeEnd = area[(i + 1) % area.length];

      // Calculate distance from point to this edge
      const distance = point.distanceTo(edgeStart) + point.distanceTo(edgeEnd);

      if (distance < closestDistance) {
        closestDistance = distance;
        // Determine edge direction based on lat/lng
        const avgLat = (edgeStart.lat + edgeEnd.lat) / 2;
        const avgLng = (edgeStart.lng + edgeEnd.lng) / 2;
        const centerLat = area.reduce((sum, p) => sum + p.lat, 0) / area.length;
        const centerLng = area.reduce((sum, p) => sum + p.lng, 0) / area.length;

        if (avgLat > centerLat) closestEdge = 'north';
        else if (avgLat < centerLat) closestEdge = 'south';
        else if (avgLng > centerLng) closestEdge = 'east';
        else closestEdge = 'west';
      }
    }

    return closestEdge;
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

import { describe, it, expect } from 'vitest';
import * as L from 'leaflet';
import { RoadNetwork } from './roadNetwork';
import { RoadSegment } from './overpassClient';

describe('RoadNetwork Bomb Features', () => {
  // A square graph: 1--2--3
  //                  |  |
  //                  4--5
  const bounds = L.latLngBounds(L.latLng(-1, -1), L.latLng(1, 1));
  
  // 0.001 degrees is approx 111 meters.
  const p1 = L.latLng(0, 0);       // Node 1
  const p2 = L.latLng(0, 0.001);   // Node 2
  const p3 = L.latLng(0, 0.002);   // Node 3
  const p4 = L.latLng(-0.001, 0);  // Node 4
  const p5 = L.latLng(-0.001, 0.001); // Node 5

  const roads: RoadSegment[] = [
      { id: 1, nodeIds: [1, 2], points: [p1, p2], highway: 'residential', tags: {} },
      { id: 2, nodeIds: [2, 3], points: [p2, p3], highway: 'residential', tags: {} },
      { id: 3, nodeIds: [1, 4], points: [p1, p4], highway: 'residential', tags: {} },
      { id: 4, nodeIds: [4, 5], points: [p4, p5], highway: 'residential', tags: {} },
      { id: 5, nodeIds: [2, 5], points: [p2, p5], highway: 'residential', tags: {} }
  ];

  it('findPath should find a path', () => {
      const network = new RoadNetwork(roads, bounds);
      const path = network.findPath(p1, p5);
      expect(path).not.toBeNull();
      expect(path?.length).toBeGreaterThan(0);
  });

  it('removeRoadsInRadius should remove nodes and affect paths', () => {
      const network = new RoadNetwork(roads, bounds);
      
      // Path 1 -> 5 exists via 1-2-5 or 1-4-5.
      
      // Remove Node 2 (center of 1-2, 2-3, 2-5).
      // p2 is at (0, 0.001).
      // Radius of 20m should catch it (0 distance).
      
      network.removeRoadsInRadius(p2, 20); 
      
      // 1->2 is broken. 2->5 is broken.
      // But 1->4->5 should still exist.
      const path = network.findPath(p1, p5);
      expect(path).not.toBeNull();
      
      // Remove Node 4 as well.
      network.removeRoadsInRadius(p4, 20);
      
      // Now 1->4 is broken. 1 is isolated from 5.
      const path2 = network.findPath(p1, p5);
      expect(path2).toBeNull(); 
  });
});

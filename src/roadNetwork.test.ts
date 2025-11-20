import { describe, it, expect } from 'vitest';
import * as L from 'leaflet';
import { RoadNetwork } from './roadNetwork';
import { RoadSegment } from './overpassClient';

describe('RoadNetwork', () => {
  const bounds = L.latLngBounds(
    L.latLng(37.77, -122.42),
    L.latLng(37.78, -122.41)
  );

  const road: RoadSegment = {
    id: 1,
    points: [
      L.latLng(37.775, -122.415),
      L.latLng(37.775, -122.420) // Horizontal road
    ],
    highway: 'residential',
    tags: {}
  };

  const network = new RoadNetwork([road], bounds);

  describe('isPointOnRoad', () => {
    it('should return true for point exactly on road', () => {
      const point = L.latLng(37.775, -122.417);
      expect(network.isPointOnRoad(point)).toBe(true);
    });

    it('should return true for point close to road', () => {
      // Very small offset
      const point = L.latLng(37.7750001, -122.417);
      expect(network.isPointOnRoad(point)).toBe(true);
    });

    it('should return false for point far from road', () => {
      const point = L.latLng(37.776, -122.417);
      expect(network.isPointOnRoad(point)).toBe(false);
    });

    it('should return true for point at endpoint', () => {
      const point = L.latLng(37.775, -122.415);
      expect(network.isPointOnRoad(point)).toBe(true);
    });
  });
});

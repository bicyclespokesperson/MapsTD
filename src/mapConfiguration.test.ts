import { describe, it, expect } from 'vitest';
import * as L from 'leaflet';
import { MapConfiguration } from './mapConfiguration';

describe('MapConfiguration', () => {
  const validArea = [
    L.latLng(37.78, -122.42),
    L.latLng(37.78, -122.41),
    L.latLng(37.77, -122.41),
    L.latLng(37.77, -122.42),
  ];
  const validBaseLocation = L.latLng(37.775, -122.415);

  describe('constructor', () => {
    it('should create a valid configuration', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      expect(config.area).toBe(validArea);
      expect(config.baseLocation).toBe(validBaseLocation);
      expect(config.metadata.createdAt).toBeDefined();
    });

    it('should throw error if base location is outside area', () => {
      const outsidePoint = L.latLng(37.79, -122.40);
      expect(() => {
        new MapConfiguration(validArea, outsidePoint);
      }).toThrow('Base location must be inside the map bounds');
    });

    it('should throw error if map is too small', () => {
      const tinyArea = [
        L.latLng(37.771, -122.42),
        L.latLng(37.771, -122.419),
        L.latLng(37.77, -122.419),
        L.latLng(37.77, -122.42),
      ];
      const point = L.latLng(37.7705, -122.4195);
      expect(() => {
        new MapConfiguration(tinyArea, point);
      }).toThrow(/Map width must be between/);
    });

    it('should accept optional name', () => {
      const config = new MapConfiguration(validArea, validBaseLocation, 'Test Map');
      expect(config.metadata.name).toBe('Test Map');
    });
  });

  describe('bounds getter', () => {
    it('should return bounding box of area', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const bounds = config.bounds;

      expect(bounds.getNorth()).toBeCloseTo(37.78);
      expect(bounds.getSouth()).toBeCloseTo(37.77);
      expect(bounds.getEast()).toBeCloseTo(-122.41);
      expect(bounds.getWest()).toBeCloseTo(-122.42);
    });
  });

  describe('isValidTowerPosition', () => {
    it('should reject positions outside area', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const outsidePoint = L.latLng(37.79, -122.40);
      expect(config.isValidTowerPosition(outsidePoint)).toBe(false);
    });

    it('should reject positions too close to base location', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const tooClose = L.latLng(37.7751, -122.415);
      expect(config.isValidTowerPosition(tooClose)).toBe(false);
    });

    it('should accept valid positions', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      // Position needs to be: inside area AND outside 500m no-build radius
      // Base is at 37.775, -122.415 - we need to be more than ~0.0045 degrees away
      const validPosition = L.latLng(37.779, -122.418);
      expect(config.isValidTowerPosition(validPosition)).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const config = new MapConfiguration(validArea, validBaseLocation, 'Test Map');
      const json = config.toJSON();

      expect(json.version).toBe('1.0.0');
      expect(json.area.corners).toHaveLength(4);
      expect(json.area.corners[0].lat).toBeCloseTo(37.78);
      expect(json.area.corners[0].lng).toBeCloseTo(-122.42);
      expect(json.baseLocation.lat).toBeCloseTo(37.775);
      expect(json.baseLocation.lng).toBeCloseTo(-122.415);
      expect(json.metadata?.name).toBe('Test Map');
    });

    it('should serialize to string', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const str = config.toString();

      expect(str).toContain('"version"');
      expect(str).toContain('"area"');
      expect(str).toContain('"baseLocation"');
      expect(() => JSON.parse(str)).not.toThrow();
    });

    it('should deserialize from JSON', () => {
      const original = new MapConfiguration(validArea, validBaseLocation, 'Test Map');
      const json = original.toJSON();
      const restored = MapConfiguration.fromJSON(json);

      expect(restored.area.length).toBe(original.area.length);
      expect(restored.bounds.getNorth()).toBeCloseTo(original.bounds.getNorth());
      expect(restored.bounds.getSouth()).toBeCloseTo(original.bounds.getSouth());
      expect(restored.bounds.getEast()).toBeCloseTo(original.bounds.getEast());
      expect(restored.bounds.getWest()).toBeCloseTo(original.bounds.getWest());
      expect(restored.baseLocation.lat).toBeCloseTo(original.baseLocation.lat);
      expect(restored.baseLocation.lng).toBeCloseTo(original.baseLocation.lng);
      expect(restored.metadata.name).toBe('Test Map');
    });

    it('should deserialize from string', () => {
      const original = new MapConfiguration(validArea, validBaseLocation);
      const str = original.toString();
      const restored = MapConfiguration.fromString(str);

      expect(restored.bounds.getNorth()).toBeCloseTo(original.bounds.getNorth());
      expect(restored.baseLocation.lat).toBeCloseTo(original.baseLocation.lat);
    });
  });

  describe('getBoundsSizeKm', () => {
    it('should return approximate size in kilometers', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const size = config.getBoundsSizeKm();

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.width).toBeLessThan(2);
      expect(size.height).toBeLessThan(2);
    });
  });

  describe('getBoundsSizeMiles', () => {
    it('should return approximate size in miles', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const size = config.getBoundsSizeMiles();

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.width).toBeLessThan(1.5);
      expect(size.height).toBeLessThan(1.5);
    });
  });

  describe('boundsToArea', () => {
    it('should convert LatLngBounds to area polygon', () => {
      const bounds = L.latLngBounds(
        L.latLng(37.77, -122.42),
        L.latLng(37.78, -122.41)
      );
      const area = MapConfiguration.boundsToArea(bounds);

      expect(area).toHaveLength(4);
      // Check corners are NW, NE, SE, SW
      expect(area[0].lat).toBeCloseTo(37.78); // North
      expect(area[0].lng).toBeCloseTo(-122.42); // West
      expect(area[1].lat).toBeCloseTo(37.78); // North
      expect(area[1].lng).toBeCloseTo(-122.41); // East
      expect(area[2].lat).toBeCloseTo(37.77); // South
      expect(area[2].lng).toBeCloseTo(-122.41); // East
      expect(area[3].lat).toBeCloseTo(37.77); // South
      expect(area[3].lng).toBeCloseTo(-122.42); // West
    });
  });

  describe('getAreaKm2', () => {
    it('should return the area in km²', () => {
      const config = new MapConfiguration(validArea, validBaseLocation);
      const size = config.getBoundsSizeKm();
      const expectedArea = size.width * size.height;
      expect(config.getAreaKm2()).toBeCloseTo(expectedArea);
    });
  });

  describe('calculateStartingMoney', () => {
    it('should return at least the minimum starting money', () => {
      // validArea is ~1km x ~1km, so should get more than minimum
      const config = new MapConfiguration(validArea, validBaseLocation);
      expect(config.calculateStartingMoney()).toBeGreaterThanOrEqual(200);
    });

    it('should scale up for larger maps', () => {
      // Create a larger area (~2km x ~2km)
      const largeArea = [
        L.latLng(37.78, -122.44), // ~3km difference in lng
        L.latLng(37.78, -122.41),
        L.latLng(37.75, -122.41), // ~3km difference in lat
        L.latLng(37.75, -122.44),
      ];
      const baseLocation = L.latLng(37.765, -122.425);
      const config = new MapConfiguration(largeArea, baseLocation);
      
      // Larger map should get more money than base
      expect(config.calculateStartingMoney()).toBeGreaterThan(200);
    });

    it('should not exceed maximum starting money', () => {
      // Create a large valid area (~6.5km x ~6.5km = ~42 km²)
      // At 0.5 km² reference, that would be ~84x the base = $16,800
      // But capped at $2000
      const largeArea = [
        L.latLng(37.83, -122.49),
        L.latLng(37.83, -122.41),  // ~6.7km lng difference at this latitude
        L.latLng(37.77, -122.41),  // ~6.7km lat difference
        L.latLng(37.77, -122.49),
      ];
      const baseLocation = L.latLng(37.80, -122.45);
      const config = new MapConfiguration(largeArea, baseLocation);
      
      expect(config.calculateStartingMoney()).toBeLessThanOrEqual(2000);
    });
  });
});


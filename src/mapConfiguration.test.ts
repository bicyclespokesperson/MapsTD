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

      expect(json.version).toBe('3.0.0');
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

    it('should deserialize from legacy v1.0.0 format (bounds only)', () => {
      const legacyJson = '{"version":"1.0.0","bounds":{"north":37.78,"south":37.77,"east":-122.41,"west":-122.42},"baseLocation":{"lat":37.775,"lng":-122.415},"metadata":{"name":"Legacy Map"}}';
      const config = MapConfiguration.fromString(legacyJson);

      expect(config.area).toHaveLength(4);
      expect(config.bounds.getNorth()).toBeCloseTo(37.78);
      expect(config.bounds.getSouth()).toBeCloseTo(37.77);
      expect(config.baseLocation.lat).toBeCloseTo(37.775);
      expect(config.metadata.name).toBe('Legacy Map');
    });

    it('should deserialize from legacy v2.0.0 format (with customArea)', () => {
      const legacyJson = '{"version":"2.0.0","bounds":{"north":37.78,"south":37.77,"east":-122.41,"west":-122.42},"baseLocation":{"lat":37.775,"lng":-122.415},"customArea":{"corners":[{"lat":37.78,"lng":-122.42},{"lat":37.78,"lng":-122.41},{"lat":37.77,"lng":-122.41},{"lat":37.77,"lng":-122.42}]},"metadata":{"name":"Custom Area Map"}}';
      const config = MapConfiguration.fromString(legacyJson);

      expect(config.area).toHaveLength(4);
      expect(config.area[0].lat).toBeCloseTo(37.78);
      expect(config.area[0].lng).toBeCloseTo(-122.42);
      expect(config.metadata.name).toBe('Custom Area Map');
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
});

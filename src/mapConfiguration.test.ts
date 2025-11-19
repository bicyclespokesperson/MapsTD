import { describe, it, expect } from 'vitest';
import * as L from 'leaflet';
import { MapConfiguration } from './mapConfiguration';

describe('MapConfiguration', () => {
  const validBounds = L.latLngBounds(
    L.latLng(37.77, -122.42),
    L.latLng(37.78, -122.41)
  );
  const validDefendPoint = L.latLng(37.775, -122.415);

  describe('constructor', () => {
    it('should create a valid configuration', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      expect(config.bounds).toBe(validBounds);
      expect(config.defendPoint).toBe(validDefendPoint);
      expect(config.metadata.createdAt).toBeDefined();
    });

    it('should throw error if defend point is outside bounds', () => {
      const outsidePoint = L.latLng(37.79, -122.40);
      expect(() => {
        new MapConfiguration(validBounds, outsidePoint);
      }).toThrow('Defend point must be inside the map bounds');
    });

    it('should throw error if map is too small', () => {
      const tinyBounds = L.latLngBounds(
        L.latLng(37.77, -122.42),
        L.latLng(37.771, -122.419)
      );
      const point = L.latLng(37.7705, -122.4195);
      expect(() => {
        new MapConfiguration(tinyBounds, point);
      }).toThrow(/Map width must be between/);
    });

    it('should accept optional name', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint, 'Test Map');
      expect(config.metadata.name).toBe('Test Map');
    });
  });

  describe('isValidTowerPosition', () => {
    it('should reject positions outside bounds', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const outsidePoint = L.latLng(37.79, -122.40);
      expect(config.isValidTowerPosition(outsidePoint)).toBe(false);
    });

    it('should reject positions too close to defend point', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const tooClose = L.latLng(37.7751, -122.415);
      expect(config.isValidTowerPosition(tooClose)).toBe(false);
    });

    it('should accept valid positions', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const validPosition = L.latLng(37.776, -122.418);
      expect(config.isValidTowerPosition(validPosition)).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint, 'Test Map');
      const json = config.toJSON();

      expect(json.version).toBe('1.0.0');
      expect(json.bounds.north).toBeCloseTo(37.78);
      expect(json.bounds.south).toBeCloseTo(37.77);
      expect(json.bounds.east).toBeCloseTo(-122.41);
      expect(json.bounds.west).toBeCloseTo(-122.42);
      expect(json.defendPoint.lat).toBeCloseTo(37.775);
      expect(json.defendPoint.lng).toBeCloseTo(-122.415);
      expect(json.metadata?.name).toBe('Test Map');
    });

    it('should serialize to string', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const str = config.toString();

      expect(str).toContain('"version"');
      expect(str).toContain('"bounds"');
      expect(str).toContain('"defendPoint"');
      expect(() => JSON.parse(str)).not.toThrow();
    });

    it('should deserialize from JSON', () => {
      const original = new MapConfiguration(validBounds, validDefendPoint, 'Test Map');
      const json = original.toJSON();
      const restored = MapConfiguration.fromJSON(json);

      expect(restored.bounds.getNorth()).toBeCloseTo(original.bounds.getNorth());
      expect(restored.bounds.getSouth()).toBeCloseTo(original.bounds.getSouth());
      expect(restored.bounds.getEast()).toBeCloseTo(original.bounds.getEast());
      expect(restored.bounds.getWest()).toBeCloseTo(original.bounds.getWest());
      expect(restored.defendPoint.lat).toBeCloseTo(original.defendPoint.lat);
      expect(restored.defendPoint.lng).toBeCloseTo(original.defendPoint.lng);
      expect(restored.metadata.name).toBe('Test Map');
    });

    it('should deserialize from string', () => {
      const original = new MapConfiguration(validBounds, validDefendPoint);
      const str = original.toString();
      const restored = MapConfiguration.fromString(str);

      expect(restored.bounds.getNorth()).toBeCloseTo(original.bounds.getNorth());
      expect(restored.defendPoint.lat).toBeCloseTo(original.defendPoint.lat);
    });
  });

  describe('getBoundsSizeKm', () => {
    it('should return approximate size in kilometers', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const size = config.getBoundsSizeKm();

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.width).toBeLessThan(2);
      expect(size.height).toBeLessThan(2);
    });
  });

  describe('getBoundsSizeMiles', () => {
    it('should return approximate size in miles', () => {
      const config = new MapConfiguration(validBounds, validDefendPoint);
      const size = config.getBoundsSizeMiles();

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.width).toBeLessThan(1.5);
      expect(size.height).toBeLessThan(1.5);
    });
  });
});

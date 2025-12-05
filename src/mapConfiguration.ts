import * as L from 'leaflet';

import { GAME_CONFIG } from './config';

export interface MapConfigData {
  version: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  baseLocation: {
    lat: number;
    lng: number;
  };
  metadata?: {
    createdAt?: string;
    name?: string;
  };
}

export class MapConfiguration {
  private static readonly VERSION = '1.0.0';

  bounds: L.LatLngBounds;
  baseLocation: L.LatLng;
  metadata: {
    createdAt: string;
    name?: string;
  };

  constructor(bounds: L.LatLngBounds, baseLocation: L.LatLng, name?: string) {
    this.bounds = bounds;
    this.baseLocation = baseLocation;
    this.metadata = {
      createdAt: new Date().toISOString(),
      name,
    };

    this.validate();
  }

  private validate(): void {
    if (!this.bounds.contains(this.baseLocation)) {
      throw new Error('Base location must be inside the map bounds');
    }

    const boundsSizeKm = this.getBoundsSizeKm();
    if (boundsSizeKm.width < GAME_CONFIG.MAP.MIN_WIDTH_KM || boundsSizeKm.width > GAME_CONFIG.MAP.MAX_WIDTH_KM) {
      throw new Error(`Map width must be between ${GAME_CONFIG.MAP.MIN_WIDTH_KM} and ${GAME_CONFIG.MAP.MAX_WIDTH_KM} km`);
    }
    if (boundsSizeKm.height < GAME_CONFIG.MAP.MIN_HEIGHT_KM || boundsSizeKm.height > GAME_CONFIG.MAP.MAX_HEIGHT_KM) {
      throw new Error(`Map height must be between ${GAME_CONFIG.MAP.MIN_HEIGHT_KM} and ${GAME_CONFIG.MAP.MAX_HEIGHT_KM} km`);
    }
  }

  getBoundsSizeKm(): { width: number; height: number } {
    const sw = this.bounds.getSouthWest();
    const ne = this.bounds.getNorthEast();
    const nw = L.latLng(ne.lat, sw.lng);
    const se = L.latLng(sw.lat, ne.lng);

    const width = sw.distanceTo(se) / 1000;
    const height = sw.distanceTo(nw) / 1000;

    return { width, height };
  }

  getBoundsSizeMiles(): { width: number; height: number } {
    const km = this.getBoundsSizeKm();
    return {
      width: km.width * 0.621371,
      height: km.height * 0.621371,
    };
  }

  getNoBuildRadiusMeters(): number {
    return GAME_CONFIG.MAP.NO_BUILD_RADIUS_METERS;
  }

  isValidTowerPosition(position: L.LatLng): boolean {
    if (!this.bounds.contains(position)) {
      return false;
    }

    const distanceToBase = position.distanceTo(this.baseLocation);
    if (distanceToBase < GAME_CONFIG.MAP.NO_BUILD_RADIUS_METERS) {
      return false;
    }

    return true;
  }

  toJSON(): MapConfigData {
    return {
      version: MapConfiguration.VERSION,
      bounds: {
        north: this.bounds.getNorth(),
        south: this.bounds.getSouth(),
        east: this.bounds.getEast(),
        west: this.bounds.getWest(),
      },
      baseLocation: {
        lat: this.baseLocation.lat,
        lng: this.baseLocation.lng,
      },
      metadata: this.metadata,
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  static fromJSON(data: MapConfigData): MapConfiguration {
    const bounds = L.latLngBounds(
      L.latLng(data.bounds.south, data.bounds.west),
      L.latLng(data.bounds.north, data.bounds.east)
    );

    const baseLocation = L.latLng(data.baseLocation.lat, data.baseLocation.lng);

    const config = new MapConfiguration(bounds, baseLocation, data.metadata?.name);
    config.metadata.createdAt = data.metadata?.createdAt || config.metadata.createdAt;

    return config;
  }

  static fromString(jsonString: string): MapConfiguration {
    const data = JSON.parse(jsonString) as MapConfigData;
    return MapConfiguration.fromJSON(data);
  }
}

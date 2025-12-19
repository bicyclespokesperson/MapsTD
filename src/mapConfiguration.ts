import * as L from 'leaflet';

import { GAME_CONFIG } from './config';
import { pointInPolygon, computeBoundingBox } from './geometry';

interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface MapConfigData {
  version: string;
  area: {
    corners: LatLngPoint[];
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

  area: L.LatLng[];
  baseLocation: L.LatLng;
  metadata: {
    createdAt: string;
    name?: string;
  };

  constructor(area: L.LatLng[], baseLocation: L.LatLng, name?: string) {
    this.area = area;
    this.baseLocation = baseLocation;
    this.metadata = {
      createdAt: new Date().toISOString(),
      name,
    };

    this.validate();
  }

  get bounds(): L.LatLngBounds {
    return computeBoundingBox(this.area);
  }

  containsPoint(point: L.LatLng): boolean {
    return pointInPolygon(point, this.area);
  }

  private validate(): void {
    if (!this.containsPoint(this.baseLocation)) {
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
    const bounds = this.bounds;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
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

  getAreaKm2(): number {
    const size = this.getBoundsSizeKm();
    return size.width * size.height;
  }

  calculateStartingMoney(): number {
    const area = this.getAreaKm2();
    const { BASE_STARTING_MONEY, REFERENCE_MAP_AREA_KM2, MIN_STARTING_MONEY, MAX_STARTING_MONEY } = GAME_CONFIG.ECONOMY;
    
    // Linear scaling: larger maps get more money
    const scaledMoney = Math.round(BASE_STARTING_MONEY * (area / REFERENCE_MAP_AREA_KM2));
    
    // Apply min/max constraints
    return Math.max(MIN_STARTING_MONEY, Math.min(MAX_STARTING_MONEY, scaledMoney));
  }


  getNoBuildRadiusMeters(): number {
    return GAME_CONFIG.MAP.NO_BUILD_RADIUS_METERS;
  }

  isValidTowerPosition(position: L.LatLng): boolean {
    if (!this.containsPoint(position)) {
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
      area: {
        corners: this.area.map(c => ({ lat: c.lat, lng: c.lng })),
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
    const baseLocation = L.latLng(data.baseLocation.lat, data.baseLocation.lng);
    const area = data.area.corners.map(c => L.latLng(c.lat, c.lng));

    const config = new MapConfiguration(area, baseLocation, data.metadata?.name);
    config.metadata.createdAt = data.metadata?.createdAt || config.metadata.createdAt;

    return config;
  }

  static fromString(jsonString: string): MapConfiguration {
    const data = JSON.parse(jsonString) as MapConfigData;
    return MapConfiguration.fromJSON(data);
  }

  static boundsToArea(bounds: L.LatLngBounds): L.LatLng[] {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    return [
      L.latLng(north, west),
      L.latLng(north, east),
      L.latLng(south, east),
      L.latLng(south, west),
    ];
  }
}

import * as L from 'leaflet';

export interface MapConfigData {
  version: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  defendPoint: {
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
  private static readonly NO_BUILD_RADIUS_METERS = 100;

  bounds: L.LatLngBounds;
  defendPoint: L.LatLng;
  metadata: {
    createdAt: string;
    name?: string;
  };

  constructor(bounds: L.LatLngBounds, defendPoint: L.LatLng, name?: string) {
    this.bounds = bounds;
    this.defendPoint = defendPoint;
    this.metadata = {
      createdAt: new Date().toISOString(),
      name,
    };

    this.validate();
  }

  private validate(): void {
    if (!this.bounds.contains(this.defendPoint)) {
      throw new Error('Defend point must be inside the map bounds');
    }

    const boundsSizeKm = this.getBoundsSizeKm();
    if (boundsSizeKm.width < 0.8 || boundsSizeKm.width > 8) {
      throw new Error('Map width must be between 0.5 and 5 miles (0.8-8 km)');
    }
    if (boundsSizeKm.height < 0.8 || boundsSizeKm.height > 8) {
      throw new Error('Map height must be between 0.5 and 5 miles (0.8-8 km)');
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
    return MapConfiguration.NO_BUILD_RADIUS_METERS;
  }

  isValidTowerPosition(position: L.LatLng): boolean {
    if (!this.bounds.contains(position)) {
      return false;
    }

    const distanceToDefend = position.distanceTo(this.defendPoint);
    if (distanceToDefend < MapConfiguration.NO_BUILD_RADIUS_METERS) {
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
      defendPoint: {
        lat: this.defendPoint.lat,
        lng: this.defendPoint.lng,
      },
      metadata: this.metadata,
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  static fromJSON(data: MapConfigData): MapConfiguration {
    const bounds = L.latLngBounds(
      L.latLng(data.bounds.south, data.bounds.west),
      L.latLng(data.bounds.north, data.bounds.east)
    );

    const defendPoint = L.latLng(data.defendPoint.lat, data.defendPoint.lng);

    const config = new MapConfiguration(bounds, defendPoint, data.metadata?.name);
    config.metadata.createdAt = data.metadata?.createdAt || config.metadata.createdAt;

    return config;
  }

  static fromString(jsonString: string): MapConfiguration {
    const data = JSON.parse(jsonString) as MapConfigData;
    return MapConfiguration.fromJSON(data);
  }
}

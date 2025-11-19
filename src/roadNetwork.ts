import * as L from 'leaflet';
import { RoadSegment } from './overpassClient';

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

export class RoadNetwork {
  private roads: RoadSegment[];
  private bounds: L.LatLngBounds;

  constructor(roads: RoadSegment[], bounds: L.LatLngBounds) {
    this.roads = roads;
    this.bounds = bounds;
  }

  getAllRoads(): RoadSegment[] {
    return this.roads;
  }

  findBoundaryEntries(targetPoint: L.LatLng): BoundaryEntry[] {
    const entries: BoundaryEntry[] = [];
    const tolerance = 0.0001;

    for (const road of this.roads) {
      const boundaryPoints = this.findRoadBoundaryIntersections(road, tolerance);

      for (const bp of boundaryPoints) {
        const path = this.buildPathToTarget(road, bp.pointIndex, targetPoint);
        if (path) {
          entries.push({
            position: bp.position,
            roadPath: path,
            edge: bp.edge,
          });
        }
      }
    }

    console.log(`Found ${entries.length} boundary entry points`);
    return entries;
  }

  private findRoadBoundaryIntersections(
    road: RoadSegment,
    tolerance: number
  ): Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> {
    const intersections: Array<{ position: L.LatLng; pointIndex: number; edge: 'north' | 'south' | 'east' | 'west' }> = [];
    const north = this.bounds.getNorth();
    const south = this.bounds.getSouth();
    const east = this.bounds.getEast();
    const west = this.bounds.getWest();

    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];

      const crossesNorth = this.segmentCrossesHorizontal(p1, p2, north);
      if (crossesNorth) {
        const intersection = this.horizontalIntersection(p1, p2, north);
        if (intersection && this.isWithinBounds(intersection, 'horizontal')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'north' });
        }
      }

      const crossesSouth = this.segmentCrossesHorizontal(p1, p2, south);
      if (crossesSouth) {
        const intersection = this.horizontalIntersection(p1, p2, south);
        if (intersection && this.isWithinBounds(intersection, 'horizontal')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'south' });
        }
      }

      const crossesEast = this.segmentCrossesVertical(p1, p2, east);
      if (crossesEast) {
        const intersection = this.verticalIntersection(p1, p2, east);
        if (intersection && this.isWithinBounds(intersection, 'vertical')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'east' });
        }
      }

      const crossesWest = this.segmentCrossesVertical(p1, p2, west);
      if (crossesWest) {
        const intersection = this.verticalIntersection(p1, p2, west);
        if (intersection && this.isWithinBounds(intersection, 'vertical')) {
          intersections.push({ position: intersection, pointIndex: i, edge: 'west' });
        }
      }
    }

    return intersections;
  }

  private segmentCrossesHorizontal(p1: L.LatLng, p2: L.LatLng, lat: number): boolean {
    return (p1.lat <= lat && p2.lat >= lat) || (p1.lat >= lat && p2.lat <= lat);
  }

  private segmentCrossesVertical(p1: L.LatLng, p2: L.LatLng, lng: number): boolean {
    return (p1.lng <= lng && p2.lng >= lng) || (p1.lng >= lng && p2.lng <= lng);
  }

  private horizontalIntersection(p1: L.LatLng, p2: L.LatLng, lat: number): L.LatLng | null {
    const latDiff = p2.lat - p1.lat;
    if (Math.abs(latDiff) < 1e-10) return null;

    const t = (lat - p1.lat) / latDiff;
    const lng = p1.lng + t * (p2.lng - p1.lng);

    return L.latLng(lat, lng);
  }

  private verticalIntersection(p1: L.LatLng, p2: L.LatLng, lng: number): L.LatLng | null {
    const lngDiff = p2.lng - p1.lng;
    if (Math.abs(lngDiff) < 1e-10) return null;

    const t = (lng - p1.lng) / lngDiff;
    const lat = p1.lat + t * (p2.lat - p1.lat);

    return L.latLng(lat, lng);
  }

  private isWithinBounds(point: L.LatLng, direction: 'horizontal' | 'vertical'): boolean {
    if (direction === 'horizontal') {
      return point.lng >= this.bounds.getWest() && point.lng <= this.bounds.getEast();
    } else {
      return point.lat >= this.bounds.getSouth() && point.lat <= this.bounds.getNorth();
    }
  }

  private buildPathToTarget(
    road: RoadSegment,
    startIndex: number,
    targetPoint: L.LatLng
  ): RoadPath | null {
    const firstPoint = road.points[startIndex];
    const lastPoint = road.points[road.points.length - 1];

    const distFirstToTarget = firstPoint.distanceTo(targetPoint);
    const distLastToTarget = lastPoint.distanceTo(targetPoint);

    let waypoints: L.LatLng[];
    if (distFirstToTarget < distLastToTarget) {
      waypoints = road.points.slice(startIndex);
    } else {
      waypoints = road.points.slice(0, startIndex + 1).reverse();
    }

    waypoints.push(targetPoint);

    return {
      roadId: road.id,
      waypoints,
      highway: road.highway,
    };
  }

  getBounds(): L.LatLngBounds {
    return this.bounds;
  }
}

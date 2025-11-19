import * as L from 'leaflet';

export class CoordinateConverter {
  private map: L.Map;

  constructor(map: L.Map) {
    this.map = map;
  }

  latLngToPixel(latLng: L.LatLng): { x: number; y: number } {
    const point = this.map.latLngToContainerPoint(latLng);
    return { x: point.x, y: point.y };
  }

  pixelToLatLng(x: number, y: number): L.LatLng {
    return this.map.containerPointToLatLng([x, y]);
  }

  distanceInMeters(latLng1: L.LatLng, latLng2: L.LatLng): number {
    return latLng1.distanceTo(latLng2);
  }

  pixelsPerMeter(): number {
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom + 8);
    return 1 / metersPerPixel;
  }
}

import * as L from 'leaflet';

/**
 * Point-in-polygon test using ray casting algorithm.
 * Works for both convex and non-convex polygons.
 */
export function pointInPolygon(point: L.LatLng, polygon: L.LatLng[]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Compute the axis-aligned bounding box that encloses all corners.
 */
export function computeBoundingBox(corners: L.LatLng[]): L.LatLngBounds {
  if (corners.length === 0) {
    throw new Error('Cannot compute bounding box of empty polygon');
  }

  let minLat = corners[0].lat;
  let maxLat = corners[0].lat;
  let minLng = corners[0].lng;
  let maxLng = corners[0].lng;

  for (const corner of corners) {
    minLat = Math.min(minLat, corner.lat);
    maxLat = Math.max(maxLat, corner.lat);
    minLng = Math.min(minLng, corner.lng);
    maxLng = Math.max(maxLng, corner.lng);
  }

  return L.latLngBounds(
    L.latLng(minLat, minLng),
    L.latLng(maxLat, maxLng)
  );
}

/**
 * Calculate the area of a polygon in square meters using the Shoelace formula,
 * with approximate conversion from lat/lng to meters.
 */
export function polygonAreaSquareMeters(corners: L.LatLng[]): number {
  if (corners.length < 3) return 0;

  const centerLat = corners.reduce((sum, c) => sum + c.lat, 0) / corners.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

  let area = 0;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const xi = corners[i].lng * metersPerDegreeLng;
    const yi = corners[i].lat * metersPerDegreeLat;
    const xj = corners[j].lng * metersPerDegreeLng;
    const yj = corners[j].lat * metersPerDegreeLat;
    area += (xj + xi) * (yj - yi);
  }

  return Math.abs(area / 2);
}

/**
 * Find the intersection point of two line segments, if it exists.
 * Segment 1: p1 to p2
 * Segment 2: p3 to p4
 * Returns the intersection point, or null if segments don't intersect.
 */
export function lineSegmentIntersection(
  p1: L.LatLng,
  p2: L.LatLng,
  p3: L.LatLng,
  p4: L.LatLng
): L.LatLng | null {
  const x1 = p1.lng, y1 = p1.lat;
  const x2 = p2.lng, y2 = p2.lat;
  const x3 = p3.lng, y3 = p3.lat;
  const x4 = p4.lng, y4 = p4.lat;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);
    return L.latLng(y, x);
  }

  return null;
}

/**
 * Sort corners to form a valid convex quadrilateral (clockwise order).
 * Uses centroid-based angular sorting.
 */
export function sortCornersClockwise(corners: L.LatLng[]): L.LatLng[] {
  if (corners.length !== 4) {
    throw new Error('Expected exactly 4 corners');
  }

  const centerLat = corners.reduce((sum, c) => sum + c.lat, 0) / 4;
  const centerLng = corners.reduce((sum, c) => sum + c.lng, 0) / 4;

  return [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.lat - centerLat, a.lng - centerLng);
    const angleB = Math.atan2(b.lat - centerLat, b.lng - centerLng);
    return angleB - angleA; // Clockwise
  });
}

/**
 * Check if a quadrilateral is convex.
 */
export function isConvexQuadrilateral(corners: L.LatLng[]): boolean {
  if (corners.length !== 4) return false;

  const crossProducts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const p3 = corners[(i + 2) % 4];

    const v1x = p2.lng - p1.lng;
    const v1y = p2.lat - p1.lat;
    const v2x = p3.lng - p2.lng;
    const v2y = p3.lat - p2.lat;

    crossProducts.push(v1x * v2y - v1y * v2x);
  }

  const allPositive = crossProducts.every(cp => cp > 0);
  const allNegative = crossProducts.every(cp => cp < 0);

  return allPositive || allNegative;
}

/**
 * Find the intersection point between a line segment and a polygon boundary.
 * Returns the intersection point closest to p1, or null if no intersection exists.
 */
export function lineSegmentPolygonIntersection(
  p1: L.LatLng,
  p2: L.LatLng,
  polygon: L.LatLng[]
): L.LatLng | null {
  let closestIntersection: L.LatLng | null = null;
  let closestDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const edgeStart = polygon[i];
    const edgeEnd = polygon[(i + 1) % polygon.length];

    const intersection = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);

    if (intersection) {
      const distance = Math.sqrt(
        Math.pow(intersection.lat - p1.lat, 2) +
        Math.pow(intersection.lng - p1.lng, 2)
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIntersection = intersection;
      }
    }
  }

  return closestIntersection;
}

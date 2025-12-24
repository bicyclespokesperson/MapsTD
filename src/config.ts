import { LatLngExpression } from 'leaflet';
import { TOWER_CONFIGS } from './game/TowerTypes';

// Calculate average range dynamically
const towerRanges = Object.values(TOWER_CONFIGS).map(config => config.baseStats.range);
const averageRange = towerRanges.reduce((a, b) => a + b, 0) / towerRanges.length;

export const GAME_CONFIG = {
  MAP: {
    DEFAULT_CENTER: [37.82206464209891, -122.37301826477052] as LatLngExpression,
    DEFAULT_ZOOM: 15,
    NO_BUILD_RADIUS_METERS: 500,
    MIN_WIDTH_KM: 0.2,
    MAX_WIDTH_KM: 8,
    MIN_HEIGHT_KM: 0.2,
    MAX_HEIGHT_KM: 8,
    AVERAGE_TOWER_RANGE: averageRange,
  },
  SELECTION: {
    BOUNDS_COLOR: '#3388ff',
    BOUNDS_OPACITY: 0.1,
    NO_BUILD_COLOR: '#ff0000',
    NO_BUILD_OPACITY: 0.1,
  },
  ROADS: {
    COLOR_VISIBLE: 0xff6633,
    OPACITY_VISIBLE: 0.7,
    COLOR_HIDDEN: 0x333333,
    OPACITY_HIDDEN: 0,
    WIDTH: 3,
  },
  ECONOMY: {
    BASE_STARTING_MONEY: 200,       // Base amount for reference map size
    REFERENCE_MAP_AREA_KM2: 5.0,    // Reference area in km² that receives base amount
    MIN_STARTING_MONEY: 200,        // Floor for small maps (~1-2 towers)
    MAX_STARTING_MONEY: 400,        // Cap for large maps (~3-4 towers)
    STARTING_LIVES: 10,
    QA_STARTING_MONEY: 50000,       // Extra cash for QA testing with "l" key
  },
  ELEVATION: {
    RANGE_BONUS_PER_METER: 0.003,   // (X * 100)% range per meter of height advantage
    MIN_RANGE_FACTOR: -0.3,         // Maximum penalty: -30% range
    MAX_RANGE_FACTOR: 0.5,          // Maximum bonus: +50% range
  },
};

/**
 * Calculate effective range based on elevation difference.
 * Shared between tower targeting and range polygon rendering.
 * @param baseRange - The tower's base range in meters
 * @param towerGroundElev - Ground elevation at tower position
 * @param targetGroundElev - Ground elevation at target position
 * @returns Effective range in meters, adjusted for elevation
 */
export function calculateEffectiveRange(
  baseRange: number,
  towerGroundElev: number,
  targetGroundElev: number
): number {
  const elevDiff = towerGroundElev - targetGroundElev;
  const { RANGE_BONUS_PER_METER, MIN_RANGE_FACTOR, MAX_RANGE_FACTOR } = GAME_CONFIG.ELEVATION;
  const factor = Math.max(MIN_RANGE_FACTOR, Math.min(MAX_RANGE_FACTOR, elevDiff * RANGE_BONUS_PER_METER));
  return baseRange * (1 + factor);
}


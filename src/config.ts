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
    COLOR: 0x333333,
    OPACITY: 0.2,
    WIDTH: 3,
  },
  ECONOMY: {
    STARTING_MONEY: 200,
    STARTING_LIVES: 10,
    QA_STARTING_MONEY: 50000, // Extra cash for QA testing with "l" key
  },
};

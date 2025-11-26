import { LatLngExpression } from 'leaflet';

export const GAME_CONFIG = {
  MAP: {
    DEFAULT_CENTER: [37.7749, -122.4194] as LatLngExpression,
    DEFAULT_ZOOM: 15,
    NO_BUILD_RADIUS_METERS: 100,
    MIN_WIDTH_KM: 0.2,
    MAX_WIDTH_KM: 8,
    MIN_HEIGHT_KM: 0.2,
    MAX_HEIGHT_KM: 8,
  },
  SELECTION: {
    BOUNDS_COLOR: '#3388ff',
    BOUNDS_OPACITY: 0.1,
    NO_BUILD_COLOR: '#ff0000',
    NO_BUILD_OPACITY: 0.1,
  },
  ROADS: {
    COLOR: 0xcccccc,
    OPACITY: 0.2,
    WIDTH: 3,
  },
  ECONOMY: {
    STARTING_MONEY: 100,
    STARTING_LIVES: 2,
  },
};

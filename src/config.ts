import { LatLngExpression } from 'leaflet';

export const GAME_CONFIG = {
  ENEMY: {
    BORDER_COLOR: 0xffffff,
    BORDER_WIDTH: 2,
  },
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
  ECONOMY: {
    STARTING_MONEY: 200,
    STARTING_LIVES: 10,
  },
};

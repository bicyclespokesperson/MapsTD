import { LatLngExpression } from 'leaflet';

export const GAME_CONFIG = {
  ENEMY: {
    SPEED: 60, // meters per second
    HEALTH: 100,
    RADIUS: 6,
    COLOR: 0xff0000,
    BORDER_COLOR: 0xffffff,
    BORDER_WIDTH: 2,
  },
  MAP: {
    DEFAULT_CENTER: [37.7749, -122.4194] as LatLngExpression,
    DEFAULT_ZOOM: 15,
    NO_BUILD_RADIUS_METERS: 100,
    MIN_WIDTH_KM: 0.8,
    MAX_WIDTH_KM: 8,
    MIN_HEIGHT_KM: 0.8,
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
    MONEY_PER_KILL: 15,
  },
  TOWER: {
    COST: 75,
    RANGE: 150,
    DAMAGE: 25,
    FIRE_RATE: 1000, // ms
    COLOR: 0x0000ff,
  }
};

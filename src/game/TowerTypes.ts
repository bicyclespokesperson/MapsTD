export type TowerType = 'GUNNER' | 'SNIPER' | 'MINIGUN' | 'CANNON' | 'HELICOPTER' | 'BOMB';

export type TargetingMode = 'FIRST' | 'LAST' | 'CLOSEST' | 'STRONGEST';

export interface TowerStats {
  damage: number;
  range: number;
  fireRateMs: number;
  projectileSpeed: number;
  splashRadius?: number;
  splashDamage?: number;
}

export interface TowerConfig {
  name: string;
  baseCost: number;
  baseStats: TowerStats;
  color: number;
  upgrades: UpgradeTier[];
}

export interface HelicopterConfig extends TowerConfig {
  domainRadius: number; // The large area it patrols/chases within
  moveSpeed: number;    // Maximum flight speed
  turnSpeed: number;    // Rotation speed in degrees per second
  acceleration: number; // Acceleration in pixels/sec^2
}

export interface BombConfig extends TowerConfig {
  fuseTime: number; // ms before explosion
}

export interface UpgradeTier {
  level: number;
  cost: number;
  stats: TowerStats;
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  GUNNER: {
    name: 'Gunner',
    baseCost: 75,
    color: 0x0066ff,
    baseStats: {
      damage: 25,
      range: 420,
      fireRateMs: 1000,
      projectileSpeed: 400,
    },
    upgrades: [
      {
        level: 2,
        cost: 60,
        stats: { damage: 40, range: 490, fireRateMs: 850, projectileSpeed: 450 },
      },
      {
        level: 3,
        cost: 100,
        stats: { damage: 65, range: 560, fireRateMs: 700, projectileSpeed: 500 },
      },
      {
        level: 4,
        cost: 150,
        stats: { damage: 100, range: 630, fireRateMs: 500, projectileSpeed: 550 },
      },
    ],
  },
  SNIPER: {
    name: 'Sniper',
    baseCost: 120,
    color: 0x9900ff,
    baseStats: {
      damage: 75,
      range: 700,
      fireRateMs: 2500,
      projectileSpeed: Infinity,
    },
    upgrades: [
      {
        level: 2,
        cost: 80,
        stats: { damage: 120, range: 780, fireRateMs: 2200, projectileSpeed: Infinity },
      },
      {
        level: 3,
        cost: 130,
        stats: { damage: 180, range: 870, fireRateMs: 1900, projectileSpeed: Infinity },
      },
      {
        level: 4,
        cost: 200,
        stats: { damage: 280, range: 980, fireRateMs: 1500, projectileSpeed: Infinity },
      },
    ],
  },
  MINIGUN: {
    name: 'Minigun',
    baseCost: 100,
    color: 0xff6600,
    baseStats: {
      damage: 10,
      range: 340,
      fireRateMs: 300,
      projectileSpeed: 500,
    },
    upgrades: [
      {
        level: 2,
        cost: 70,
        stats: { damage: 15, range: 380, fireRateMs: 250, projectileSpeed: 550 },
      },
      {
        level: 3,
        cost: 110,
        stats: { damage: 22, range: 420, fireRateMs: 200, projectileSpeed: 600 },
      },
      {
        level: 4,
        cost: 170,
        stats: { damage: 35, range: 480, fireRateMs: 150, projectileSpeed: 650 },
      },
    ],
  },
  CANNON: {
    name: 'Cannon',
    baseCost: 150,
    color: 0xff0000,
    baseStats: {
      damage: 40,
      range: 390,
      fireRateMs: 2000,
      projectileSpeed: 200,
      splashRadius: 30,
      splashDamage: 20,
    },
    upgrades: [
      {
        level: 2,
        cost: 100,
        stats: {
          damage: 60,
          range: 450,
          fireRateMs: 1800,
          projectileSpeed: 220,
          splashRadius: 35,
          splashDamage: 30,
        },
      },
      {
        level: 3,
        cost: 160,
        stats: {
          damage: 90,
          range: 500,
          fireRateMs: 1600,
          projectileSpeed: 240,
          splashRadius: 40,
          splashDamage: 45,
        },
      },
      {
        level: 4,
        cost: 250,
        stats: {
          damage: 140,
          range: 590,
          fireRateMs: 1300,
          projectileSpeed: 260,
          splashRadius: 50,
          splashDamage: 70,
        },
      },
    ],
  },
  HELICOPTER: {
    name: 'Helicopter',
    baseCost: 200,
    color: 0x2d5a27,
    domainRadius: 450,
    moveSpeed: 120,
    turnSpeed: 120,
    acceleration: 150,
    baseStats: {
      damage: 50,
      range: 260,
      fireRateMs: 2000,
      projectileSpeed: 180,
      splashRadius: 40,
      splashDamage: 25,
    },
    upgrades: [
      {
        level: 2,
        cost: 150,
        stats: {
          damage: 70,
          range: 290,
          fireRateMs: 1800,
          projectileSpeed: 200,
          splashRadius: 50,
          splashDamage: 35,
        },
      },
      {
        level: 3,
        cost: 220,
        stats: {
          damage: 100,
          range: 320,
          fireRateMs: 1600,
          projectileSpeed: 220,
          splashRadius: 60,
          splashDamage: 50,
        },
      },
      {
        level: 4,
        cost: 300,
        stats: {
          damage: 140,
          range: 365,
          fireRateMs: 1400,
          projectileSpeed: 240,
          splashRadius: 75,
          splashDamage: 70,
        },
      },
    ],
  } as HelicopterConfig,
  BOMB: {
    name: 'Bomb',
    baseCost: 400,
    color: 0xff0000,
    baseStats: {
      damage: 5000,
      range: 120, // Blast radius in meters
      fireRateMs: 0,
      projectileSpeed: 0,
    },
    fuseTime: 3000,
    upgrades: [],
  } as BombConfig,
};

export const TARGETING_LABELS: Record<TargetingMode, string> = {
  FIRST: 'First (Closest to Goal)',
  LAST: 'Last (Furthest from Goal)',
  CLOSEST: 'Closest to Tower',
  STRONGEST: 'Strongest (Most Current HP)',
};

export const ECONOMY = {
  SELL_REFUND_PERCENT: 0.7,
};


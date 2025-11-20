export type TowerType = 'GUNNER' | 'SNIPER' | 'MINIGUN' | 'CANNON';

export type TargetingMode = 'FIRST' | 'LAST' | 'CLOSEST' | 'STRONGEST';

export interface TowerStats {
  damage: number;
  range: number;
  fireRate: number;
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
      range: 150,
      fireRate: 1000,
      projectileSpeed: 400,
    },
    upgrades: [
      {
        level: 2,
        cost: 60,
        stats: { damage: 40, range: 175, fireRate: 850, projectileSpeed: 450 },
      },
      {
        level: 3,
        cost: 100,
        stats: { damage: 65, range: 200, fireRate: 700, projectileSpeed: 500 },
      },
      {
        level: 4,
        cost: 150,
        stats: { damage: 100, range: 225, fireRate: 500, projectileSpeed: 550 },
      },
    ],
  },
  SNIPER: {
    name: 'Sniper',
    baseCost: 120,
    color: 0x9900ff,
    baseStats: {
      damage: 75,
      range: 250,
      fireRate: 2500,
      projectileSpeed: Infinity,
    },
    upgrades: [
      {
        level: 2,
        cost: 80,
        stats: { damage: 120, range: 280, fireRate: 2200, projectileSpeed: Infinity },
      },
      {
        level: 3,
        cost: 130,
        stats: { damage: 180, range: 310, fireRate: 1900, projectileSpeed: Infinity },
      },
      {
        level: 4,
        cost: 200,
        stats: { damage: 280, range: 350, fireRate: 1500, projectileSpeed: Infinity },
      },
    ],
  },
  MINIGUN: {
    name: 'Minigun',
    baseCost: 100,
    color: 0xff6600,
    baseStats: {
      damage: 10,
      range: 120,
      fireRate: 300,
      projectileSpeed: 500,
    },
    upgrades: [
      {
        level: 2,
        cost: 70,
        stats: { damage: 15, range: 135, fireRate: 250, projectileSpeed: 550 },
      },
      {
        level: 3,
        cost: 110,
        stats: { damage: 22, range: 150, fireRate: 200, projectileSpeed: 600 },
      },
      {
        level: 4,
        cost: 170,
        stats: { damage: 35, range: 170, fireRate: 150, projectileSpeed: 650 },
      },
    ],
  },
  CANNON: {
    name: 'Cannon',
    baseCost: 150,
    color: 0xff0000,
    baseStats: {
      damage: 40,
      range: 140,
      fireRate: 2000,
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
          range: 160,
          fireRate: 1800,
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
          range: 180,
          fireRate: 1600,
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
          range: 210,
          fireRate: 1300,
          projectileSpeed: 260,
          splashRadius: 50,
          splashDamage: 70,
        },
      },
    ],
  },
};

export const ECONOMY = {
  STARTING_MONEY: 100,
  KILL_REWARD: 15,
  WAVE_BONUS_BASE: 50,
  WAVE_BONUS_MULTIPLIER: 25,
  SELL_REFUND_PERCENT: 0.75,
};

export const TARGETING_LABELS: Record<TargetingMode, string> = {
  FIRST: 'First (Closest to Goal)',
  LAST: 'Last (Furthest from Goal)',
  CLOSEST: 'Closest to Tower',
  STRONGEST: 'Strongest (Most HP)',
};

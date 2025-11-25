export type EnemyType = 'SCOUT' | 'NORMAL' | 'TANK' | 'BOSS';

export interface EnemyConfig {
  name: string;
  health: number;
  speed: number;
  reward: number;
  color: number;
  size: number;
}

export const ENEMY_STYLE = {
  BORDER_COLOR: 0xffffff,
  BORDER_WIDTH: 2,
};

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  SCOUT: {
    name: 'Scout',
    health: 50,
    speed: 160,
    reward: 10,
    color: 0xffff00,
    size: 4,
  },
  NORMAL: {
    name: 'Normal',
    health: 100,
    speed: 96,
    reward: 15,
    color: 0xff0000,
    size: 6,
  },
  TANK: {
    name: 'Tank',
    health: 300,
    speed: 64,
    reward: 30,
    color: 0x8b4513,
    size: 10,
  },
  BOSS: {
    name: 'Boss',
    health: 1500,
    speed: 50,
    reward: 100,
    color: 0x800080,
    size: 16,
  },
};

export type EnemyType = 'SCOUT' | 'NORMAL' | 'TANK';

export interface EnemyConfig {
  name: string;
  health: number;
  speed: number;
  reward: number;
  color: number;
  size: number;
}

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
};

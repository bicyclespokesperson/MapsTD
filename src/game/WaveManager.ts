import Phaser from 'phaser';
import { BoundaryEntry } from '../roadNetwork';
import { Enemy } from './Enemy';
import { CoordinateConverter } from '../coordinateConverter';
import { EnemyType } from './EnemyTypes';
import { GAME_CONFIG } from '../config';

export class WaveManager {
  private scene: Phaser.Scene;
  private converter: CoordinateConverter;
  private entries: BoundaryEntry[];
  
  private currentWave: number = 0;
  private enemiesRemainingToSpawn: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000; // ms
  
  private activeEnemies: Enemy[] = [];
  private lives: number = GAME_CONFIG.ECONOMY.STARTING_LIVES;
  private money: number = 100;
  
  private isWaveActive: boolean = false;

  constructor(scene: Phaser.Scene, converter: CoordinateConverter) {
    this.scene = scene;
    this.converter = converter;
    this.entries = [];
  }

  setEntries(entries: BoundaryEntry[]) {
    this.entries = entries;
  }

  startNextWave() {
    if (this.entries.length === 0) {
      console.warn('Cannot start wave: no entry points found');
      return;
    }

    this.currentWave++;
    this.enemiesRemainingToSpawn = 5 + (this.currentWave * 5); // Simple progression
    this.spawnInterval = Math.max(500, 2000 - (this.currentWave * 100));
    this.isWaveActive = true;
    console.log(`Starting Wave ${this.currentWave}: ${this.enemiesRemainingToSpawn} enemies`);
  }

  update(time: number, delta: number) {
    // Update active enemies
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.update(time, delta);
      if (!enemy.active) { // Check if destroyed
         this.activeEnemies.splice(i, 1);
      }
    }

    if (!this.isWaveActive) return;

    if (this.enemiesRemainingToSpawn > 0) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnEnemy();
        this.spawnTimer = 0;
      }
    } else if (this.activeEnemies.length === 0) {
      this.isWaveActive = false;
      console.log('Wave Complete!');
    }
  }

  private spawnEnemy() {
    if (this.entries.length === 0) return;

    const entry = this.entries[Math.floor(Math.random() * this.entries.length)];
    const enemyType = this.getEnemyTypeForWave();

    const enemy = new Enemy(
      this.scene,
      enemyType,
      entry.roadPath,
      this.converter,
      () => this.onEnemyReachGoal(),
      () => this.onEnemyKilled(enemy)
    );

    this.activeEnemies.push(enemy);
    this.enemiesRemainingToSpawn--;
  }

  private getEnemyTypeForWave(): EnemyType {
    const rand = Math.random();
    const wave = this.currentWave;

    if (wave <= 2) {
      return 'NORMAL';
    } else if (wave <= 5) {
      if (rand < 0.3) return 'SCOUT';
      if (rand < 0.9) return 'NORMAL';
      return 'TANK';
    } else if (wave <= 10) {
      if (rand < 0.2) return 'SCOUT';
      if (rand < 0.7) return 'NORMAL';
      return 'TANK';
    } else {
      if (rand < 0.3) return 'SCOUT';
      if (rand < 0.6) return 'NORMAL';
      return 'TANK';
    }
  }

  private onEnemyReachGoal() {
    this.lives--;
    console.log(`Enemy reached goal! Lives: ${this.lives}`);

    this.updateStats();

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private onEnemyKilled(enemy: Enemy) {
    const reward = enemy.getReward();
    this.money += reward;
    console.log(`${enemy.type} killed! Reward: $${reward}, Total money: ${this.money}`);
    this.updateStats();
  }

  private updateStats() {
    const event = new CustomEvent('game-stats-update', {
      detail: { lives: this.lives, money: this.money, wave: this.currentWave }
    });
    window.dispatchEvent(event);
  }

  private gameOver() {
    console.log('Game Over');
    this.isWaveActive = false;
    alert('Game Over!');
    this.lives = GAME_CONFIG.ECONOMY.STARTING_LIVES;
    this.currentWave = 0;
    this.activeEnemies.forEach(e => e.destroy());
    this.activeEnemies = [];

    this.updateStats();
  }
  
  getStats() {
    return {
      lives: this.lives,
      money: this.money,
      wave: this.currentWave
    };
  }

  getActiveEnemies(): Enemy[] {
    return this.activeEnemies;
  }

  spendMoney(amount: number): boolean {
    if (this.money >= amount) {
      this.money -= amount;
      this.updateStats();
      return true;
    }
    return false;
  }

  addMoney(amount: number): void {
    this.money += amount;
    this.updateStats();
  }
}

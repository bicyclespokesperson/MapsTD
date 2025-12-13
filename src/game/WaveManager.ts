import Phaser from 'phaser';
import * as L from 'leaflet';
import { BoundaryEntry, RoadNetwork } from '../roadNetwork';
import { Enemy } from './Enemy';
import { CoordinateConverter } from '../coordinateConverter';
import { EnemyType, ENEMY_CONFIGS } from './EnemyTypes';
import { GAME_CONFIG } from '../config';

export class WaveManager {
  private scene: Phaser.Scene;
  private converter: CoordinateConverter;
  private entries: BoundaryEntry[];

  private currentWave: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000; // ms

  private activeEnemies: Enemy[] = [];
  private spawnQueue: EnemyType[] = [];
  private nextWaveQueue: EnemyType[] = [];
  private lives: number = GAME_CONFIG.ECONOMY.STARTING_LIVES;
  private money: number = GAME_CONFIG.ECONOMY.STARTING_MONEY;

  private isWaveActive: boolean = false;
  private totalKills: number = 0;
  private totalMoneyEarned: number = 0;

  private gameSpeed: number = 1;
  private _isPaused: boolean = false;

  pause() {
    this._isPaused = true;
    this.dispatchSpeedUpdate();
  }

  resume() {
    this._isPaused = false;
    this.dispatchSpeedUpdate();
  }

  togglePause(): boolean {
    this._isPaused = !this._isPaused;
    this.dispatchSpeedUpdate();
    return this._isPaused;
  }

  setSpeed(speed: number) {
    this.gameSpeed = speed;
    this.dispatchSpeedUpdate();
  }

  getSpeed(): number {
    return this.gameSpeed;
  }

  isPaused(): boolean {
    return this._isPaused;
  }

  isWaveInProgress(): boolean {
    return this.isWaveActive;
  }

  private dispatchSpeedUpdate() {
    const event = new CustomEvent('game-speed-update', {
      detail: { speed: this.gameSpeed, paused: this._isPaused }
    });
    window.dispatchEvent(event);
  }

  private dispatchWaveComplete() {
    const event = new CustomEvent('wave-complete', {
      detail: { wave: this.currentWave }
    });
    window.dispatchEvent(event);
  }

  constructor(scene: Phaser.Scene, converter: CoordinateConverter) {
    this.scene = scene;
    this.converter = converter;
    this.entries = [];
  }

  setEntries(entries: BoundaryEntry[]) {
    this.entries = entries;
    this.generateNextWaveQueue();
  }

  private generateWaveQueue(wave: number): EnemyType[] {
    const totalEnemies = 5 + (wave * 5);
    const queue: EnemyType[] = [];

    for (let i = 0; i < totalEnemies; i++) {
      queue.push(this.getEnemyTypeForWave(wave));
    }

    // Add boss on waves divisible by 5
    if (wave % 5 === 0 && wave > 0) {
      queue.unshift('BOSS');
    }

    return queue;
  }

  private generateNextWaveQueue() {
    this.nextWaveQueue = this.generateWaveQueue(this.currentWave + 1);
  }

  startNextWave() {
    if (this.entries.length === 0) {
      console.warn('Cannot start wave: no entry points found');
      return;
    }

    this.currentWave++;
    this.spawnQueue = [...this.nextWaveQueue];
    this.spawnInterval = Math.max(500, 2000 - (this.currentWave * 100));
    this.isWaveActive = true;
    console.log(`Starting Wave ${this.currentWave}: ${this.spawnQueue.length} enemies`);

    // Pre-generate next wave for preview
    this.generateNextWaveQueue();

    this.updateStats();
  }

  update(time: number, delta: number) {
    if (this._isPaused) return;

    const adjustedDelta = delta * this.gameSpeed;

    // Update active enemies
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.update(time, adjustedDelta);
      if (!enemy.active) { // Check if destroyed
         this.activeEnemies.splice(i, 1);
      }
    }

    if (!this.isWaveActive) return;

    if (this.spawnQueue.length > 0) {
      this.spawnTimer += adjustedDelta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnEnemy();
        this.spawnTimer = 0;
      }
    } else if (this.activeEnemies.length === 0) {
      this.isWaveActive = false;
      console.log('Wave Complete!');
      this.dispatchWaveComplete();
    }
  }

  private spawnEnemy() {
    if (this.entries.length === 0 || this.spawnQueue.length === 0) return;

    const entry = this.entries[Math.floor(Math.random() * this.entries.length)];
    const enemyType = this.spawnQueue.shift()!;

    const enemy = new Enemy(
      this.scene,
      enemyType,
      entry.roadPath,
      this.converter,
      () => this.onEnemyReachGoal(),
      () => this.onEnemyKilled(enemy)
    );

    this.activeEnemies.push(enemy);
  }

  private getEnemyTypeForWave(wave: number): EnemyType {
    const rand = Math.random();

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
    this.totalKills++;
    this.totalMoneyEarned += reward;
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

    const gameOverEvent = new CustomEvent('game-over', {
      detail: {
        wave: this.currentWave,
        kills: this.totalKills,
        moneyEarned: this.totalMoneyEarned,
      }
    });
    window.dispatchEvent(gameOverEvent);

    this.lives = GAME_CONFIG.ECONOMY.STARTING_LIVES;
    this.currentWave = 0;
    this.totalKills = 0;
    this.totalMoneyEarned = 0;
    this.activeEnemies.forEach(e => e.destroy());
    this.activeEnemies = [];
    this.spawnQueue = [];
    this.generateNextWaveQueue();

    this.updateStats();
  }

  reset() {
    this.lives = GAME_CONFIG.ECONOMY.STARTING_LIVES;
    this.money = GAME_CONFIG.ECONOMY.STARTING_MONEY;
    this.currentWave = 0;
    this.totalKills = 0;
    this.totalMoneyEarned = 0;
    this.spawnQueue = [];
    this.nextWaveQueue = [];
    this.spawnTimer = 0;
    this.isWaveActive = false;
    this.gameSpeed = 1;
    this._isPaused = false;
    this.entries = [];

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

  getNextWavePreview(): { type: EnemyType; count: number; color: string }[] {
    const toHexColor = (color: number) => '#' + color.toString(16).padStart(6, '0');

    // Count enemies in the pre-generated queue
    const counts = new Map<EnemyType, number>();
    for (const type of this.nextWaveQueue) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    const result: { type: EnemyType; count: number; color: string }[] = [];

    // Add in order: BOSS first (if any), then SCOUT, NORMAL, TANK
    const order: EnemyType[] = ['BOSS', 'SCOUT', 'NORMAL', 'TANK'];
    for (const type of order) {
      const count = counts.get(type);
      if (count && count > 0) {
        result.push({
          type,
          count,
          color: toHexColor(ENEMY_CONFIGS[type].color),
        });
      }
    }

    return result;
  }

  recalculatePaths(roadNetwork: RoadNetwork, baseLocation: L.LatLng) {
    if (!roadNetwork) return;

    // Use a copy of the array because we might modify it (destroying enemies)
    const enemies = [...this.activeEnemies];

    for (const enemy of enemies) {
        if (enemy.isDead()) continue;

        const currentPos = enemy.getPosition();
        const newPath = roadNetwork.findPath(currentPos, baseLocation);

        if (newPath) {
            enemy.setPath(newPath);
        } else {
             // Trapped - destroy immediately
            console.log('Enemy trapped by road destruction!');
            enemy.takeDamage(999999);
        }
    }
  }
}

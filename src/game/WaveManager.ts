import Phaser from 'phaser';
import { BoundaryEntry } from '../roadNetwork';
import { Enemy } from './Enemy';
import { CoordinateConverter } from '../coordinateConverter';

export class WaveManager {
  private scene: Phaser.Scene;
  private converter: CoordinateConverter;
  private entries: BoundaryEntry[];
  
  private currentWave: number = 0;
  private enemiesRemainingToSpawn: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000; // ms
  
  private activeEnemies: Enemy[] = [];
  private lives: number = 10;
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
    
    const enemy = new Enemy(
      this.scene,
      entry.roadPath,
      this.converter,
      () => this.onEnemyReachGoal()
    );
    
    this.activeEnemies.push(enemy);
    this.enemiesRemainingToSpawn--;
  }

  private onEnemyReachGoal() {
    this.lives--;
    console.log(`Enemy reached goal! Lives: ${this.lives}`);
    
    // Dispatch event or update UI
    const event = new CustomEvent('game-stats-update', { 
        detail: { lives: this.lives, money: this.money, wave: this.currentWave } 
    });
    window.dispatchEvent(event);

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  private gameOver() {
    console.log('Game Over');
    this.isWaveActive = false;
    alert('Game Over!');
    // Reset game?
    this.lives = 10;
    this.currentWave = 0;
    this.activeEnemies.forEach(e => e.destroy());
    this.activeEnemies = [];
    
    const event = new CustomEvent('game-stats-update', { 
        detail: { lives: this.lives, money: this.money, wave: this.currentWave } 
    });
    window.dispatchEvent(event);
  }
  
  getStats() {
      return {
          lives: this.lives,
          money: this.money,
          wave: this.currentWave
      };
  }
}

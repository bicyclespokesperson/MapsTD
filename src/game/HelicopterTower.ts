import Phaser from 'phaser';
import * as L from 'leaflet';
import {
  TowerType,
  TargetingMode,
  TowerStats,
  HelicopterConfig,
  TOWER_CONFIGS,
  ECONOMY,
} from './TowerTypes';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { CoordinateConverter } from '../coordinateConverter';

export interface TowerStatistics {
  kills: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  createdAt: number;
}

export class HelicopterTower extends Phaser.GameObjects.Container {
  public readonly type: TowerType = 'HELICOPTER';
  public readonly config: HelicopterConfig;
  public readonly geoPosition: { lat: number; lng: number }; // Center of patrol

  public level: number = 1;
  public stats: TowerStats;
  public targetingMode: TargetingMode = 'FIRST';
  public statistics: TowerStatistics;

  private converter: CoordinateConverter;
  private currentTarget: Enemy | null = null;
  private timeSinceLastFire: number = 0;
  
  // Patrol properties
  private patrolAngle: number = 0;
  private patrolRadius: number;
  private patrolSpeed: number;
  private currentLatLng: L.LatLng;
  
  // Visual components
  private rangeCircle!: Phaser.GameObjects.Arc;
  private helicopterBody!: Phaser.GameObjects.Polygon;
  private mainRotor!: Phaser.GameObjects.Graphics;
  private tailRotor!: Phaser.GameObjects.Graphics;
  private shadow!: Phaser.GameObjects.Ellipse;
  private levelText!: Phaser.GameObjects.Text;
  
  // Rotor animation
  private rotorAngle: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    geoPosition: { lat: number; lng: number },
    converter: CoordinateConverter
  ) {
    super(scene, x, y);

    this.config = TOWER_CONFIGS.HELICOPTER as HelicopterConfig;
    this.geoPosition = geoPosition;
    this.converter = converter;
    this.stats = { ...this.config.baseStats };
    this.patrolRadius = this.config.patrolRadius;
    this.patrolSpeed = this.config.patrolSpeed;
    this.currentLatLng = L.latLng(geoPosition.lat, geoPosition.lng);

    this.statistics = {
      kills: 0,
      damageDealt: 0,
      shotsFired: 0,
      shotsHit: 0,
      createdAt: Date.now(),
    };

    this.createVisuals();
    scene.add.existing(this);
  }

  private createVisuals(): void {
    // Shadow on the ground (offset below helicopter)
    this.shadow = this.scene.add.ellipse(5, 15, 20, 8, 0x000000, 0.3);
    this.add(this.shadow);

    // Range circle (moves with helicopter)
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.3);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    // Helicopter body - military style shape
    const bodyPoints = [
      { x: 0, y: -12 },   // Nose
      { x: 8, y: -4 },    // Right front
      { x: 8, y: 8 },     // Right back
      { x: 4, y: 12 },    // Right tail connector
      { x: -4, y: 12 },   // Left tail connector
      { x: -8, y: 8 },    // Left back
      { x: -8, y: -4 },   // Left front
    ];
    this.helicopterBody = this.scene.add.polygon(0, 0, bodyPoints, this.config.color);
    this.helicopterBody.setStrokeStyle(2, 0xffffff);
    this.add(this.helicopterBody);

    // Main rotor (spinning blades)
    this.mainRotor = this.scene.add.graphics();
    this.drawRotor();
    this.add(this.mainRotor);

    // Tail rotor
    this.tailRotor = this.scene.add.graphics();
    this.tailRotor.setPosition(0, 14);
    this.drawTailRotor();
    this.add(this.tailRotor);

    // Level indicator
    this.levelText = this.scene.add.text(0, 0, this.level.toString(), {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.add(this.levelText);
  }

  private drawRotor(): void {
    this.mainRotor.clear();
    this.mainRotor.lineStyle(3, 0xcccccc);
    
    // Draw 3 rotor blades
    for (let i = 0; i < 3; i++) {
      const angle = this.rotorAngle + (i * Math.PI * 2 / 3);
      const x1 = Math.cos(angle) * 15;
      const y1 = Math.sin(angle) * 15;
      const x2 = Math.cos(angle + Math.PI) * 15;
      const y2 = Math.sin(angle + Math.PI) * 15;
      this.mainRotor.beginPath();
      this.mainRotor.moveTo(x1, y1);
      this.mainRotor.lineTo(x2, y2);
      this.mainRotor.strokePath();
    }
    
    // Rotor hub
    this.mainRotor.fillStyle(0x666666);
    this.mainRotor.fillCircle(0, 0, 3);
  }

  private drawTailRotor(): void {
    this.tailRotor.clear();
    this.tailRotor.lineStyle(2, 0xcccccc);
    
    // Draw 2 small blades
    for (let i = 0; i < 2; i++) {
      const angle = this.rotorAngle * 2 + (i * Math.PI);
      const x1 = Math.cos(angle) * 5;
      const y1 = Math.sin(angle) * 5;
      const x2 = Math.cos(angle + Math.PI) * 5;
      const y2 = Math.sin(angle + Math.PI) * 5;
      this.tailRotor.beginPath();
      this.tailRotor.moveTo(x1, y1);
      this.tailRotor.lineTo(x2, y2);
      this.tailRotor.strokePath();
    }
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);
    this.helicopterBody.setStrokeStyle(2, selected ? 0xffff00 : 0xffffff);
  }

  public update(delta: number, enemies: Enemy[]): void {
    // Update patrol position
    this.updatePatrolPosition(delta);
    
    // Animate rotors
    this.animateRotors(delta);
    
    // Tower combat logic
    this.timeSinceLastFire += delta;
    this.updateRangeCircle();

    if (!this.currentTarget || this.currentTarget.isDead() || !this.isInRange(this.currentTarget)) {
      this.currentTarget = this.findTarget(enemies);
    }

    if (this.currentTarget) {
      this.aimAt(this.currentTarget);

      if (this.timeSinceLastFire >= this.stats.fireRateMs) {
        this.fire(this.currentTarget);
        this.timeSinceLastFire = 0;
      }
    }
  }

  private updatePatrolPosition(delta: number): void {
    // Calculate angular velocity (radians per second)
    const angularVelocity = this.patrolSpeed / this.patrolRadius;
    this.patrolAngle += angularVelocity * (delta / 1000);
    
    // Keep angle in [0, 2π]
    if (this.patrolAngle > Math.PI * 2) {
      this.patrolAngle -= Math.PI * 2;
    }
    
    // Calculate offset in meters, then convert to lat/lng
    const metersPerDegreeLat = 111111;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(this.geoPosition.lat * Math.PI / 180);
    
    const offsetLat = Math.cos(this.patrolAngle) * this.patrolRadius / metersPerDegreeLat;
    const offsetLng = Math.sin(this.patrolAngle) * this.patrolRadius / metersPerDegreeLng;
    
    this.currentLatLng = L.latLng(
      this.geoPosition.lat + offsetLat,
      this.geoPosition.lng + offsetLng
    );
    
    // Update screen position
    const screenPos = this.converter.latLngToPixel(this.currentLatLng);
    this.setPosition(screenPos.x, screenPos.y);
  }

  private animateRotors(delta: number): void {
    // Fast rotor spin (complete rotation in ~200ms)
    this.rotorAngle += (delta / 200) * Math.PI * 2;
    if (this.rotorAngle > Math.PI * 2) {
      this.rotorAngle -= Math.PI * 2;
    }
    
    this.drawRotor();
    this.drawTailRotor();
  }

  private updateRangeCircle(): void {
    this.rangeCircle.setRadius(this.getRangeInPixels());
  }

  private findTarget(enemies: Enemy[]): Enemy | null {
    const enemiesInRange = enemies.filter(
      (enemy) => !enemy.isDead() && this.isInRange(enemy)
    );

    if (enemiesInRange.length === 0) return null;

    switch (this.targetingMode) {
      case 'FIRST':
        return enemiesInRange.reduce((closest, enemy) =>
          enemy.getDistanceToGoal() < closest.getDistanceToGoal() ? enemy : closest
        );
      case 'LAST':
        return enemiesInRange.reduce((furthest, enemy) =>
          enemy.getDistanceToGoal() > furthest.getDistanceToGoal() ? enemy : furthest
        );
      case 'CLOSEST':
        return enemiesInRange.reduce((closest, enemy) => {
          const distToClosest = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            closest.x,
            closest.y
          );
          const distToEnemy = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
          return distToEnemy < distToClosest ? enemy : closest;
        });
      case 'STRONGEST':
        return enemiesInRange.reduce((strongest, enemy) =>
          enemy.getHealth() > strongest.getHealth() ? enemy : strongest
        );
      default:
        return enemiesInRange[0];
    }
  }

  private getRangeInPixels(): number {
    return this.stats.range * this.converter.pixelsPerMeter();
  }

  private isInRange(enemy: Enemy): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    return distance <= this.getRangeInPixels();
  }

  private aimAt(enemy: Enemy): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
    // Rotate the helicopter body to face the target
    this.helicopterBody.setRotation(angle + Math.PI / 2);
  }

  private fire(target: Enemy): void {
    this.statistics.shotsFired++;

    const projectile = new Projectile(
      this.scene,
      this,
      target,
      this.stats.damage,
      this.stats.projectileSpeed,
      this.config.color,
      this.stats.splashRadius,
      this.stats.splashDamage
    );

    this.scene.events.emit('projectile-created', projectile);
  }

  public upgrade(): boolean {
    const nextLevel = this.level + 1;
    const upgradeTier = this.config.upgrades.find((u) => u.level === nextLevel);

    if (!upgradeTier) return false;

    this.level = nextLevel;
    this.stats = { ...upgradeTier.stats };
    this.levelText.setText(this.level.toString());

    return true;
  }

  public getUpgradeCost(): number | null {
    const nextLevel = this.level + 1;
    const upgradeTier = this.config.upgrades.find((u) => u.level === nextLevel);
    return upgradeTier ? upgradeTier.cost : null;
  }

  public getTotalInvested(): number {
    let total = this.config.baseCost;
    for (let i = 2; i <= this.level; i++) {
      const tier = this.config.upgrades.find((u) => u.level === i);
      if (tier) total += tier.cost;
    }
    return total;
  }

  public getSellValue(): number {
    return Math.floor(this.getTotalInvested() * ECONOMY.SELL_REFUND_PERCENT);
  }

  public setTargetingMode(mode: TargetingMode): void {
    this.targetingMode = mode;
  }

  public getEfficiency(): number {
    const invested = this.getTotalInvested();
    return invested > 0 ? this.statistics.damageDealt / invested : 0;
  }

  public getUptime(): number {
    return Date.now() - this.statistics.createdAt;
  }

  public recordHit(damage: number): void {
    this.statistics.shotsHit++;
    this.statistics.damageDealt += damage;
  }

  public recordKill(): void {
    this.statistics.kills++;
  }

  // Getter for current position (used by projectiles)
  public getCurrentLatLng(): L.LatLng {
    return this.currentLatLng;
  }
}

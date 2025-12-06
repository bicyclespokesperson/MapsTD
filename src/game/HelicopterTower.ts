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
  private gunTurret!: Phaser.GameObjects.Graphics;
  private mainRotor!: Phaser.GameObjects.Graphics;
  private tailRotor!: Phaser.GameObjects.Graphics;
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
    // Range circle (moves with helicopter)
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.3);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    // Tail boom - thinner and more proportional
    const tailBoom = this.scene.add.rectangle(0, 65, 16, 75, this.config.color);
    tailBoom.setStrokeStyle(2, 0x1a3a1a);
    this.add(tailBoom);

    // Tail fin (horizontal stabilizer)
    const tailFin = this.scene.add.rectangle(0, 95, 40, 8, this.config.color);
    tailFin.setStrokeStyle(1, 0x1a3a1a);
    this.add(tailFin);

    // Main body - rounded cabin shape
    const body = this.scene.add.rectangle(0, -5, 90, 60, this.config.color);
    body.setStrokeStyle(3, 0xffffff);
    this.add(body);

    // Use body as the helicopterBody reference for selection highlighting
    this.helicopterBody = body as unknown as Phaser.GameObjects.Polygon;

    // Cockpit/windshield - positioned at the front (top)
    const cockpit = this.scene.add.rectangle(0, -25, 55, 20, 0x87CEEB);
    cockpit.setStrokeStyle(2, 0x4a90a4);
    this.add(cockpit);

    // Rotor mast (connects rotor to body) - centered on body
    const rotorMast = this.scene.add.rectangle(0, -40, 12, 15, 0x555555);
    rotorMast.setStrokeStyle(1, 0x333333);
    this.add(rotorMast);

    // Skids/landing gear - full length with front and back
    const leftSkidVert = this.scene.add.rectangle(-30, 30, 6, 25, 0x333333);
    const rightSkidVert = this.scene.add.rectangle(30, 30, 6, 25, 0x333333);
    // Horizontal runners - now extend to front and back
    const leftSkidHoriz = this.scene.add.rectangle(-30, 45, 70, 6, 0x333333);
    const rightSkidHoriz = this.scene.add.rectangle(30, 45, 70, 6, 0x333333);
    // Front vertical struts
    const leftSkidFront = this.scene.add.rectangle(-30, -10, 6, 20, 0x333333);
    const rightSkidFront = this.scene.add.rectangle(30, -10, 6, 20, 0x333333);
    this.add(leftSkidVert);
    this.add(rightSkidVert);
    this.add(leftSkidHoriz);
    this.add(rightSkidHoriz);
    this.add(leftSkidFront);
    this.add(rightSkidFront);

    // Tail rotor housing - at the end of tail boom
    const tailRotorHub = this.scene.add.circle(0, 105, 15, 0x444444);
    tailRotorHub.setStrokeStyle(2, 0x333333);
    this.add(tailRotorHub);

    // Gun turret - smaller, positioned under the nose
    this.gunTurret = this.scene.add.graphics();
    this.gunTurret.setPosition(0, 5);
    this.drawGunTurret();
    this.add(this.gunTurret);

    // Main rotor (spinning blades) - positioned at center of body
    this.mainRotor = this.scene.add.graphics();
    this.mainRotor.setPosition(0, -5);
    this.drawRotor();
    this.add(this.mainRotor);

    // Tail rotor (at the end of tail boom)
    this.tailRotor = this.scene.add.graphics();
    this.tailRotor.setPosition(0, 105);
    this.drawTailRotor();
    this.add(this.tailRotor);

    // Level indicator - positioned in the body center
    this.levelText = this.scene.add.text(0, -5, this.level.toString(), {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.add(this.levelText);
  }

  private drawRotor(): void {
    this.mainRotor.clear();
    this.mainRotor.lineStyle(10, 0xaaaaaa);
    
    // Draw 2 rotor blades (5x scale - 95px radius)
    for (let i = 0; i < 2; i++) {
      const angle = this.rotorAngle + (i * Math.PI);
      const x1 = Math.cos(angle) * 95;
      const y1 = Math.sin(angle) * 95;
      const x2 = Math.cos(angle + Math.PI) * 95;
      const y2 = Math.sin(angle + Math.PI) * 95;
      this.mainRotor.beginPath();
      this.mainRotor.moveTo(x1, y1);
      this.mainRotor.lineTo(x2, y2);
      this.mainRotor.strokePath();
    }
    
    // Rotor hub (5x scale)
    this.mainRotor.fillStyle(0x444444);
    this.mainRotor.fillCircle(0, 0, 20);
    this.mainRotor.lineStyle(2, 0x666666);
    this.mainRotor.strokeCircle(0, 0, 20);
  }

  private drawTailRotor(): void {
    this.tailRotor.clear();
    this.tailRotor.lineStyle(6, 0xaaaaaa);
    
    // Draw 2 small blades (5x scale - 35px radius)
    for (let i = 0; i < 2; i++) {
      const angle = this.rotorAngle * 2 + (i * Math.PI);
      const x1 = Math.cos(angle) * 35;
      const y1 = Math.sin(angle) * 35;
      const x2 = Math.cos(angle + Math.PI) * 35;
      const y2 = Math.sin(angle + Math.PI) * 35;
      this.tailRotor.beginPath();
      this.tailRotor.moveTo(x1, y1);
      this.tailRotor.lineTo(x2, y2);
      this.tailRotor.strokePath();
    }
    
    // Small hub (5x scale)
    this.tailRotor.fillStyle(0x444444);
    this.tailRotor.fillCircle(0, 0, 10);
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);
    this.helicopterBody.setStrokeStyle(2, selected ? 0xffff00 : 0xffffff);
  }

  public update(delta: number, enemies: Enemy[], isWaveActive: boolean = true): void {
    // Update patrol position only during active waves
    if (isWaveActive) {
      this.updatePatrolPosition(delta);
    } else {
      // Still update screen position when paused (for map panning)
      this.updateScreenPosition();
    }
    
    // Always animate rotors (looks like it's hovering/waiting)
    this.animateRotors(delta);
    
    // Tower combat logic - only fire during active waves
    if (isWaveActive) {
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
  }

  private updateScreenPosition(): void {
    // Just update screen position without moving patrol angle
    const screenPos = this.converter.latLngToPixel(this.currentLatLng);
    this.setPosition(screenPos.x, screenPos.y);
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
    
    // Rotate helicopter to face direction of movement (tangent to circle)
    // Tangent is perpendicular to radius, so add π/2 to patrol angle
    const movementAngle = this.patrolAngle + Math.PI / 2;
    this.setRotation(movementAngle);
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
    // Rotate gun turret to face target, accounting for container rotation
    // Subtract container rotation so turret aims in world space
    this.gunTurret.setRotation(angle + Math.PI / 2 - this.rotation);
  }

  private drawGunTurret(): void {
    this.gunTurret.clear();
    // Gun barrel pointing forward (5x scale)
    this.gunTurret.lineStyle(6, 0x333333);
    this.gunTurret.beginPath();
    this.gunTurret.moveTo(0, 0);
    this.gunTurret.lineTo(0, -40);
    this.gunTurret.strokePath();
    // Gun mount (5x scale)
    this.gunTurret.fillStyle(0x555555);
    this.gunTurret.fillCircle(0, 0, 12);
    this.gunTurret.lineStyle(2, 0x333333);
    this.gunTurret.strokeCircle(0, 0, 12);
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

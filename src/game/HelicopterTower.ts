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
  private visualContainer!: Phaser.GameObjects.Container;
  private helicopterBody!: Phaser.GameObjects.Graphics;
  private mainRotor!: Phaser.GameObjects.Graphics;
  private tailRotor!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  
  // Rotor animation
  private rotorAngle: number = 0;
  
  // Scaling factor for visuals
  private readonly VISUAL_SCALE: number = 3.0; // Start large as requested

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
    // Range circle (moves with helicopter, NOT scaled by visual container)
    // We strive to keep this accurate to game logic
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.3);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    // Container for all helicopter visuals (scaled freely)
    this.visualContainer = this.scene.add.container(0, 0);
    this.visualContainer.setScale(this.VISUAL_SCALE);
    this.add(this.visualContainer);

    // --- Helicopter Graphics ---
    // Using Graphics for cleaner shapes than multiple Rectangles
    this.helicopterBody = this.scene.add.graphics();
    this.visualContainer.add(this.helicopterBody);
    
    // Draw body parts
    this.drawBody();
    
    // Rotor mast
    const rotorMast = this.scene.add.rectangle(0, 0, 6, 8, 0x333333);
    this.visualContainer.add(rotorMast);

    // Main rotor (spinning blades)
    this.mainRotor = this.scene.add.graphics();
    this.visualContainer.add(this.mainRotor);
    this.drawRotor(); // Initial draw

    // Tail rotor
    this.tailRotor = this.scene.add.graphics();
    // Position tailored for the new body shape
    this.tailRotor.setPosition(0, 42); 
    this.visualContainer.add(this.tailRotor);
    this.drawTailRotor(); // Initial draw

    // Level indicator
    this.levelText = this.scene.add.text(0, 0, this.level.toString(), {
      fontSize: '14px', // Smaller font since it's scaled up
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.visualContainer.add(this.levelText); // Add to container so it scales
  }

  private drawBody(): void {
    const graphics = this.helicopterBody;
    graphics.clear();
    
    const color = this.config.color;
    const strokeColor = 0xffffff;

    // 1. Skids (Landing Gear)
    // 1. Skids (Landing Gear)
    graphics.lineStyle(2, 0x333333);
    
    // Left Skid assembly
    graphics.beginPath();
    graphics.moveTo(-8, 10); graphics.lineTo(-8, 15); // Back strut
    graphics.moveTo(-8, -5); graphics.lineTo(-8, -10); // Front strut
    graphics.moveTo(-8, 18); graphics.lineTo(-8, -25); // Main Runner (long)
    graphics.strokePath();

    // Right Skid assembly
    graphics.beginPath();
    graphics.moveTo(8, 10); graphics.lineTo(8, 15); // Back strut
    graphics.moveTo(8, -5); graphics.lineTo(8, -10); // Front strut
    graphics.moveTo(8, 18); graphics.lineTo(8, -25); // Main Runner (long)
    graphics.strokePath();

    // 2. Tail Boom
    graphics.fillStyle(color);
    graphics.lineStyle(1, strokeColor);
    graphics.beginPath();
    graphics.moveTo(-4, 0);
    graphics.lineTo(4, 0);
    graphics.lineTo(2, 45); // Taper towards back
    graphics.lineTo(-2, 45);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    // 3. Tail Fin (Horizontal Stabilizer)
    graphics.fillStyle(color);
    graphics.fillRoundedRect(-10, 38, 20, 4, 1);
    graphics.strokeRoundedRect(-10, 38, 20, 4, 1);

    // 4. Main Body (Fuselage) - Teardrop/Oval shape
    // Using an ellipse for a smoother look
    graphics.fillStyle(color);
    graphics.lineStyle(2, strokeColor);
    // Ellipse centered slightly forward
    graphics.fillEllipse(0, -2, 22, 30);
    graphics.strokeEllipse(0, -2, 22, 30);

    // 5. Cockpit / Windshield
    graphics.fillStyle(0x87CEEB); // Sky blue
    graphics.lineStyle(1, 0x4a90a4);
    // Draw a shape at the front (top in 2D top-down view) - using arc/chord
    graphics.beginPath();
    // Arc for windshield
    graphics.arc(0, -6, 9, Math.PI, 2 * Math.PI, false); // Upper half circle-ish
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawRotor(): void {
    this.mainRotor.clear();
    this.mainRotor.lineStyle(2, 0xcccccc, 0.8);
    this.mainRotor.fillStyle(0xeeeeee, 0.5); // Translucent blur effect

    const bladeLength = 35; // Shortened from 45 as requested

    // Draw 2 blades
    for (let i = 0; i < 2; i++) {
        const angle = this.rotorAngle + (i * Math.PI);
        
        // Blade logic
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        // Draw blade line (crisp center)
        this.mainRotor.beginPath();
        this.mainRotor.moveTo(0, 0);
        this.mainRotor.lineTo(dx * bladeLength, dy * bladeLength);
        this.mainRotor.strokePath();
    }
    
    // Hub
    this.mainRotor.fillStyle(0x555555);
    this.mainRotor.fillCircle(0, 0, 3);
  }

  private drawTailRotor(): void {
    this.tailRotor.clear();
    this.tailRotor.lineStyle(1, 0xcccccc, 0.9);
    
    const bladeLength = 12;
    
    // Draw 2 small blades
    for (let i = 0; i < 2; i++) {
        const angle = this.rotorAngle * 2 + (i * Math.PI); // Spin faster
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        this.tailRotor.beginPath();
        this.tailRotor.moveTo(0, 0);
        this.tailRotor.lineTo(dx * bladeLength, dy * bladeLength);
        this.tailRotor.strokePath();
    }
    
    // Hub
    this.tailRotor.fillStyle(0x555555);
    this.tailRotor.fillCircle(0, 0, 1.5);
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);
    // Highlight the body graphic
    // We can't easily change stroke of a drawn graphic without redrawing, 
    // but we can add a selection indicator to the container
    if (selected) {
        // Just ensure range circle is visible
    }
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
        // Aiming logic involves visual rotation if we want the helicopter to face target, 
        // but it's patrolling. 
        // We'll skip turret rotation for now as the new clean design simulates a fixed forward gun or internal bay.
        // If we want turret, we can add it later.
        
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
    // We rotate the visual container? No, rotate the whole container (this)
    // But this involves rotating `this`. Visuals are inside.
    this.setRotation(movementAngle);
    
    // Keep level text upright? 
    // If we want text upright, we'd counter-rotate it. 
    // For now let it rotate with heli.
    this.levelText.setRotation(-movementAngle);
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

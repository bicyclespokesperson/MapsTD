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

enum HelicopterState {
  IDLE,      // Patrolling/Orbiting home base
  CHASING,   // Flying towards a target
  ATTACKING, // Orbiting/Engaging a target
  RETURNING  // Flying back to home base
}

export class HelicopterTower extends Phaser.GameObjects.Container {
  public readonly type: TowerType = 'HELICOPTER';
  public readonly config: HelicopterConfig;
  public readonly geoPosition: { lat: number; lng: number }; // Center of patrol (Home Base)

  public level: number = 1;
  public stats: TowerStats;
  public targetingMode: TargetingMode = 'FIRST';
  public statistics: TowerStatistics;

  private converter: CoordinateConverter;
  private currentTarget: Enemy | null = null;
  private timeSinceLastFire: number = 0;
  
  // Flight State
  private flightState: HelicopterState = HelicopterState.IDLE;
  
  // Physics
  private currentSpeed: number = 0;
  
  // Position
  private currentLatLng: L.LatLng;
  
  // Attack/Orbit logic
  private orbitAngle: number = 0;
  private readonly ORBIT_RADIUS = 50; // Distance to orbit target/home
  
  // Visual components
  private rangeCircle!: Phaser.GameObjects.Arc;
  private domainCircle!: Phaser.GameObjects.Arc;
  private visualContainer!: Phaser.GameObjects.Container;
  private helicopterBody!: Phaser.GameObjects.Graphics;
  private mainRotor!: Phaser.GameObjects.Graphics;
  private tailRotor!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  
  // Rotor animation
  private rotorAngle: number = 0;
  
  // Scaling factor for visuals
  private readonly VISUAL_SCALE: number = 0.7;

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
    // 1. Domain Circle (Total range = movement + weapon range) - Added to scene, not container
    const homePos = this.converter.latLngToPixel(L.latLng(this.geoPosition.lat, this.geoPosition.lng));
    this.domainCircle = this.scene.add.arc(homePos.x, homePos.y, this.getTotalDomainInPixels(), 0, 360, false, 0xffffff, 0);
    this.domainCircle.setStrokeStyle(2, 0xffffff, 0.2);
    this.domainCircle.setVisible(false);
    // Not added to container - stays fixed at home position

    // 2. Range Circle (Weapon range) - Follows helicopter
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.4);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    // 3. Visual Container (Helicopter sprite)
    this.visualContainer = this.scene.add.container(0, 0);
    this.visualContainer.setScale(this.VISUAL_SCALE);
    this.add(this.visualContainer);

    // --- Helicopter Graphics ---
    this.helicopterBody = this.scene.add.graphics();
    this.visualContainer.add(this.helicopterBody);
    
    this.drawBody();
    
    // Rotor mast
    const rotorMast = this.scene.add.rectangle(0, 0, 6, 8, 0x333333);
    this.visualContainer.add(rotorMast);

    // Main rotor
    this.mainRotor = this.scene.add.graphics();
    this.visualContainer.add(this.mainRotor);
    this.drawRotor();

    // Tail rotor
    this.tailRotor = this.scene.add.graphics();
    this.tailRotor.setPosition(0, 42); 
    this.visualContainer.add(this.tailRotor);
    this.drawTailRotor();

    // Level indicator
    this.levelText = this.scene.add.text(0, 0, this.level.toString(), {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.visualContainer.add(this.levelText);
  }

  private drawBody(): void {
    const graphics = this.helicopterBody;
    graphics.clear();
    
    const color = this.config.color;
    const strokeColor = 0xffffff;

    // Skids
    graphics.lineStyle(2, 0x333333);
    
    graphics.beginPath();
    graphics.moveTo(-8, 10); graphics.lineTo(-8, 15);
    graphics.moveTo(-8, -5); graphics.lineTo(-8, -10);
    graphics.moveTo(-8, 18); graphics.lineTo(-8, -25);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(8, 10); graphics.lineTo(8, 15);
    graphics.moveTo(8, -5); graphics.lineTo(8, -10);
    graphics.moveTo(8, 18); graphics.lineTo(8, -25);
    graphics.strokePath();

    // Tail Boom
    graphics.fillStyle(color);
    graphics.lineStyle(1, strokeColor);
    graphics.beginPath();
    graphics.moveTo(-4, 0);
    graphics.lineTo(4, 0);
    graphics.lineTo(2, 45);
    graphics.lineTo(-2, 45);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    // Tail Fin
    graphics.fillStyle(color);
    graphics.fillRoundedRect(-10, 38, 20, 4, 1);
    graphics.strokeRoundedRect(-10, 38, 20, 4, 1);

    // Fuselage
    graphics.fillStyle(color);
    graphics.lineStyle(2, strokeColor);
    graphics.fillEllipse(0, -2, 22, 30);
    graphics.strokeEllipse(0, -2, 22, 30);

    // Cockpit
    graphics.fillStyle(0x87CEEB);
    graphics.lineStyle(1, 0x4a90a4);
    graphics.beginPath();
    graphics.arc(0, -6, 9, Math.PI, 2 * Math.PI, false);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawRotor(): void {
    this.mainRotor.clear();
    this.mainRotor.lineStyle(2, 0xcccccc, 0.8);
    this.mainRotor.fillStyle(0xeeeeee, 0.5);
    const bladeLength = 35;

    for (let i = 0; i < 2; i++) {
        const angle = this.rotorAngle + (i * Math.PI);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        this.mainRotor.beginPath();
        this.mainRotor.moveTo(0, 0);
        this.mainRotor.lineTo(dx * bladeLength, dy * bladeLength);
        this.mainRotor.strokePath();
    }
    
    this.mainRotor.fillStyle(0x555555);
    this.mainRotor.fillCircle(0, 0, 3);
  }

  private drawTailRotor(): void {
    this.tailRotor.clear();
    this.tailRotor.lineStyle(1, 0xcccccc, 0.9);
    const bladeLength = 12;
    
    for (let i = 0; i < 2; i++) {
        const angle = this.rotorAngle * 2 + (i * Math.PI);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        this.tailRotor.beginPath();
        this.tailRotor.moveTo(0, 0);
        this.tailRotor.lineTo(dx * bladeLength, dy * bladeLength);
        this.tailRotor.strokePath();
    }
    
    this.tailRotor.fillStyle(0x555555);
    this.tailRotor.fillCircle(0, 0, 1.5);
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);
    this.domainCircle.setVisible(selected);
  }

  public update(delta: number, enemies: Enemy[], isWaveActive: boolean = true): void {
    this.animateRotors(delta);

    if (isWaveActive) {
      this.timeSinceLastFire += delta;
      
      this.updateState(enemies);
      this.updateMovement(delta);
      this.updateCombat();
    } else {
      // When paused/wave inactive, return to base/idle
      this.flightState = HelicopterState.RETURNING;
      this.updateMovement(delta);
    }

    // Always sync position
    this.updateScreenPosition();
    this.updateCircles();
  }

  private updateState(enemies: Enemy[]): void {
    // 1. Validate current target
    if (this.currentTarget && (this.currentTarget.isDead() || !this.isTargetInDomain(this.currentTarget))) {
      this.currentTarget = null;
    }

    // 2. Find new target if needed
    if (!this.currentTarget) {
      this.currentTarget = this.findTarget(enemies);
    }

    // 3. Determine State
    if (this.currentTarget) {
      const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.currentTarget.x, this.currentTarget.y);
      if (distToTarget <= this.getRangeInPixels() * 0.8) { // Get a bit closer than max range
        this.flightState = HelicopterState.ATTACKING;
      } else {
        this.flightState = HelicopterState.CHASING;
      }
    } else {
      // No target, check if we are at home
      const homePos = this.converter.latLngToPixel(L.latLng(this.geoPosition.lat, this.geoPosition.lng));
      const distToHome = Phaser.Math.Distance.Between(this.x, this.y, homePos.x, homePos.y);
      
      if (distToHome < this.ORBIT_RADIUS * 1.5) {
        this.flightState = HelicopterState.IDLE;
      } else {
        this.flightState = HelicopterState.RETURNING;
      }
    }
  }

  private updateMovement(delta: number): void {
    const dt = delta / 1000;
    const configSpeed = this.config.moveSpeed || 120;
    const configAccel = this.config.acceleration || 150;
    const configTurn = this.config.turnSpeed || 120;

    // Get current positions in pixels (re-projected each frame to handle map panning)
    const currentPos = this.converter.latLngToPixel(this.currentLatLng);
    const homePos = this.converter.latLngToPixel(L.latLng(this.geoPosition.lat, this.geoPosition.lng));

    // When idle, hover at home - no movement needed
    if (this.flightState === HelicopterState.IDLE) {
        this.currentSpeed = 0;
        this.levelText.setRotation(-this.rotation);
        return;
    }

    let targetX: number;
    let targetY: number;

    switch (this.flightState) {
      case HelicopterState.CHASING:
        if (this.currentTarget) {
          targetX = this.currentTarget.x;
          targetY = this.currentTarget.y;
        } else {
          this.flightState = HelicopterState.RETURNING;
          return;
        }
        break;

      case HelicopterState.ATTACKING:
        if (this.currentTarget) {
          this.orbitAngle += (configSpeed / this.ORBIT_RADIUS) * dt * 0.5;
          targetX = this.currentTarget.x + Math.cos(this.orbitAngle) * this.ORBIT_RADIUS;
          targetY = this.currentTarget.y + Math.sin(this.orbitAngle) * this.ORBIT_RADIUS;
        } else {
          this.flightState = HelicopterState.RETURNING;
          return;
        }
        break;

      case HelicopterState.RETURNING:
      default:
        targetX = homePos.x;
        targetY = homePos.y;
        break;
    }

    if (isNaN(targetX) || isNaN(targetY)) {
        this.flightState = HelicopterState.RETURNING;
        return;
    }

    // Movement physics using current pixel position
    const dx = targetX - currentPos.x;
    const dy = targetY - currentPos.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    const angleToTarget = Math.atan2(dy, dx);

    if (distToTarget > 10) {
        this.currentSpeed = Math.min(this.currentSpeed + configAccel * dt, configSpeed);
    } else {
        this.currentSpeed = Math.max(this.currentSpeed - configAccel * dt, 0);
    }

    const moveX = Math.cos(angleToTarget) * this.currentSpeed * dt;
    const moveY = Math.sin(angleToTarget) * this.currentSpeed * dt;

    // Calculate new pixel position
    let newPixelX = currentPos.x + moveX;
    let newPixelY = currentPos.y + moveY;

    // Clamp position within movement domain (so weapon range stays within total domain)
    const movementRadius = this.getMovementDomainInPixels();
    const dxFromHome = newPixelX - homePos.x;
    const dyFromHome = newPixelY - homePos.y;
    const distFromHome = Math.sqrt(dxFromHome * dxFromHome + dyFromHome * dyFromHome);

    if (distFromHome > movementRadius) {
        const scale = movementRadius / distFromHome;
        newPixelX = homePos.x + dxFromHome * scale;
        newPixelY = homePos.y + dyFromHome * scale;
    }

    // Convert back to latLng (this is the source of truth)
    if (!isNaN(newPixelX) && !isNaN(newPixelY)) {
        try {
            this.currentLatLng = this.converter.pixelToLatLng(newPixelX, newPixelY);
        } catch (e) {
            this.currentLatLng = L.latLng(this.geoPosition.lat, this.geoPosition.lng);
        }
    }

    // Rotation: face target when attacking, face movement direction otherwise
    let desiredRotation: number;
    if (this.flightState === HelicopterState.ATTACKING && this.currentTarget) {
        const toTargetX = this.currentTarget.x - currentPos.x;
        const toTargetY = this.currentTarget.y - currentPos.y;
        desiredRotation = Math.atan2(toTargetY, toTargetX) + Math.PI / 2;
    } else {
        desiredRotation = angleToTarget + Math.PI / 2;
    }

    const diff = desiredRotation - this.rotation;
    const adjustedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turnAmount = (configTurn * Math.PI / 180) * dt;

    if (Math.abs(adjustedDiff) < turnAmount) {
        this.setRotation(desiredRotation);
    } else {
        this.setRotation(this.rotation + Math.sign(adjustedDiff) * turnAmount);
    }

    this.levelText.setRotation(-this.rotation);
  }

  private updateCombat(): void {
    if (this.flightState !== HelicopterState.ATTACKING || !this.currentTarget) return;

    // Check if we can fire
    if (this.timeSinceLastFire >= this.stats.fireRateMs) {
      // Fire!
      // Double check range just in case
      if (this.isInRange(this.currentTarget)) {
          this.fire(this.currentTarget);
          this.timeSinceLastFire = 0;
      }
    }
  }

  private updateScreenPosition(): void {
    // Convert latLng (source of truth) to screen pixels
    const screenPos = this.converter.latLngToPixel(this.currentLatLng);
    this.setPosition(screenPos.x, screenPos.y);
  }

  private animateRotors(delta: number): void {
    this.rotorAngle += (delta / 200) * Math.PI * 2;
    if (this.rotorAngle > Math.PI * 2) {
      this.rotorAngle -= Math.PI * 2;
    }
    this.drawRotor();
    this.drawTailRotor();
  }

  private updateCircles(): void {
    const rangePixels = this.getRangeInPixels();
    const totalDomainPixels = this.getTotalDomainInPixels();

    if (this.rangeCircle.radius !== rangePixels) {
        this.rangeCircle.setRadius(rangePixels);
        this.domainCircle.setRadius(totalDomainPixels);
    }

    // Domain circle is in scene coordinates, position at home base
    const homePos = this.converter.latLngToPixel(L.latLng(this.geoPosition.lat, this.geoPosition.lng));
    this.domainCircle.setPosition(homePos.x, homePos.y);
  }

  private findTarget(enemies: Enemy[]): Enemy | null {
    const enemiesInDomain = enemies.filter(
      (enemy) => !enemy.isDead() && this.isTargetInDomain(enemy)
    );

    if (enemiesInDomain.length === 0) return null;

    // Standard targeting logic (First, Strongest, etc)
    // We can reuse the same sorting logic
    switch (this.targetingMode) {
      case 'FIRST':
        return enemiesInDomain.reduce((closest, enemy) =>
          enemy.getDistanceToGoal() < closest.getDistanceToGoal() ? enemy : closest
        );
      case 'LAST':
        return enemiesInDomain.reduce((furthest, enemy) =>
          enemy.getDistanceToGoal() > furthest.getDistanceToGoal() ? enemy : furthest
        );
      case 'CLOSEST':
        // Closest to HELICOPTER
        return enemiesInDomain.reduce((closest, enemy) => {
          const d1 = Phaser.Math.Distance.Between(this.x, this.y, closest.x, closest.y);
          const d2 = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
          return d2 < d1 ? enemy : closest;
        });
      case 'STRONGEST':
        return enemiesInDomain.reduce((strongest, enemy) =>
          enemy.getHealth() > strongest.getHealth() ? enemy : strongest
        );
      default:
        return enemiesInDomain[0];
    }
  }

  private getRangeInPixels(): number {
    return this.stats.range * this.converter.pixelsPerMeter();
  }

  private getMovementDomainInPixels(): number {
    return this.config.domainRadius * this.converter.pixelsPerMeter();
  }

  private getTotalDomainInPixels(): number {
    return this.getMovementDomainInPixels() + this.getRangeInPixels();
  }

  private isInRange(enemy: Enemy): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    return distance <= this.getRangeInPixels();
  }

  private isTargetInDomain(enemy: Enemy): boolean {
    const homePos = this.converter.latLngToPixel(L.latLng(this.geoPosition.lat, this.geoPosition.lng));
    const distance = Phaser.Math.Distance.Between(homePos.x, homePos.y, enemy.x, enemy.y);
    return distance <= this.getTotalDomainInPixels();
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

  public getCurrentLatLng(): L.LatLng {
    return this.currentLatLng;
  }

  public destroy(fromScene?: boolean): void {
    this.domainCircle.destroy();
    super.destroy(fromScene);
  }
}

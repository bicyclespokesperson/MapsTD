import Phaser from 'phaser';
import {
  TowerType,
  TargetingMode,
  TowerStats,
  TowerConfig,
  TOWER_CONFIGS,
  ECONOMY,
} from './TowerTypes';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { CoordinateConverter } from '../coordinateConverter';
import { ElevationMap } from '../elevationMap';
import { GAME_CONFIG } from '../config';

export interface TowerStatistics {
  kills: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  createdAt: number;
}

export class Tower extends Phaser.GameObjects.Container {
  public readonly type: TowerType;
  public readonly config: TowerConfig;
  public readonly geoPosition: { lat: number; lng: number };

  public level: number = 1;
  public stats: TowerStats;
  public targetingMode: TargetingMode = 'FIRST';
  public statistics: TowerStatistics;
  
  private elevationMap: ElevationMap | null;

  private converter: CoordinateConverter;
  private currentTarget: Enemy | null = null;
  private timeSinceLastFire: number = 0;
  private rangeCircle!: Phaser.GameObjects.Arc;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private rangeOutlineGraphics!: Phaser.GameObjects.Graphics;
  private towerBody!: Phaser.GameObjects.Arc;
  private barrel!: Phaser.GameObjects.Line;
  private levelText!: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: TowerType,
    geoPosition: { lat: number; lng: number },
    converter: CoordinateConverter,
    elevationMap: ElevationMap | null
  ) {
    super(scene, x, y);

    this.type = type;
    this.geoPosition = geoPosition;
    this.converter = converter;
    this.elevationMap = elevationMap;
    this.config = TOWER_CONFIGS[type];
    this.config = TOWER_CONFIGS[type];
    this.geoPosition = geoPosition;
    this.converter = converter;
    this.stats = { ...this.config.baseStats };

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
    // Initialize range graphics FIRST so they render behind tower body
    this.rangeGraphics = this.scene.add.graphics();
    this.rangeGraphics.setVisible(false);
    this.add(this.rangeGraphics);

    this.rangeOutlineGraphics = this.scene.add.graphics();
    this.rangeOutlineGraphics.setVisible(false);
    this.add(this.rangeOutlineGraphics);

    // Old circle (fallback)
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.3);
    this.rangeCircle.setVisible(false);
    this.add(this.rangeCircle);

    // Tower body and barrel on TOP
    this.towerBody = this.scene.add.arc(0, 0, 10, 0, 360, false, this.config.color);
    this.towerBody.setStrokeStyle(2, 0xffffff);
    this.add(this.towerBody);

    this.barrel = this.scene.add.line(0, 0, 0, 0, 0, -15, 0xffffff);
    this.barrel.setLineWidth(3);
    this.add(this.barrel);

    this.levelText = this.scene.add.text(0, 0, this.level.toString(), {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.add(this.levelText);

    // Draw initial outline
    this.updateRangePolygon();
  }



  private updateRangePolygon(): void {
    if (!this.elevationMap || this.config.ignoresElevation || this.config.requiresLineOfSight === false) {
      this.rangeOutlineGraphics.setVisible(false);
      return;
    }

    const polygon = this.elevationMap.calculateVisibilityPolygon(
      { lat: this.geoPosition.lat, lng: this.geoPosition.lng, heightOffset: 10 },
      this.stats.range,
      72,
      20
    );

    const points = polygon.map(p => this.converter.latLngToPixel(p));
    const localPoints = points.map(p => ({ x: p.x - this.x, y: p.y - this.y }));

    // Draw outline only
    this.rangeOutlineGraphics.clear();
    this.rangeOutlineGraphics.lineStyle(3, 0x0088ff, 1.0);
    if (localPoints.length > 0) {
      this.rangeOutlineGraphics.beginPath();
      this.rangeOutlineGraphics.moveTo(localPoints[0].x, localPoints[0].y);
      for (let i = 1; i < localPoints.length; i++) {
        this.rangeOutlineGraphics.lineTo(localPoints[i].x, localPoints[i].y);
      }
      this.rangeOutlineGraphics.closePath();
      this.rangeOutlineGraphics.strokePath();
    }
    this.rangeOutlineGraphics.setVisible(true);

    // Store points for fill drawing when selected
    (this as any)._cachedLocalPoints = localPoints;
  }

  public setSelected(selected: boolean): void {
    // Draw fill when selected (for towers with elevation)
    if (selected && this.elevationMap && this.config.requiresLineOfSight !== false && !this.config.ignoresElevation) {
      const localPoints = (this as any)._cachedLocalPoints as {x: number, y: number}[] | undefined;
      
      if (localPoints && localPoints.length > 0) {
        this.rangeGraphics.clear();
        this.rangeGraphics.fillStyle(0x0088ff, 0.2);
        this.rangeGraphics.beginPath();
        this.rangeGraphics.moveTo(localPoints[0].x, localPoints[0].y);
        for (let i = 1; i < localPoints.length; i++) {
          this.rangeGraphics.lineTo(localPoints[i].x, localPoints[i].y);
        }
        this.rangeGraphics.closePath();
        this.rangeGraphics.fillPath();
        this.rangeGraphics.setVisible(true);
      }
      this.rangeCircle.setVisible(false);
    } else {
      this.rangeGraphics.setVisible(false);
      // For towers ignoring elevation, show circle when selected
      if (this.config.ignoresElevation) {
        this.rangeCircle.setVisible(selected);
      } else {
        this.rangeCircle.setVisible(false);
      }
    }
    this.towerBody.setStrokeStyle(2, selected ? 0xffff00 : 0xffffff);
  }

  public update(delta: number, enemies: Enemy[]): void {
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
        // Target based on CURRENT health
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
    const distPx = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    const distMeters = distPx / this.converter.pixelsPerMeter();
    let effectiveRangeMeters = this.stats.range;
    
    // Relative Elevation Logic
    if (this.elevationMap && !this.config.ignoresElevation) {
        const towerElev = this.elevationMap.getElevation(this.geoPosition.lat, this.geoPosition.lng);
        const enemyLatLng = enemy.getPosition();
        const enemyElev = this.elevationMap.getElevation(enemyLatLng.lat, enemyLatLng.lng);
        
        // Bonus for shooting down, penalty for shooting up
        const diff = towerElev - enemyElev;
        const { RANGE_BONUS_PER_METER, MIN_RANGE_FACTOR, MAX_RANGE_FACTOR } = GAME_CONFIG.ELEVATION;
        const factor = Phaser.Math.Clamp(diff * RANGE_BONUS_PER_METER, MIN_RANGE_FACTOR, MAX_RANGE_FACTOR); 
        
        effectiveRangeMeters = effectiveRangeMeters * (1 + factor);
    }
    
    if (distMeters > effectiveRangeMeters) return false;
    
    // Check Line of Sight
    if (this.elevationMap && this.config.requiresLineOfSight !== false && !this.config.ignoresElevation) {
        const enemyLatLng = enemy.getPosition();
        
        // We rely on checkLineOfSight to handle the "Permissive High Ground" rule per-step.
        
        const towerHeight = 10;
        const enemyHeight = 2;
        
        const hasLOS = this.elevationMap.checkLineOfSight(
            { lat: this.geoPosition.lat, lng: this.geoPosition.lng, heightOffset: towerHeight },
            { lat: enemyLatLng.lat, lng: enemyLatLng.lng, heightOffset: enemyHeight }
        );
        
        if (!hasLOS) return false; 
    }
    
    return true;
  }

  private aimAt(enemy: Enemy): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
    this.barrel.setRotation(angle + Math.PI / 2);
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

    const newSize = 10 + (this.level - 1) * 2;
    this.towerBody.setRadius(newSize);

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
}

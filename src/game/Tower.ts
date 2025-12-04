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

  private converter: CoordinateConverter;
  private currentTarget: Enemy | null = null;
  private timeSinceLastFire: number = 0;
  private rangeCircle!: Phaser.GameObjects.Arc;
  private towerBody!: Phaser.GameObjects.Arc;
  private barrel!: Phaser.GameObjects.Line;
  private levelText!: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: TowerType,
    geoPosition: { lat: number; lng: number },
    converter: CoordinateConverter
  ) {
    super(scene, x, y);

    this.type = type;
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
    this.rangeCircle = this.scene.add.arc(0, 0, this.getRangeInPixels(), 0, 360, false, 0xffffff, 0);
    this.rangeCircle.setStrokeStyle(2, this.config.color, 0.3);
    this.add(this.rangeCircle);

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
  }

  public setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected);
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

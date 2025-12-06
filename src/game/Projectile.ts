import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Tower } from './Tower';
import { HelicopterTower } from './HelicopterTower';

// Common interface for anything that can fire projectiles
export interface ProjectileSource {
  x: number;
  y: number;
  recordHit(damage: number): void;
  recordKill(): void;
}

// Union type for all tower types that can fire
export type AnyTower = Tower | HelicopterTower;

export class Projectile extends Phaser.GameObjects.Graphics {
  private target: Enemy;
  private source: ProjectileSource;
  private damage: number;
  private speed: number;
  private splashRadius: number | undefined;
  private splashDamage: number | undefined;
  private startX: number;
  private startY: number;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    source: ProjectileSource,
    target: Enemy,
    damage: number,
    speed: number,
    color: number,
    splashRadius?: number,
    splashDamage?: number
  ) {
    super(scene);

    this.source = source;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.splashRadius = splashRadius;
    this.splashDamage = splashDamage;
    this.color = color;

    this.startX = source.x;
    this.startY = source.y;
    this.setPosition(this.startX, this.startY);

    if (speed === Infinity) {
      this.renderLaser();
      this.applyDamage();
      this.scene.time.delayedCall(100, () => this.destroy());
    } else {
      this.renderProjectile();
      scene.add.existing(this);
    }
  }

  private renderLaser(): void {
    this.lineStyle(2, this.color, 0.8);
    this.beginPath();
    this.moveTo(0, 0);
    const dx = this.target.x - this.startX;
    const dy = this.target.y - this.startY;
    this.lineTo(dx, dy);
    this.strokePath();
    this.scene.add.existing(this);
  }

  private renderProjectile(): void {
    this.fillStyle(this.color, 1);
    const size = this.splashRadius ? 6 : 3;
    this.fillCircle(0, 0, size);
  }

  public update(delta: number): void {
    if (this.speed === Infinity) return;

    if (!this.target || this.target.isDead()) {
      this.destroy();
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      this.applyDamage();
      this.destroy();
      return;
    }

    const moveDistance = (this.speed * delta) / 1000;
    const ratio = moveDistance / distance;
    this.x += dx * ratio;
    this.y += dy * ratio;
  }

  private applyDamage(): void {
    if (!this.target || this.target.isDead()) return;

    this.target.takeDamage(this.damage);
    this.source.recordHit(this.damage);

    if (this.target.isDead()) {
      this.source.recordKill();
    }

    if (this.splashRadius && this.splashDamage) {
      this.applySplashDamage();
    }
  }

  private applySplashDamage(): void {
    if (!this.splashRadius || !this.splashDamage) return;

    const enemies = (this.scene as any).waveManager?.getActiveEnemies() || [];
    const scene = this.scene;

    const splashCircle = scene.add.circle(this.target.x, this.target.y, this.splashRadius, 0xff6600, 0.3);
    scene.time.delayedCall(200, () => {
      if (splashCircle && splashCircle.scene) {
        splashCircle.destroy();
      }
    });

    for (const enemy of enemies) {
      if (enemy === this.target || enemy.isDead()) continue;

      const distance = Phaser.Math.Distance.Between(
        this.target.x,
        this.target.y,
        enemy.x,
        enemy.y
      );

      if (distance <= this.splashRadius) {
        enemy.takeDamage(this.splashDamage);
        this.source.recordHit(this.splashDamage);

        if (enemy.isDead()) {
          this.source.recordKill();
        }
      }
    }
  }
}

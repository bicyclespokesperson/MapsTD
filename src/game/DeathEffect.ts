import Phaser from 'phaser';

interface Particle {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  life: number;
}

export class DeathEffect {
  private scene: Phaser.Scene;
  private particles: Particle[] = [];
  private elapsed: number = 0;
  private duration: number = 400;
  private active: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number, size: number) {
    this.scene = scene;

    const particleCount = Math.max(6, Math.floor(size * 1.5));
    const baseSpeed = 80 + size * 8;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = baseSpeed * (0.5 + Math.random() * 0.5);
      const particleSize = 2 + Math.random() * 3;

      const sprite = scene.add.circle(x, y, particleSize, color);
      sprite.setDepth(100);

      this.particles.push({
        sprite,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        life: 1,
      });
    }

    const flash = scene.add.circle(x, y, size * 1.5, 0xffffff, 0.8);
    flash.setDepth(99);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  update(delta: number): boolean {
    if (!this.active) return false;

    this.elapsed += delta;
    const progress = this.elapsed / this.duration;

    if (progress >= 1) {
      this.destroy();
      return false;
    }

    for (const particle of this.particles) {
      particle.life = 1 - progress;

      particle.sprite.x += particle.velocityX * (delta / 1000);
      particle.sprite.y += particle.velocityY * (delta / 1000);

      particle.velocityX *= 0.96;
      particle.velocityY *= 0.96;

      particle.sprite.setAlpha(particle.life);
      particle.sprite.setScale(particle.life);
    }

    return true;
  }

  private destroy() {
    this.active = false;
    for (const particle of this.particles) {
      particle.sprite.destroy();
    }
    this.particles = [];
  }

  isActive(): boolean {
    return this.active;
  }
}

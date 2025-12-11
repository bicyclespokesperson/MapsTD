import Phaser from 'phaser';
import { CoordinateConverter } from '../coordinateConverter';
import { BombConfig, TOWER_CONFIGS } from './TowerTypes';
import * as L from 'leaflet';

export class Bomb extends Phaser.GameObjects.Container {
  private config: BombConfig;
  private visuals: Phaser.GameObjects.Arc;
  private converter: CoordinateConverter;
  public geoPosition: { lat: number; lng: number };
  
  private fuseTimer: number = 0;
  private onExplode: (bomb: Bomb) => void;
  private isExploding: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    geoPosition: { lat: number; lng: number },
    converter: CoordinateConverter,
    onExplode: (bomb: Bomb) => void
  ) {
    super(scene, x, y);
    this.config = TOWER_CONFIGS.BOMB as BombConfig;
    this.geoPosition = geoPosition;
    this.converter = converter;
    this.onExplode = onExplode;

    // Visuals
    const radius = 10;
    this.visuals = scene.add.arc(0, 0, radius, 0, 360, false, 0xff0000);
    this.add(this.visuals);
    
    // Pulse animation
    scene.tweens.add({
        targets: this.visuals,
        scale: 1.5,
        alpha: 0.5,
        duration: 300,
        yoyo: true,
        repeat: -1
    });

    scene.add.existing(this);
  }

  update(delta: number, isWaveActive: boolean) {
    if (this.isExploding) return;

    // 1. Update Position (Panning support)
    const screenPos = this.converter.latLngToPixel(L.latLng(this.geoPosition));
    this.setPosition(screenPos.x, screenPos.y);

    // 2. Timer Logic (Wait for wave)
    if (isWaveActive) {
        this.fuseTimer += delta;
        if (this.fuseTimer >= this.config.fuseTime) {
            this.explode();
        }
    }
  }

  private explode() {
    this.isExploding = true;
    this.explodeEffect();
    this.onExplode(this);
    this.destroy(); 
  }

  private explodeEffect() {
    // Visual explosion
    const radiusPixels = this.config.baseStats.range * this.converter.pixelsPerMeter();
    
    // 1. Explosion flash
    const explosion = this.scene.add.circle(this.x, this.y, 10, 0xffa500, 1);
    this.scene.tweens.add({
      targets: explosion,
      radius: radiusPixels,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.out',
      onComplete: () => {
        explosion.destroy();
      }
    });

    // 2. Shockwave
    const shockwave = this.scene.add.circle(this.x, this.y, 10, 0xffffff, 0);
    shockwave.setStrokeStyle(4, 0xffffff);
    this.scene.tweens.add({
        targets: shockwave,
        radius: radiusPixels * 1.2,
        alpha: { from: 0.8, to: 0 },
        duration: 400,
        ease: 'Quad.out',
        onComplete: () => {
            shockwave.destroy();
        }
    });
    
    // 3. Crater (permanent decal)
    // Emit event so GameScene can create a Crater object that tracks geo-position
    // Pass radius in meters so crater stays consistent at different zoom levels
    this.scene.events.emit('crater-created', this.geoPosition, this.config.baseStats.range);
  }
}

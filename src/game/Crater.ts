import Phaser from 'phaser';
import { CoordinateConverter } from '../coordinateConverter';
import * as L from 'leaflet';

export class Crater extends Phaser.GameObjects.Container {
  public geoPosition: { lat: number; lng: number };
  private converter: CoordinateConverter;
  private radiusMeters: number;
  private outerCrater: Phaser.GameObjects.Arc;
  private innerCrater: Phaser.GameObjects.Arc;
  private craterRim: Phaser.GameObjects.Arc;
  private scorch: Phaser.GameObjects.Arc;
  private debris: Phaser.GameObjects.Arc[];
  private debrisPositions: Array<{ angle: number; distanceRatio: number; sizeRatio: number }>;

  constructor(
    scene: Phaser.Scene,
    geoPosition: { lat: number; lng: number },
    radiusMeters: number,
    converter: CoordinateConverter
  ) {
    const screenPos = converter.latLngToPixel(L.latLng(geoPosition));
    super(scene, screenPos.x, screenPos.y);

    this.geoPosition = geoPosition;
    this.converter = converter;
    this.radiusMeters = radiusMeters;
    const radiusPixels = radiusMeters * converter.pixelsPerMeter();

    // Scorch marks (outermost, faded)
    this.scorch = scene.add.arc(0, 0, radiusPixels * 1.3, 0, 360, false, 0x1a1a1a, 0.25);
    this.add(this.scorch);

    // Outer crater (dark brown/black)
    this.outerCrater = scene.add.arc(0, 0, radiusPixels, 0, 360, false, 0x2b1f1a, 0.85);
    this.add(this.outerCrater);

    // Crater rim (lighter edge for depth)
    this.craterRim = scene.add.arc(0, 0, radiusPixels, 0, 360, false);
    this.craterRim.setStrokeStyle(radiusPixels * 0.08, 0x4a3a2a, 0.6);
    this.add(this.craterRim);

    // Inner crater (darker center)
    this.innerCrater = scene.add.arc(0, 0, radiusPixels * 0.6, 0, 360, false, 0x0a0a0a, 0.9);
    this.add(this.innerCrater);

    // Random debris/rocks scattered around
    this.debris = [];
    this.debrisPositions = [];
    const debrisCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + (Math.random() - 0.5) * 0.8;
      const distanceRatio = 0.4 + Math.random() * 0.5;
      const sizeRatio = 0.03 + Math.random() * 0.06;

      this.debrisPositions.push({ angle, distanceRatio, sizeRatio });

      const distance = radiusPixels * distanceRatio;
      const debrisX = Math.cos(angle) * distance;
      const debrisY = Math.sin(angle) * distance;
      const debrisSize = radiusPixels * sizeRatio;

      const rock = scene.add.arc(debrisX, debrisY, debrisSize, 0, 360, false, 0x3a2a1a, 0.7);
      this.debris.push(rock);
      this.add(rock);
    }

    scene.add.existing(this);
    scene.children.sendToBack(this);
  }

  update() {
    const screenPos = this.converter.latLngToPixel(L.latLng(this.geoPosition));
    const radiusPixels = this.radiusMeters * this.converter.pixelsPerMeter();

    this.setPosition(screenPos.x, screenPos.y);

    // Update all crater elements
    this.scorch.setRadius(radiusPixels * 1.3);
    this.outerCrater.setRadius(radiusPixels);
    this.craterRim.setRadius(radiusPixels);
    this.craterRim.setStrokeStyle(radiusPixels * 0.08, 0x4a3a2a, 0.6);
    this.innerCrater.setRadius(radiusPixels * 0.6);

    // Update debris positions and sizes based on stored ratios
    for (let i = 0; i < this.debris.length; i++) {
      const { angle, distanceRatio, sizeRatio } = this.debrisPositions[i];
      const distance = radiusPixels * distanceRatio;
      const debrisSize = radiusPixels * sizeRatio;

      this.debris[i].setRadius(debrisSize);
      this.debris[i].setPosition(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance
      );
    }
  }
}

import Phaser from 'phaser';
import * as L from 'leaflet';
import { CoordinateConverter } from '../coordinateConverter';
import { RoadPath } from '../roadNetwork';

export class Enemy extends Phaser.GameObjects.Container {
  private health: number;
  private speed: number; // meters per second
  private path: RoadPath;
  private currentWaypointIndex: number;
  private converter: CoordinateConverter;
  private positionLatLng: L.LatLng;
  private isDead: boolean = false;
  private onReachGoal: () => void;

  constructor(
    scene: Phaser.Scene,
    path: RoadPath,
    converter: CoordinateConverter,
    onReachGoal: () => void
  ) {
    super(scene);
    this.path = path;
    this.converter = converter;
    this.onReachGoal = onReachGoal;
    
    this.health = 100;
    this.speed = 30; // 30 meters per second (approx 100km/h - fast!)
    
    this.currentWaypointIndex = 0;
    this.positionLatLng = path.waypoints[0];

    // Create visual
    const circle = scene.add.circle(0, 0, 6, 0xff0000);
    const border = scene.add.circle(0, 0, 8);
    border.setStrokeStyle(2, 0xffffff);
    
    this.add([border, circle]);

    // Initial position
    this.updateScreenPosition();
    
    scene.add.existing(this);
  }

  update(_time: number, delta: number) {
    if (this.isDead) return;

    // Move along path
    const moveDist = (this.speed * delta) / 1000; // meters to move this frame
    this.moveAlongPath(moveDist);
    
    this.updateScreenPosition();
  }

  private moveAlongPath(distanceToMove: number) {
    let remainingDist = distanceToMove;

    while (remainingDist > 0) {
      if (this.currentWaypointIndex >= this.path.waypoints.length - 1) {
        this.reachGoal();
        return;
      }

      const currentPoint = this.positionLatLng;
      const nextPoint = this.path.waypoints[this.currentWaypointIndex + 1];
      
      const distToNext = currentPoint.distanceTo(nextPoint);

      if (remainingDist >= distToNext) {
        // Reached next waypoint
        this.positionLatLng = nextPoint;
        this.currentWaypointIndex++;
        remainingDist -= distToNext;
      } else {
        // Move towards next waypoint
        // Interpolate
        const ratio = remainingDist / distToNext;
        const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * ratio;
        const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * ratio;
        this.positionLatLng = L.latLng(lat, lng);
        remainingDist = 0;
      }
    }
  }

  private updateScreenPosition() {
    const screenPos = this.converter.latLngToPixel(this.positionLatLng);
    this.setPosition(screenPos.x, screenPos.y);
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

  private die() {
    this.isDead = true;
    this.destroy();
    // TODO: Award money, play sound
  }

  private reachGoal() {
    this.isDead = true;
    this.onReachGoal();
    this.destroy();
  }
}

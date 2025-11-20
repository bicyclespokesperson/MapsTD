import Phaser from 'phaser';
import * as L from 'leaflet';
import { CoordinateConverter } from '../coordinateConverter';
import { RoadPath } from '../roadNetwork';

import { GAME_CONFIG } from '../config';

export class Enemy extends Phaser.GameObjects.Container {
  private health: number;
  private speed: number; // meters per second
  private path: RoadPath;
  private currentWaypointIndex: number;
  private converter: CoordinateConverter;
  private positionLatLng: L.LatLng;
  private _isDead: boolean = false;
  private onReachGoal: () => void;
  private onKill: () => void;

  constructor(
    scene: Phaser.Scene,
    path: RoadPath,
    converter: CoordinateConverter,
    onReachGoal: () => void,
    onKill: () => void
  ) {
    super(scene);
    this.path = path;
    this.converter = converter;
    this.onReachGoal = onReachGoal;
    this.onKill = onKill;

    this.health = GAME_CONFIG.ENEMY.HEALTH;
    this.speed = GAME_CONFIG.ENEMY.SPEED;
    
    this.currentWaypointIndex = 0;
    this.positionLatLng = path.waypoints[0];

    // Create visual
    const circle = scene.add.circle(0, 0, GAME_CONFIG.ENEMY.RADIUS, GAME_CONFIG.ENEMY.COLOR);
    const border = scene.add.circle(0, 0, GAME_CONFIG.ENEMY.RADIUS + 2);
    border.setStrokeStyle(GAME_CONFIG.ENEMY.BORDER_WIDTH, GAME_CONFIG.ENEMY.BORDER_COLOR);
    
    this.add([border, circle]);

    // Initial position
    this.updateScreenPosition();
    
    scene.add.existing(this);
  }

  update(_time: number, delta: number) {
    if (this._isDead) return;

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
    this._isDead = true;
    this.onKill();
    this.destroy();
  }

  private reachGoal() {
    this._isDead = true;
    this.onReachGoal();
    this.destroy();
  }

  public getHealth(): number {
    return this.health;
  }

  public isDead(): boolean {
    return this._isDead;
  }

  public getDistanceToGoal(): number {
    let totalDistance = 0;
    for (let i = this.currentWaypointIndex; i < this.path.waypoints.length - 1; i++) {
      const current = i === this.currentWaypointIndex ? this.positionLatLng : this.path.waypoints[i];
      const next = this.path.waypoints[i + 1];
      totalDistance += current.distanceTo(next);
    }
    return totalDistance;
  }
}

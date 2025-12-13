import Phaser from 'phaser';
import * as L from 'leaflet';
import { CoordinateConverter } from '../coordinateConverter';
import { RoadPath } from '../roadNetwork';
import { EnemyType, ENEMY_CONFIGS, EnemyConfig, ENEMY_STYLE } from './EnemyTypes';

export class Enemy extends Phaser.GameObjects.Container {
  private health: number;
  private maxHealth: number;
  private speed: number;
  private path: RoadPath;
  private currentWaypointIndex: number;
  private converter: CoordinateConverter;
  private positionLatLng: L.LatLng;
  private _isDead: boolean = false;
  private onReachGoal: () => void;
  private onKill: () => void;
  private healthArc: Phaser.GameObjects.Arc;
  private reward: number;
  public readonly type: EnemyType;
  private config: EnemyConfig;

  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    path: RoadPath,
    converter: CoordinateConverter,
    onReachGoal: () => void,
    onKill: () => void
  ) {
    super(scene);
    this.type = type;
    this.config = ENEMY_CONFIGS[type];
    this.path = path;
    this.converter = converter;
    this.onReachGoal = onReachGoal;
    this.onKill = onKill;

    this.health = this.config.health;
    this.maxHealth = this.config.health;
    this.speed = this.config.speed;
    this.reward = this.config.reward;

    this.currentWaypointIndex = 0;
    this.positionLatLng = path.waypoints[0];

    // Create visual - health as pie chart with size based on enemy type
    const border = scene.add.circle(0, 0, this.config.size + 2);
    border.setStrokeStyle(ENEMY_STYLE.BORDER_WIDTH, ENEMY_STYLE.BORDER_COLOR);

    this.healthArc = scene.add.arc(0, 0, this.config.size, 0, 360, false, this.config.color);

    this.add([border, this.healthArc]);

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
    this.updateHealthVisual();
    if (this.health <= 0) {
      this.die();
    }
  }

  private updateHealthVisual() {
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    const angle = healthPercent * 360;
    this.healthArc.endAngle = angle;
  }

  private die() {
    this._isDead = true;
    this.scene.events.emit('enemy-killed', this.x, this.y, this.config.color, this.config.size);
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

  public getReward(): number {
    return this.reward;
  }

  public getLiveCost(): number {
    return this.config.liveCost;
  }

  public setPath(newPath: L.LatLng[]) {
    this.path = {
      roadId: -1, // Synthetic path
      waypoints: newPath,
      highway: 'unknown'
    };
    this.currentWaypointIndex = 0;
    // We assume the first point of the new path is the current position (or very close to it)
    // So we don't force positionLatLng to be path[0] to avoid snapping, 
    // but the movement logic will move towards path[1].
  }

  public getPosition(): L.LatLng {
    return this.positionLatLng;
  }
}

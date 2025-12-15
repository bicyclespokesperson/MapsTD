import Phaser from 'phaser';
import * as L from 'leaflet';
import { CoordinateConverter } from '../coordinateConverter';
import { RoadPath } from '../roadNetwork';
import { ElevationMap } from '../elevationMap';
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
  private elevationMap: ElevationMap | null;

  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    path: RoadPath,
    converter: CoordinateConverter,
    elevationMap: ElevationMap | null,
    onReachGoal: () => void,
    onKill: () => void
  ) {
    super(scene);
    this.type = type;
    this.config = ENEMY_CONFIGS[type];
    this.path = path;
    this.converter = converter;
    this.elevationMap = elevationMap;
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
    let baseMoveDist = (this.speed * delta) / 1000; // meters to move this frame
    
    // Adjust speed based on elevation slope if available
    // Look ahead a bit to determine slope? Or just use current segment slope.
    if (this.elevationMap && this.currentWaypointIndex < this.path.waypoints.length - 1) {
        const currentPos = this.positionLatLng;
        const nextWaypoint = this.path.waypoints[this.currentWaypointIndex + 1];
        
        // Calculate slope between current position and next waypoint
        const currentElev = this.elevationMap.getElevation(currentPos.lat, currentPos.lng);
        const nextElev = this.elevationMap.getElevation(nextWaypoint.lat, nextWaypoint.lng);
        
        const dist = currentPos.distanceTo(nextWaypoint);
        if (dist > 1) { // Avoid division by zero or tiny distances
            const slope = (nextElev - currentElev) / dist; // Rise over run
            
            // Slope > 0 means uphill (slower), < 0 means downhill (faster)
            // Factor: 1.0 = normal. 
            // 10% slope (0.1) -> 0.8x speed?
            // -10% slope (-0.1) -> 1.2x speed?
            
            // Let's say max effect is +/- 50% speed at 30% slope
            const slopeFactor = Math.max(-0.3, Math.min(0.3, slope)); // Clamp to +/- 30% slope
            const speedMultiplier = 1 - (slopeFactor * 1.5); // 0.3 * 1.5 = 0.45 reduction
            
            baseMoveDist *= Math.max(0.2, speedMultiplier); // Minimum 20% speed
        }
    }

    this.moveAlongPath(baseMoveDist);

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

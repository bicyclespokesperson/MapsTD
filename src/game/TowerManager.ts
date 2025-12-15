import Phaser from 'phaser';
import * as L from 'leaflet';
import { Tower } from './Tower';
import { HelicopterTower } from './HelicopterTower';
import { Bomb } from './Bomb';
import { Enemy } from './Enemy';
import { TowerType } from './TowerTypes';
import { CoordinateConverter } from '../coordinateConverter';
import { MapConfiguration } from '../mapConfiguration';
import { ElevationMap } from '../elevationMap';

// Union type for all tower types
export type AnyTower = Tower | HelicopterTower;

const MIN_TOWER_SPACING_PIXELS = 30;

export class TowerManager {
  private scene: Phaser.Scene;
  private converter: CoordinateConverter;
  private mapConfig: MapConfiguration;
  private elevationMap: ElevationMap | null;
  private towers: AnyTower[] = [];
  private selectedTower: AnyTower | null = null;

  constructor(
    scene: Phaser.Scene,
    converter: CoordinateConverter,
    mapConfig: MapConfiguration,
    elevationMap: ElevationMap | null
  ) {
    this.scene = scene;
    this.converter = converter;
    this.mapConfig = mapConfig;
    this.elevationMap = elevationMap;
  }

  public addTower(type: TowerType, geoPosition: L.LatLng, onBombExplode?: (bomb: Bomb) => void): AnyTower | Bomb | null {
    if (!this.isValidPlacement(geoPosition, type)) {
      return null;
    }

    const screenPos = this.converter.latLngToPixel(geoPosition);
    
    if (type === 'BOMB') {
        // Bomb is special - it's not added to self.towers list
        const bomb = new Bomb(
            this.scene, 
            screenPos.x, 
            screenPos.y, 
            geoPosition, 
            this.converter, 
            onBombExplode || (() => {})
        );
        return bomb;
    }

    let tower: AnyTower;
    
    if (type === 'HELICOPTER') {
      tower = new HelicopterTower(this.scene, screenPos.x, screenPos.y, geoPosition, this.converter, this.elevationMap);
    } else {
      tower = new Tower(this.scene, screenPos.x, screenPos.y, type, geoPosition, this.converter, this.elevationMap);
    }
    
    this.towers.push(tower);
    return tower;
  }

  public removeTower(tower: AnyTower): void {
    const index = this.towers.indexOf(tower);
    if (index !== -1) {
      this.towers.splice(index, 1);
      if (this.selectedTower === tower) {
        this.selectedTower = null;
        this.scene.events.emit('tower-deselected');
      }
      tower.destroy();
    }
  }

  public updateAll(delta: number, enemies: Enemy[], isWaveActive: boolean = true): void {
    for (const tower of this.towers) {
      // Helicopters manage their own position during patrol
      if (tower instanceof HelicopterTower) {
        tower.update(delta, enemies, isWaveActive);
      } else {
        const screenPos = this.converter.latLngToPixel(L.latLng(tower.geoPosition.lat, tower.geoPosition.lng));
        tower.setPosition(screenPos.x, screenPos.y);
        tower.update(delta, enemies);
      }
    }
  }

  public isValidPlacement(geoPosition: L.LatLng, towerType?: TowerType): boolean {
    // Helicopters can be placed anywhere within bounds (they fly!)
    if (towerType === 'HELICOPTER') {
      if (!this.mapConfig.containsPoint(geoPosition)) {
        return false;
      }
    } else if (towerType === 'BOMB') {
       // Bombs can be placed anywhere within bounds (including over towers!)
       if (!this.mapConfig.containsPoint(geoPosition)) {
        return false;
      }
      // Skip tower spacing check for bombs - they can blow up towers!
      return true;
    } else {
      // Normal towers must not be on road
      if (!this.mapConfig.isValidTowerPosition(geoPosition)) {
        return false;
      }
    }

    const screenPos = this.converter.latLngToPixel(geoPosition);
    for (const tower of this.towers) {
      const towerScreenPos = this.converter.latLngToPixel(L.latLng(tower.geoPosition.lat, tower.geoPosition.lng));
      const distance = Phaser.Math.Distance.Between(
        screenPos.x,
        screenPos.y,
        towerScreenPos.x,
        towerScreenPos.y
      );
      if (distance < MIN_TOWER_SPACING_PIXELS) {
        return false;
      }
    }

    return true;
  }

  public getTowerAt(screenPosition: { x: number; y: number }): AnyTower | null {
    for (const tower of this.towers) {
      // For helicopters, check against current screen position
      let towerScreenX: number;
      let towerScreenY: number;
      
      if (tower instanceof HelicopterTower) {
        towerScreenX = tower.x;
        towerScreenY = tower.y;
      } else {
        const screenPos = this.converter.latLngToPixel(L.latLng(tower.geoPosition.lat, tower.geoPosition.lng));
        towerScreenX = screenPos.x;
        towerScreenY = screenPos.y;
      }
      
      const distance = Phaser.Math.Distance.Between(
        screenPosition.x,
        screenPosition.y,
        towerScreenX,
        towerScreenY
      );
      if (distance < 15) {
        return tower;
      }
    }
    return null;
  }

  public selectTower(tower: AnyTower | null): void {
    if (this.selectedTower) {
      this.selectedTower.setSelected(false);
    }

    this.selectedTower = tower;

    if (this.selectedTower) {
      this.selectedTower.setSelected(true);
      this.scene.events.emit('tower-selected', this.selectedTower);
    } else {
      this.scene.events.emit('tower-deselected');
    }
  }

  public getSelectedTower(): AnyTower | null {
    return this.selectedTower;
  }

  public getAllTowers(): AnyTower[] {
    return this.towers;
  }

  public getTowerCount(): number {
    return this.towers.length;
  }

  public getTotalValue(): number {
    return this.towers.reduce((sum, tower) => sum + tower.getTotalInvested(), 0);
  }

  public clearAll(): void {
    if (this.selectedTower) {
      this.selectedTower = null;
      this.scene.events.emit('tower-deselected');
    }
    for (const tower of this.towers) {
      tower.destroy();
    }
    this.towers = [];
  }

  public removeTowersInRadius(center: L.LatLng, radiusMeters: number): void {
    // We need to iterate backwards since we might remove items
    for (let i = this.towers.length - 1; i >= 0; i--) {
        const tower = this.towers[i];

        // Helicopters are immune to bomb explosions (they fly above the blast!)
        if (tower instanceof HelicopterTower) {
            continue;
        }

        const dist = this.converter.distanceInMeters(center, L.latLng(tower.geoPosition));

        if (dist <= radiusMeters) {
            this.removeTower(tower);
            // Visual effect for tower destruction?
            // For now just removing it is fine (maybe add small explosion later)
        }
    }
  }

  public getMapConfig(): MapConfiguration {
    return this.mapConfig;
  }
}

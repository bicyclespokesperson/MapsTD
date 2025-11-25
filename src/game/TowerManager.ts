import Phaser from 'phaser';
import * as L from 'leaflet';
import { Tower } from './Tower';
import { Enemy } from './Enemy';
import { TowerType, TOWER_CONFIGS } from './TowerTypes';
import { CoordinateConverter } from '../coordinateConverter';
import { MapConfiguration } from '../mapConfiguration';

const MIN_TOWER_SPACING_PIXELS = 30;

export class TowerManager {
  private scene: Phaser.Scene;
  private converter: CoordinateConverter;
  private mapConfig: MapConfiguration;
  private towers: Tower[] = [];
  private selectedTower: Tower | null = null;

  constructor(
    scene: Phaser.Scene,
    converter: CoordinateConverter,
    mapConfig: MapConfiguration
  ) {
    this.scene = scene;
    this.converter = converter;
    this.mapConfig = mapConfig;
  }

  public addTower(type: TowerType, geoPosition: L.LatLng): Tower | null {
    if (!this.isValidPlacement(geoPosition)) {
      return null;
    }

    const screenPos = this.converter.latLngToPixel(geoPosition);
    const tower = new Tower(this.scene, screenPos.x, screenPos.y, type, geoPosition);
    this.towers.push(tower);

    return tower;
  }

  public removeTower(tower: Tower): void {
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

  public updateAll(delta: number, enemies: Enemy[]): void {
    for (const tower of this.towers) {
      const screenPos = this.converter.latLngToPixel(tower.geoPosition);
      tower.setPosition(screenPos.x, screenPos.y);
      tower.update(delta, enemies);
    }
  }

  public isValidPlacement(geoPosition: L.LatLng): boolean {
    if (!this.mapConfig.isValidTowerPosition(geoPosition)) {
      return false;
    }

    const screenPos = this.converter.latLngToPixel(geoPosition);
    for (const tower of this.towers) {
      const towerScreenPos = this.converter.latLngToPixel(tower.geoPosition);
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

  public getTowerAt(screenPosition: { x: number; y: number }): Tower | null {
    for (const tower of this.towers) {
      const screenPos = this.converter.latLngToPixel(tower.geoPosition);
      const distance = Phaser.Math.Distance.Between(
        screenPosition.x,
        screenPosition.y,
        screenPos.x,
        screenPos.y
      );
      if (distance < 15) {
        return tower;
      }
    }
    return null;
  }

  public selectTower(tower: Tower | null): void {
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

  public getSelectedTower(): Tower | null {
    return this.selectedTower;
  }

  public getAllTowers(): Tower[] {
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
}

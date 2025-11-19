import './style.css';
import * as L from 'leaflet';
import Phaser from 'phaser';
import { CoordinateConverter } from './coordinateConverter';
import { OverpassClient, RoadSegment } from './overpassClient';
import { RoadNetwork, BoundaryEntry } from './roadNetwork';

const DEFAULT_CENTER: L.LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 15;

class GameScene extends Phaser.Scene {
  private converter!: CoordinateConverter;
  private markerLatLng!: L.LatLng;
  private leafletMap!: L.Map;

  private roadGraphics!: Phaser.GameObjects.Graphics;
  private entryGraphics!: Phaser.GameObjects.Graphics;
  private defenseGraphics!: Phaser.GameObjects.Graphics;

  private roadNetwork: RoadNetwork | null = null;
  private entries: BoundaryEntry[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { converter: CoordinateConverter; markerLatLng: L.LatLng; leafletMap: L.Map }) {
    this.converter = data.converter;
    this.markerLatLng = data.markerLatLng;
    this.leafletMap = data.leafletMap;
  }

  create() {
    const instructionText = this.add.text(10, 10, 'Click "Load Roads" to fetch OSM data', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 },
    });

    this.roadGraphics = this.add.graphics();
    this.entryGraphics = this.add.graphics();
    this.defenseGraphics = this.add.graphics();

    (window as any).loadRoads = () => this.loadRoadsFromOSM();
  }

  update() {
    this.renderRoads();
    this.renderEntries();
    this.renderDefensePoint();
  }

  private async loadRoadsFromOSM() {
    console.log('Loading roads from OSM...');
    const bounds = this.leafletMap.getBounds();

    try {
      const client = new OverpassClient();
      const roads = await client.queryRoads(bounds);

      this.roadNetwork = new RoadNetwork(roads, bounds);
      this.entries = this.roadNetwork.findBoundaryEntries(this.markerLatLng);

      console.log(`Loaded ${roads.length} roads, ${this.entries.length} entry points`);
    } catch (error) {
      console.error('Failed to load roads:', error);
    }
  }

  private renderRoads() {
    this.roadGraphics.clear();

    if (!this.roadNetwork) return;

    const roads = this.roadNetwork.getAllRoads();

    for (const road of roads) {
      const points = road.points.map(p => this.converter.latLngToPixel(p));

      if (points.length < 2) continue;

      this.roadGraphics.lineStyle(3, 0x4444ff, 0.7);
      this.roadGraphics.beginPath();
      this.roadGraphics.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        this.roadGraphics.lineTo(points[i].x, points[i].y);
      }

      this.roadGraphics.strokePath();
    }
  }

  private renderEntries() {
    this.entryGraphics.clear();

    for (const entry of this.entries) {
      const pos = this.converter.latLngToPixel(entry.position);

      this.entryGraphics.fillStyle(0x00ff00, 0.8);
      this.entryGraphics.fillCircle(pos.x, pos.y, 8);

      this.entryGraphics.lineStyle(2, 0x00ff00, 1);
      this.entryGraphics.strokeCircle(pos.x, pos.y, 12);
    }
  }

  private renderDefensePoint() {
    this.defenseGraphics.clear();

    const pos = this.converter.latLngToPixel(this.markerLatLng);

    this.defenseGraphics.lineStyle(4, 0xff0000, 1);
    this.defenseGraphics.strokeCircle(pos.x, pos.y, 40);
    this.defenseGraphics.fillStyle(0xff0000, 0.3);
    this.defenseGraphics.fillCircle(pos.x, pos.y, 40);
  }
}

function initLeaflet(): L.Map {
  const map = L.map('map', {
    zoomControl: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const marker = L.marker(DEFAULT_CENTER).addTo(map);
  marker.bindPopup('<b>Defend This Point!</b>').openPopup();

  return map;
}

function initPhaser(): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game',
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    scene: [GameScene],
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
  };

  return new Phaser.Game(config);
}

const leafletMap = initLeaflet();
const converter = new CoordinateConverter(leafletMap);
const markerLatLng = L.latLng(DEFAULT_CENTER);

const phaserGame = initPhaser();

phaserGame.scene.start('GameScene', { converter, markerLatLng, leafletMap });

window.addEventListener('resize', () => {
  phaserGame.scale.resize(window.innerWidth, window.innerHeight);
});

console.log('Leaflet map:', leafletMap);
console.log('Phaser game:', phaserGame);
console.log('Coordinate converter:', converter);
console.log('Test: Pan/zoom the map - the red circle should track the marker position!');

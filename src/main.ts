import './style.css';
import * as L from 'leaflet';
import Phaser from 'phaser';
import { CoordinateConverter } from './coordinateConverter';

const DEFAULT_CENTER: L.LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 15;

class GameScene extends Phaser.Scene {
  private converter!: CoordinateConverter;
  private marker!: Phaser.GameObjects.Graphics;
  private markerLatLng!: L.LatLng;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { converter: CoordinateConverter; markerLatLng: L.LatLng }) {
    this.converter = data.converter;
    this.markerLatLng = data.markerLatLng;
  }

  create() {
    this.add.text(10, 10, 'Pan/zoom the map - red circle tracks the marker!', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 },
    });

    this.marker = this.add.graphics();
    this.updateMarkerPosition();
  }

  update() {
    this.updateMarkerPosition();
  }

  private updateMarkerPosition() {
    const pos = this.converter.latLngToPixel(this.markerLatLng);

    this.marker.clear();
    this.marker.lineStyle(4, 0xff0000, 1);
    this.marker.strokeCircle(pos.x, pos.y, 40);
    this.marker.fillStyle(0xff0000, 0.3);
    this.marker.fillCircle(pos.x, pos.y, 40);
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

phaserGame.scene.start('GameScene', { converter, markerLatLng });

window.addEventListener('resize', () => {
  phaserGame.scale.resize(window.innerWidth, window.innerHeight);
});

console.log('Leaflet map:', leafletMap);
console.log('Phaser game:', phaserGame);
console.log('Coordinate converter:', converter);
console.log('Test: Pan/zoom the map - the red circle should track the marker position!');

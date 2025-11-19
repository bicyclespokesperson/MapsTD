import './style.css';
import * as L from 'leaflet';
import Phaser from 'phaser';
import { CoordinateConverter } from './coordinateConverter';
import { OverpassClient } from './overpassClient';
import { RoadNetwork, BoundaryEntry } from './roadNetwork';
import { MapSelector, SelectionState } from './mapSelector';
import { MapConfiguration } from './mapConfiguration';

const DEFAULT_CENTER: L.LatLngExpression = [37.7749, -122.4194];
const DEFAULT_ZOOM = 15;

class GameScene extends Phaser.Scene {
  private converter!: CoordinateConverter;
  private leafletMap!: L.Map;

  private roadGraphics!: Phaser.GameObjects.Graphics;
  private entryGraphics!: Phaser.GameObjects.Graphics;

  private roadNetwork: RoadNetwork | null = null;
  private entries: BoundaryEntry[] = [];
  private mapConfig: MapConfiguration | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { converter: CoordinateConverter; leafletMap: L.Map }) {
    this.converter = data.converter;
    this.leafletMap = data.leafletMap;
  }

  create() {
    this.roadGraphics = this.add.graphics();
    this.entryGraphics = this.add.graphics();

    (window as any).gameScene = this;
  }

  update() {
    this.renderRoads();
    this.renderEntries();
  }

  setMapConfig(config: MapConfiguration) {
    this.mapConfig = config;
  }

  async loadRoadsFromOSM(bounds: L.LatLngBounds, defendPoint: L.LatLng) {
    console.log('Loading roads from OSM...');

    try {
      const client = new OverpassClient();
      const roads = await client.queryRoads(bounds);

      this.roadNetwork = new RoadNetwork(roads, bounds);
      this.entries = this.roadNetwork.findBoundaryEntries(defendPoint);

      console.log(`Loaded ${roads.length} roads, ${this.entries.length} entry points`);
    } catch (error) {
      console.error('Failed to load roads:', error);
      alert('Failed to load road data. Please try again.');
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
}

class UIManager {
  private selector: MapSelector;
  private gameScene: GameScene;

  private selectBoundsBtn: HTMLButtonElement;
  private placeDefendBtn: HTMLButtonElement;
  private loadRoadsBtn: HTMLButtonElement;
  private shareBtn: HTMLButtonElement;
  private loadConfigBtn: HTMLButtonElement;

  private modal: HTMLElement;
  private modalTitle: HTMLElement;
  private configInput: HTMLTextAreaElement;
  private modalConfirm: HTMLButtonElement;
  private modalCancel: HTMLButtonElement;
  private modalClose: HTMLElement;

  private currentState: SelectionState | null = null;

  constructor(selector: MapSelector, gameScene: GameScene) {
    this.selector = selector;
    this.gameScene = gameScene;

    this.selectBoundsBtn = document.getElementById('selectBoundsBtn') as HTMLButtonElement;
    this.placeDefendBtn = document.getElementById('placeDefendBtn') as HTMLButtonElement;
    this.loadRoadsBtn = document.getElementById('loadRoadsBtn') as HTMLButtonElement;
    this.shareBtn = document.getElementById('shareBtn') as HTMLButtonElement;
    this.loadConfigBtn = document.getElementById('loadConfigBtn') as HTMLButtonElement;

    this.modal = document.getElementById('modal') as HTMLElement;
    this.modalTitle = document.getElementById('modalTitle') as HTMLElement;
    this.configInput = document.getElementById('configInput') as HTMLTextAreaElement;
    this.modalConfirm = document.getElementById('modalConfirm') as HTMLButtonElement;
    this.modalCancel = document.getElementById('modalCancel') as HTMLButtonElement;
    this.modalClose = document.querySelector('.modal-close') as HTMLElement;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.selectBoundsBtn.addEventListener('click', () => {
      this.selector.startBoundsSelection();
    });

    this.placeDefendBtn.addEventListener('click', () => {
      this.selector.startDefendPointSelection();
    });

    this.loadRoadsBtn.addEventListener('click', async () => {
      if (this.currentState?.config) {
        await this.gameScene.loadRoadsFromOSM(
          this.currentState.config.bounds,
          this.currentState.config.defendPoint
        );
      }
    });

    this.shareBtn.addEventListener('click', () => {
      if (this.currentState?.config) {
        this.showShareModal(this.currentState.config);
      }
    });

    this.loadConfigBtn.addEventListener('click', () => {
      this.showLoadModal();
    });

    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalCancel.addEventListener('click', () => this.closeModal());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  onStateChange(state: SelectionState) {
    this.currentState = state;

    this.placeDefendBtn.disabled = !state.bounds || !!state.config;
    this.loadRoadsBtn.disabled = !state.config;
    this.shareBtn.disabled = !state.config;

    if (state.config) {
      this.gameScene.setMapConfig(state.config);
    }
  }

  private showShareModal(config: MapConfiguration) {
    this.modalTitle.textContent = 'Share Map Configuration';
    this.configInput.value = config.toString();
    this.configInput.readOnly = true;
    this.modalConfirm.textContent = 'Copy to Clipboard';
    this.modalConfirm.onclick = () => {
      navigator.clipboard.writeText(this.configInput.value);
      alert('Copied to clipboard!');
      this.closeModal();
    };
    this.modal.classList.add('active');
    this.configInput.select();
  }

  private showLoadModal() {
    this.modalTitle.textContent = 'Load Map Configuration';
    this.configInput.value = '';
    this.configInput.readOnly = false;
    this.configInput.placeholder = 'Paste map configuration JSON here...';
    this.modalConfirm.textContent = 'Load';
    this.modalConfirm.onclick = () => {
      try {
        const config = MapConfiguration.fromString(this.configInput.value);
        this.selector.loadConfiguration(config);
        this.closeModal();
      } catch (error) {
        alert(`Failed to load configuration: ${(error as Error).message}`);
      }
    };
    this.modal.classList.add('active');
  }

  private closeModal() {
    this.modal.classList.remove('active');
    this.configInput.value = '';
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
const phaserGame = initPhaser();

phaserGame.events.once('ready', () => {
  const gameScene = phaserGame.scene.getScene('GameScene') as GameScene;

  if (!gameScene) {
    console.error('Failed to get GameScene');
    return;
  }

  gameScene.scene.restart({ converter, leafletMap });

  const mapSelector = new MapSelector(leafletMap, (state) => {
    uiManager.onStateChange(state);
  });

  const uiManager = new UIManager(mapSelector, gameScene);

  console.log('Maps Tower Defense initialized');
  console.log('Select an area, place defend point, then load roads to begin!');
});

window.addEventListener('resize', () => {
  phaserGame.scale.resize(window.innerWidth, window.innerHeight);
});

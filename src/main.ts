import './style.css';
import * as L from 'leaflet';
import Phaser from 'phaser';
import { CoordinateConverter } from './coordinateConverter';
import { OverpassClient } from './overpassClient';
import { RoadNetwork, BoundaryEntry } from './roadNetwork';
import { MapSelector, SelectionState } from './mapSelector';
import { MapConfiguration } from './mapConfiguration';
import { WaveManager } from './game/WaveManager';
import { TowerManager } from './game/TowerManager';
import { Projectile } from './game/Projectile';
import { TowerShopPanel } from './ui/TowerShopPanel';
import { TowerInfoPanel } from './ui/TowerInfoPanel';
import { TowerType, TOWER_CONFIGS } from './game/TowerTypes';
import { Tower } from './game/Tower';
import { DeathEffect } from './game/DeathEffect';

import { GAME_CONFIG } from './config';

const DEFAULT_CENTER = GAME_CONFIG.MAP.DEFAULT_CENTER;
const DEFAULT_ZOOM = GAME_CONFIG.MAP.DEFAULT_ZOOM;

class GameScene extends Phaser.Scene {
  private converter!: CoordinateConverter;

  private roadGraphics!: Phaser.GameObjects.Graphics;
  private entryGraphics!: Phaser.GameObjects.Graphics;

  private roadNetwork: RoadNetwork | null = null;
  private entries: BoundaryEntry[] = [];
  private projectiles: Projectile[] = [];
  private deathEffects: DeathEffect[] = [];

  private placementMode: boolean = false;
  private placementType: TowerType | null = null;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private previewPosition: L.LatLng | null = null;
  private isValidPlacement: boolean = false;

  public waveManager!: WaveManager;
  public towerManager: TowerManager | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { converter: CoordinateConverter }) {
    this.converter = data.converter;
  }

  create() {
    this.roadGraphics = this.add.graphics();
    this.entryGraphics = this.add.graphics();
    this.previewGraphics = this.add.graphics();

    this.waveManager = new WaveManager(this, this.converter);

    this.events.on('projectile-created', (projectile: Projectile) => {
      this.projectiles.push(projectile);
    });

    this.events.on('enemy-killed', (x: number, y: number, color: number, size: number) => {
      this.deathEffects.push(new DeathEffect(this, x, y, color, size));
    });

    (window as any).gameScene = this;
  }

  update(time: number, delta: number) {
    this.renderRoads();
    this.renderEntries();
    this.renderPlacementPreview();

    if (this.waveManager) {
      this.waveManager.update(time, delta);

      // Skip tower/projectile updates if paused
      if (this.waveManager.isPaused()) return;

      const adjustedDelta = delta * this.waveManager.getSpeed();

      if (this.towerManager) {
        this.towerManager.updateAll(adjustedDelta, this.waveManager.getActiveEnemies());
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const projectile = this.projectiles[i];
        if (!projectile.active) {
          this.projectiles.splice(i, 1);
        } else {
          projectile.update(adjustedDelta);
        }
      }

      for (let i = this.deathEffects.length - 1; i >= 0; i--) {
        if (!this.deathEffects[i].update(adjustedDelta)) {
          this.deathEffects.splice(i, 1);
        }
      }
    }
  }



  async loadRoadsFromOSM(bounds: L.LatLngBounds, defendPoint: L.LatLng | null, onProgress?: (message: string) => void) {
    console.log('Loading roads from OSM...');

    try {
      if (onProgress) onProgress('Querying OpenStreetMap data...');
      const client = new OverpassClient();
      const roads = await client.queryRoads(bounds);

      if (onProgress) onProgress('Building road network...');
      this.roadNetwork = new RoadNetwork(roads, bounds);

      // Only calculate entries if we have a real defend point
      if (defendPoint) {
        if (onProgress) onProgress('Finding entry points...');
        this.entries = this.roadNetwork.findBoundaryEntries(defendPoint);

        if (onProgress) onProgress('Initializing game...');
        this.waveManager.setEntries(this.entries);
        console.log(`Loaded ${roads.length} roads, ${this.entries.length} entry points`);
      } else {
        console.log(`Loaded ${roads.length} roads`);
      }

      return true;
    } catch (error) {
      console.error('Failed to load roads:', error);
      alert('Failed to load road data. Please try again.');
      return false;
    }
  }

  isPointOnRoad(point: L.LatLng): boolean {
    if (!this.roadNetwork) return false;
    return this.roadNetwork.isPointOnRoad(point);
  }

  private renderRoads() {
    this.roadGraphics.clear();

    if (!this.roadNetwork) return;

    const roads = this.roadNetwork.getAllRoads();

    for (const road of roads) {
      const points = road.points.map(p => this.converter.latLngToPixel(p));

      if (points.length < 2) continue;

      this.roadGraphics.lineStyle(GAME_CONFIG.ROADS.WIDTH, GAME_CONFIG.ROADS.COLOR, GAME_CONFIG.ROADS.OPACITY);
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

  recalculateEntries(defendPoint: L.LatLng) {
    if (!this.roadNetwork) return;

    console.log('Recalculating entries for new defend point:', defendPoint);
    this.entries = this.roadNetwork.findBoundaryEntries(defendPoint);
    this.waveManager.setEntries(this.entries);
    this.renderEntries();
  }

  setMapConfiguration(config: MapConfiguration) {
    if (!this.towerManager) {
      this.towerManager = new TowerManager(this, this.converter, config);
      console.log('TowerManager initialized');
    }
  }

  enterPlacementMode(towerType: TowerType) {
    this.placementMode = true;
    this.placementType = towerType;
    console.log('Entering placement mode:', towerType);
  }

  exitPlacementMode() {
    this.placementMode = false;
    this.placementType = null;
    this.previewPosition = null;
    this.previewGraphics.clear();
    console.log('Exiting placement mode');
  }

  updatePlacementPreview(latLng: L.LatLng) {
    if (!this.placementMode || !this.placementType || !this.towerManager) return;

    this.previewPosition = latLng;
    this.isValidPlacement = this.towerManager.isValidPlacement(latLng);
  }

  private renderPlacementPreview() {
    this.previewGraphics.clear();

    if (!this.placementMode || !this.placementType || !this.previewPosition) return;

    const config = TOWER_CONFIGS[this.placementType];
    const screenPos = this.converter.latLngToPixel(this.previewPosition);
    const color = this.isValidPlacement ? 0x00ff00 : 0xff0000;
    const alpha = this.isValidPlacement ? 0.5 : 0.3;
    const rangeInPixels = config.baseStats.range * this.converter.pixelsPerMeter();

    this.previewGraphics.lineStyle(2, color, 0.6);
    this.previewGraphics.strokeCircle(screenPos.x, screenPos.y, rangeInPixels);

    this.previewGraphics.fillStyle(config.color, alpha);
    this.previewGraphics.fillCircle(screenPos.x, screenPos.y, 10);

    this.previewGraphics.lineStyle(2, 0xffffff, alpha);
    this.previewGraphics.strokeCircle(screenPos.x, screenPos.y, 10);
  }

  attemptPlaceTower(): boolean {
    if (!this.placementMode || !this.placementType || !this.previewPosition || !this.towerManager) {
      return false;
    }

    if (!this.isValidPlacement) {
      console.log('Invalid placement location');
      return false;
    }

    const config = TOWER_CONFIGS[this.placementType];
    const currentMoney = this.waveManager.getStats().money;

    if (currentMoney < config.baseCost) {
      console.log('Not enough money');
      return false;
    }

    const tower = this.towerManager.addTower(this.placementType, this.previewPosition);
    if (tower) {
      this.waveManager.spendMoney(config.baseCost);
      console.log('Tower placed!');
      this.exitPlacementMode();
      return true;
    }

    return false;
  }

  handleMapClick(latLng: L.LatLng) {
    if (!this.towerManager || this.placementMode) return;

    const screenPos = this.converter.latLngToPixel(latLng);
    const tower = this.towerManager.getTowerAt(screenPos);

    if (tower) {
      this.towerManager.selectTower(tower);
    } else {
      this.towerManager.selectTower(null);
    }
  }

  reset() {
    this.exitPlacementMode();

    if (this.towerManager) {
      this.towerManager.clearAll();
      this.towerManager = null;
    }

    this.waveManager.reset();

    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles = [];

    for (const effect of this.deathEffects) {
      effect.destroy();
    }
    this.deathEffects = [];

    this.roadNetwork = null;
    this.entries = [];

    this.roadGraphics.clear();
    this.entryGraphics.clear();
    this.previewGraphics.clear();
  }

  restartGame() {
    this.exitPlacementMode();

    if (this.towerManager) {
      this.towerManager.clearAll();
    }

    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles = [];

    for (const effect of this.deathEffects) {
      effect.destroy();
    }
    this.deathEffects = [];

    this.waveManager.reset();
    this.waveManager.setEntries(this.entries);
  }
}

class UIManager {
  private selector: MapSelector;
  private gameScene: GameScene;
  private leafletMap: L.Map;

  private selectBoundsBtn: HTMLButtonElement;
  private placeDefendBtn: HTMLButtonElement;
  private shareBtn: HTMLButtonElement;
  private loadConfigBtn: HTMLButtonElement;
  private startWaveBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private gameControls: HTMLElement;

  private modal: HTMLElement;
  private modalTitle: HTMLElement;
  private configInput: HTMLTextAreaElement;
  private modalConfirm: HTMLButtonElement;
  private modalCancel: HTMLButtonElement;
  private modalClose: HTMLElement;

  private livesDisplay: HTMLElement;
  private moneyDisplay: HTMLElement;
  private waveDisplay: HTMLElement;

  private wavePreview: HTMLElement;
  private wavePreviewContent: HTMLElement;

  private currentState: SelectionState | null = null;
  private towerShopPanel: TowerShopPanel;
  private towerInfoPanel: TowerInfoPanel;

  constructor(selector: MapSelector, gameScene: GameScene, leafletMap: L.Map) {
    this.selector = selector;
    this.gameScene = gameScene;
    this.leafletMap = leafletMap;

    this.selectBoundsBtn = document.getElementById('selectBoundsBtn') as HTMLButtonElement;
    this.placeDefendBtn = document.getElementById('placeDefendBtn') as HTMLButtonElement;
    this.shareBtn = document.getElementById('shareBtn') as HTMLButtonElement;
    this.loadConfigBtn = document.getElementById('loadConfigBtn') as HTMLButtonElement;
    this.startWaveBtn = document.getElementById('startWaveBtn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    this.speedBtn = document.getElementById('speedBtn') as HTMLButtonElement;
    this.gameControls = document.getElementById('game-controls') as HTMLElement;

    this.modal = document.getElementById('modal') as HTMLElement;
    this.modalTitle = document.getElementById('modalTitle') as HTMLElement;
    this.configInput = document.getElementById('configInput') as HTMLTextAreaElement;
    this.modalConfirm = document.getElementById('modalConfirm') as HTMLButtonElement;
    this.modalCancel = document.getElementById('modalCancel') as HTMLButtonElement;
    this.modalClose = document.querySelector('.modal-close') as HTMLElement;
    
    this.livesDisplay = document.getElementById('livesDisplay') as HTMLElement;
    this.moneyDisplay = document.getElementById('moneyDisplay') as HTMLElement;
    this.waveDisplay = document.getElementById('waveDisplay') as HTMLElement;

    this.wavePreview = document.getElementById('wave-preview') as HTMLElement;
    this.wavePreviewContent = document.getElementById('wave-preview-content') as HTMLElement;

    this.towerShopPanel = new TowerShopPanel((type) => {
      if (type) {
        this.gameScene.enterPlacementMode(type);
      } else {
        this.gameScene.exitPlacementMode();
      }
    });

    this.towerInfoPanel = new TowerInfoPanel(
      (tower) => this.handleUpgradeTower(tower),
      (tower) => this.handleSellTower(tower)
    );

    this.setupEventListeners();
    this.setupGameListeners();
    this.setupMapListeners();
    this.setupTowerListeners();
  }

  private setupEventListeners() {
    this.selectBoundsBtn.addEventListener('click', () => {
      if (this.selector.currentMode === 'drawing-bounds') {
        this.selector.cancelSelection();
      } else {
        this.clearGame();
        this.selector.startBoundsSelection();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.selector.currentMode !== 'none') {
          this.selector.cancelSelection();
        }
      }
    });

    this.placeDefendBtn.addEventListener('click', () => {
      if (this.selector.currentMode === 'placing-defend') {
        this.selector.cancelSelection();
      } else {
        this.selector.startDefendPointSelection();
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
    
    this.startWaveBtn.addEventListener('click', () => {
        this.gameScene.waveManager.startNextWave();
    });

    this.pauseBtn.addEventListener('click', () => {
      const isPaused = this.gameScene.waveManager.togglePause();
      this.pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      this.pauseBtn.classList.toggle('paused', isPaused);
    });

    this.speedBtn.addEventListener('click', () => {
      const SPEED_VALUES = [0.5, 1, 2];
      const currentSpeed = this.gameScene.waveManager.getSpeed();
      const currentIndex = SPEED_VALUES.indexOf(currentSpeed);
      const nextIndex = (currentIndex + 1) % SPEED_VALUES.length;
      const newSpeed = SPEED_VALUES[nextIndex];

      this.gameScene.waveManager.setSpeed(newSpeed);
      this.speedBtn.textContent = `${newSpeed}x`;
      this.speedBtn.classList.toggle('fast', newSpeed === 2); // 'fast' class for 2x
      this.speedBtn.classList.toggle('slow', newSpeed === 0.5); // 'slow' class for 0.5x (add this CSS class if needed)
    });

    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalCancel.addEventListener('click', () => this.closeModal());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }
  
  private setupGameListeners() {
    window.addEventListener('game-stats-update', (e: any) => {
      const { lives, money, wave } = e.detail;
      this.livesDisplay.textContent = lives.toString();
      this.moneyDisplay.textContent = money.toString();
      this.waveDisplay.textContent = wave.toString();
      this.towerShopPanel.updateMoney(money);
      this.updateWavePreview();

      // Disable Select Area once a wave has started
      if (wave > 0) {
        this.selectBoundsBtn.disabled = true;
      }
    });

    window.addEventListener('game-over', (e: any) => {
      const { wave, kills, moneyEarned } = e.detail;
      this.showGameOver(wave, kills, moneyEarned);
      this.resetGameControls();
    });
  }

  private resetGameControls() {
    this.pauseBtn.textContent = 'Pause';
    this.pauseBtn.classList.remove('paused');
    this.speedBtn.textContent = '0.5x';
    this.speedBtn.classList.remove('fast');
    this.speedBtn.classList.add('slow'); // Assuming 'slow' class will be added for 0.5x
    this.gameScene.waveManager.setSpeed(0.5);
  }

  private clearGame() {
    this.gameScene.reset();
    this.selector.clearSelection();
    this.resetGameControls();
    this.towerInfoPanel.hide();
    this.towerShopPanel.hide();
    this.wavePreview.classList.add('hidden');
    this.gameControls.classList.add('hidden');
    this.selectBoundsBtn.disabled = false;
  }

  private showGameOver(wave: number, kills: number, moneyEarned: number) {
    const overlay = document.getElementById('game-over-overlay');
    const waveEl = document.getElementById('game-over-wave');
    const killsEl = document.getElementById('game-over-kills');
    const moneyEl = document.getElementById('game-over-money');
    const playAgainBtn = document.getElementById('play-again-btn');

    if (waveEl) waveEl.textContent = wave.toString();
    if (killsEl) killsEl.textContent = kills.toString();
    if (moneyEl) moneyEl.textContent = `$${moneyEarned}`;

    if (overlay) overlay.classList.remove('hidden');

    if (playAgainBtn) {
      playAgainBtn.onclick = () => {
        if (overlay) overlay.classList.add('hidden');
        this.clearGame();
      };
    }
  }

  private updateWavePreview() {
    if (!this.wavePreviewContent) return;

    const preview = this.gameScene.waveManager.getNextWavePreview();

    this.wavePreviewContent.innerHTML = preview.map(item => `
      <div class="wave-preview-item">
        <div class="enemy-icon" style="background-color: ${item.color}"></div>
        <span class="enemy-count">${item.count}</span>
      </div>
    `).join('');
  }

  private setupMapListeners() {
    this.leafletMap.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (this.selector.currentMode === 'none') {
        this.gameScene.updatePlacementPreview(e.latlng);
      }
    });

    this.leafletMap.on('click', (e: L.LeafletMouseEvent) => {
      if (this.selector.currentMode === 'none') {
        if (this.gameScene.attemptPlaceTower()) {
          this.towerShopPanel.deselectTower();
        } else {
          this.gameScene.handleMapClick(e.latlng);
        }
      }
    });

    this.leafletMap.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (this.selector.currentMode === 'none') {
        e.originalEvent.preventDefault();
        this.gameScene.exitPlacementMode();
        this.towerShopPanel.deselectTower();
      }
    });
  }

  private setupTowerListeners() {
    this.gameScene.events.on('tower-selected', (tower: Tower) => {
      this.towerInfoPanel.showTower(tower);
    });

    this.gameScene.events.on('tower-deselected', () => {
      this.towerInfoPanel.hide();
    });
  }

  private handleUpgradeTower(tower: Tower): void {
    const upgradeCost = tower.getUpgradeCost();
    if (upgradeCost === null) {
      console.log('Tower already at max level');
      return;
    }

    const currentMoney = this.gameScene.waveManager.getStats().money;
    if (currentMoney < upgradeCost) {
      console.log('Not enough money to upgrade');
      return;
    }

    if (tower.upgrade()) {
      this.gameScene.waveManager.spendMoney(upgradeCost);
      this.towerInfoPanel.updateDisplay();
      console.log('Tower upgraded!');
    }
  }

  private handleSellTower(tower: Tower): void {
    const sellValue = tower.getSellValue();

    if (this.gameScene.towerManager) {
      this.gameScene.towerManager.removeTower(tower);
      this.gameScene.waveManager.addMoney(sellValue);

      this.towerInfoPanel.hide();
      console.log(`Tower sold for $${sellValue}`);
    }
  }

  onStateChange(state: SelectionState) {
    this.currentState = state;

    // Enable place defend button only if we have bounds but no config yet
    // Once defend point is placed (config exists), lock the button
    this.placeDefendBtn.disabled = !state.bounds || state.config !== null;

    // Enable share/start only if we have a full config
    this.shareBtn.disabled = !state.config;
    this.startWaveBtn.disabled = !state.config;

    if (state.defendPoint) {
      this.gameScene.recalculateEntries(state.defendPoint);
    }

    if (state.config) {
      this.gameScene.setMapConfiguration(state.config);
      this.towerShopPanel.show();
      this.wavePreview.classList.remove('hidden');
      this.gameControls.classList.remove('hidden');
      this.updateWavePreview();
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

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  });

  osmLayer.addTo(map);

  const mapBtn = document.querySelector('.layer-btn[data-layer="map"]') as HTMLButtonElement;
  const satBtn = document.querySelector('.layer-btn[data-layer="satellite"]') as HTMLButtonElement;

  mapBtn?.addEventListener('click', () => {
    if (!mapBtn.classList.contains('active')) {
      map.removeLayer(satelliteLayer);
      osmLayer.addTo(map);
      mapBtn.classList.add('active');
      satBtn.classList.remove('active');
    }
  });

  satBtn?.addEventListener('click', () => {
    if (!satBtn.classList.contains('active')) {
      map.removeLayer(osmLayer);
      satelliteLayer.addTo(map);
      satBtn.classList.add('active');
      mapBtn.classList.remove('active');
    }
  });

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

  const mapSelector = new MapSelector(
    leafletMap, 
    (state) => {
      uiManager.onStateChange(state);
    },
    // onBoundsSelected: Auto-load roads
    async (bounds) => {
      const loadingOverlay = document.getElementById('loading-overlay');
      const loadingText = document.getElementById('loading-text');
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      try {
        // Pass null for defendPoint - we'll calculate entries when user places defend point
        await gameScene.loadRoadsFromOSM(bounds, null, (message) => {
          if (loadingText) loadingText.textContent = message;
        });
      } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (loadingText) loadingText.textContent = 'Loading Map Data...';
      }
    },
    // validateDefendPoint: Check if point is on road
    (point) => {
      return gameScene.isPointOnRoad(point);
    }
  );

  const uiManager = new UIManager(mapSelector, gameScene, leafletMap);

  console.log('Maps Tower Defense initialized');
  console.log('Select an area, place defend point, then load roads to begin!');
});

window.addEventListener('resize', () => {
  phaserGame.scale.resize(window.innerWidth, window.innerHeight);
});

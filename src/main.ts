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
import { TowerType, TOWER_CONFIGS, HelicopterConfig, BombConfig } from './game/TowerTypes';
import { Tower } from './game/Tower';
import { Bomb } from './game/Bomb';
import { Crater } from './game/Crater';
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
  private bombs: Bomb[] = [];
  private craters: Crater[] = [];

  private placementMode: boolean = false;
  private placementType: TowerType | null = null;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private previewPosition: L.LatLng | null = null;
  private isValidPlacement: boolean = false;
  private showRoads: boolean = false;

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

    this.events.on('crater-created', (geoPosition: L.LatLng, radiusMeters: number) => {
      this.craters.push(new Crater(this, geoPosition, radiusMeters, this.converter));
    });

    (window as any).gameScene = this;
  }

  update(time: number, delta: number) {
    this.renderRoads();
    this.renderEntries();
    this.renderPlacementPreview();

    if (this.waveManager) {
      this.waveManager.update(time, delta);

      // Calculate adjusted delta (0 if paused)
      const adjustedDelta = this.waveManager.isPaused() ? 0 : delta * this.waveManager.getSpeed();

      if (this.towerManager) {
        const isWaveActive = this.waveManager.getActiveEnemies().length > 0;
        this.towerManager.updateAll(adjustedDelta, this.waveManager.getActiveEnemies(), isWaveActive);
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

      const isWaveActive = this.waveManager.isWaveInProgress();
      for (let i = this.bombs.length - 1; i >= 0; i--) {
        const bomb = this.bombs[i];
        if (!bomb.active) {
            this.bombs.splice(i, 1);
        } else {
            // Bombs update position based on raw delta (panning), but timer based on adjusted delta
            // Wait, timer should be based on adjustedDelta to respect pause/speed?
            // User said "wait until round starts".
            // Let's pass adjustedDelta for timer. Panning should happen regardless of pause.
            // Oh right, update(delta) is usually adjustedDelta in my code.
            // But for panning I need real time if map moves while paused.
            // However, map panning usually doesn't happen continuously in update loop, it happens on events.
            // But setPosition needs to run in update loop to stick to map.
            // So I should call bomb.update every frame.
            bomb.update(adjustedDelta, isWaveActive);
        }
      }

      for (const crater of this.craters) {
        crater.update();
      }
    }
  }



  async loadRoadsFromOSM(bounds: L.LatLngBounds, config: MapConfiguration | null, onProgress?: (message: string) => void, area?: L.LatLng[]) {
    console.log('Loading roads from OSM...');

    try {
      if (onProgress) onProgress('Querying OpenStreetMap data...');
      const client = new OverpassClient();
      const roads = await client.queryRoads(bounds);

      if (onProgress) onProgress('Building road network...');
      // Pass area to filter roads to only those within the selected area
      // Use config.area if available, otherwise use the explicit area parameter
      const filterArea = config?.area ?? area;
      this.roadNetwork = new RoadNetwork(roads, bounds, filterArea);

      // Only calculate entries if we have a full config with area
      if (config) {
        if (onProgress) onProgress('Finding entry points...');
        this.entries = this.roadNetwork.findBoundaryEntries(config.baseLocation, config.area);

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

    const color = this.showRoads ? GAME_CONFIG.ROADS.COLOR_VISIBLE : GAME_CONFIG.ROADS.COLOR_HIDDEN;
    const opacity = this.showRoads ? GAME_CONFIG.ROADS.OPACITY_VISIBLE : GAME_CONFIG.ROADS.OPACITY_HIDDEN;

    // Roads are already clipped during network construction
    for (const road of roads) {
      if (road.points.length < 2) continue;

      this.roadGraphics.lineStyle(GAME_CONFIG.ROADS.WIDTH, color, opacity);

      const points = road.points.map(p => this.converter.latLngToPixel(p));
      this.roadGraphics.beginPath();
      this.roadGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.roadGraphics.lineTo(points[i].x, points[i].y);
      }
      this.roadGraphics.strokePath();
    }
  }

  setShowRoads(visible: boolean) {
    this.showRoads = visible;
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

  recalculateEntries(config: MapConfiguration) {
    if (!this.roadNetwork) return;

    console.log('Recalculating entries for base location:', config.baseLocation);
    this.entries = this.roadNetwork.findBoundaryEntries(config.baseLocation, config.area);
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
    this.previewPosition = latLng;
    this.isValidPlacement = this.towerManager.isValidPlacement(latLng, this.placementType);

    if (this.isValidPlacement && this.placementType === 'BOMB' && this.roadNetwork && this.towerManager) {
        const config = TOWER_CONFIGS.BOMB as BombConfig;
        const baseLocation = this.towerManager.getMapConfig().baseLocation;
        // Check connectivity
        const safe = this.roadNetwork.simulateNodeRemoval(
            latLng, 
            config.baseStats.range, 
            baseLocation, 
            this.entries
        );
        if (!safe) {
            this.isValidPlacement = false;
        }
    }
  }

  private renderPlacementPreview() {
    this.previewGraphics.clear();

    if (!this.placementMode || !this.placementType || !this.previewPosition) return;

    const config = TOWER_CONFIGS[this.placementType];
    const screenPos = this.converter.latLngToPixel(this.previewPosition);
    const color = this.isValidPlacement ? 0x00ff00 : 0xff0000;
    const alpha = this.isValidPlacement ? 0.5 : 0.3;
    const rangeInPixels = config.baseStats.range * this.converter.pixelsPerMeter();

    // For helicopters, draw total domain circle (movement + weapon range)
    if (this.placementType === 'HELICOPTER') {
      const heliConfig = config as HelicopterConfig;
      const totalDomainInPixels = (heliConfig.domainRadius + config.baseStats.range) * this.converter.pixelsPerMeter();

      // Total domain circle (outer)
      this.previewGraphics.lineStyle(2, 0xffffff, 0.3);
      this.previewGraphics.strokeCircle(screenPos.x, screenPos.y, totalDomainInPixels);
    }

    // Range circle
    this.previewGraphics.lineStyle(2, color, 0.6);
    this.previewGraphics.strokeCircle(screenPos.x, screenPos.y, rangeInPixels);

    // Tower indicator
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

    const onExplode = (bomb: Bomb) => this.handleBombExplosion(bomb);

    const result = this.towerManager.addTower(this.placementType, this.previewPosition, onExplode);
    if (result) {
      if (result instanceof Bomb) {
          this.bombs.push(result);
      }
      this.waveManager.spendMoney(config.baseCost);
      console.log('Tower/Bomb placed!');
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

    for (const bomb of this.bombs) {
      bomb.destroy();
    }
    this.bombs = [];

    for (const crater of this.craters) {
      crater.destroy();
    }
    this.craters = [];

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

  private handleBombExplosion(bomb: Bomb) {
    if (!this.roadNetwork || !this.towerManager) return;
    
    const config = TOWER_CONFIGS.BOMB as BombConfig;
    const radiusMeters = config.baseStats.range;
    const bombPos = L.latLng(bomb.geoPosition);
    
    // 1. Remove roads
    this.roadNetwork.removeRoadsInRadius(bombPos, radiusMeters);
    this.renderRoads();
    
    // 2. Damage enemies (using explicit loop to not miss any)
    const enemies = this.waveManager.getActiveEnemies();
    for (const enemy of enemies) {
        if (enemy.isDead()) continue;
        const dist = this.converter.distanceInMeters(bombPos, enemy.getPosition());
        if (dist <= radiusMeters) {
            enemy.takeDamage(config.baseStats.damage);
        }
    }
    
    // 3. Destroy towers
    this.towerManager.removeTowersInRadius(bombPos, radiusMeters);
    
    // 4. Recalculate paths
    const mapConfig = this.towerManager.getMapConfig();
    this.recalculateEntries(mapConfig); // This updates entries for new spawns
    this.waveManager.recalculatePaths(this.roadNetwork, mapConfig.baseLocation); // This updates active enemies
  }
}

class UIManager {
  private selector: MapSelector;
  private gameScene: GameScene;
  private leafletMap: L.Map;

  private selectBoundsBtn: HTMLButtonElement;
  private selectCustomBtn: HTMLButtonElement;
  private selectionHelp: HTMLElement;
  private placeBaseBtn: HTMLButtonElement;
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

  private roadToggle: HTMLElement;
  private showRoadsCheckbox: HTMLInputElement;

  constructor(selector: MapSelector, gameScene: GameScene, leafletMap: L.Map) {
    this.selector = selector;
    this.gameScene = gameScene;
    this.leafletMap = leafletMap;

    this.selectBoundsBtn = document.getElementById('selectBoundsBtn') as HTMLButtonElement;
    this.selectCustomBtn = document.getElementById('selectCustomBtn') as HTMLButtonElement;
    this.selectionHelp = document.getElementById('selection-help') as HTMLElement;
    this.placeBaseBtn = document.getElementById('placeBaseBtn') as HTMLButtonElement;
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

    this.roadToggle = document.getElementById('road-toggle') as HTMLElement;
    this.showRoadsCheckbox = document.getElementById('showRoadsCheckbox') as HTMLInputElement;

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
        this.updateStepHelp(1, 'Drag to draw rectangle');
      }
    });

    this.selectCustomBtn.addEventListener('click', () => {
      if (this.selector.currentMode === 'clicking-corners') {
        this.selector.cancelSelection();
      } else {
        this.clearGame();
        this.selector.startCustomSelection();
        this.updateStepHelp(1, 'Click corner 1 of 4');
      }
    });

    this.showRoadsCheckbox.addEventListener('change', () => {
      this.gameScene.setShowRoads(this.showRoadsCheckbox.checked);
    });

    let lastKey = '';
    let lastKeyTime = 0;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.selector.currentMode !== 'none') {
          this.selector.cancelSelection();
        } else if (this.towerShopPanel.getSelectedType()) {
          this.towerShopPanel.deselectTower();
        }
      }

      // Press 'M' to add 10000 money for testing
      if (e.key === 'm' || e.key === 'M') {
        this.gameScene.waveManager.addMoney(10000);
        console.log('Added 10000 money for testing');
      }

      // Press 'L1' through 'L9' to load test maps for quick testing
      // Only works when no game is in progress (wave 0)
      const now = Date.now();
      if ((e.key === 'l' || e.key === 'L') && now - lastKeyTime < 1000) {
        // Reset for next sequence
        lastKey = '';
        lastKeyTime = 0;
      } else if (e.key === 'l' || e.key === 'L') {
        lastKey = 'l';
        lastKeyTime = now;
      } else if (lastKey === 'l' && e.key >= '1' && e.key <= '9' && now - lastKeyTime < 1000) {
        const slotNumber = parseInt(e.key);
        const currentWave = this.gameScene.waveManager.getStats().wave;

        if (currentWave > 0) {
          console.log('Cannot load test map - game already in progress');
          lastKey = '';
          return;
        }

        // QA test map configurations
        const testConfigs = [
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}',
          '{"version":"1.0.0","bounds":{"north":37.81181790866923,"south":37.79261562380038,"east":-122.4483346939087,"west":-122.48781681060792},"baseLocation":{"lat":37.80106388711812,"lng":-122.47348308563234},"metadata":{"createdAt":"2025-12-11T07:09:56.855Z"}}',
          '{"version":"1.0.0","bounds":{"north":45.5813736524941,"south":45.560964773555256,"east":-122.91413784027101,"west":-122.9522466659546},"baseLocation":{"lat":45.56986263404587,"lng":-122.94156074523927},"metadata":{"createdAt":"2025-12-11T07:12:34.706Z"}}',
          '{"version":"2.0.0","bounds":{"north":40.80003879242711,"south":40.765185905584424,"east":-73.94983291625978,"west":-73.98098945617677},"baseLocation":{"lat":40.778713077964106,"lng":-73.96837234497072},"metadata":{"createdAt":"2025-12-11T19:34:11.518Z"},"customArea":{"corners":[{"lat":40.80003879242711,"lng":-73.95790100097658},{"lat":40.79665834331317,"lng":-73.94983291625978},{"lat":40.765185905584424,"lng":-73.97309303283693},{"lat":40.768177728961916,"lng":-73.98098945617677}]}}',
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}',
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}',
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}',
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}',
          '{"version":"1.0.0","bounds":{"north":37.83378257085255,"south":37.805664337530864,"east":-122.35688209533693,"west":-122.38331794738771},"baseLocation":{"lat":37.82604634846577,"lng":-122.37061500549318},"metadata":{"createdAt":"2025-12-10T19:19:02.712Z"}}'
        ];

        const testConfig = testConfigs[slotNumber - 1];

        (async () => {
          try {
            const config = MapConfiguration.fromString(testConfig);
            this.clearGame();
            this.selector.loadConfiguration(config);

            // Load roads for the configuration
            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingText = document.getElementById('loading-text');
            if (loadingOverlay) loadingOverlay.classList.remove('hidden');

            try {
              await this.gameScene.loadRoadsFromOSM(config.bounds, config, (message) => {
                if (loadingText) loadingText.textContent = message;
              });

              // Only give QA money for slot 1
              if (slotNumber === 1) {
                const qaBonus = GAME_CONFIG.ECONOMY.QA_STARTING_MONEY - GAME_CONFIG.ECONOMY.STARTING_MONEY;
                this.gameScene.waveManager.addMoney(qaBonus);
                console.log(`Test map ${slotNumber} loaded with QA money:`, GAME_CONFIG.ECONOMY.QA_STARTING_MONEY);
              } else {
                console.log(`Test map ${slotNumber} loaded with normal starting money:`, GAME_CONFIG.ECONOMY.STARTING_MONEY);
              }
            } finally {
              if (loadingOverlay) loadingOverlay.classList.add('hidden');
              if (loadingText) loadingText.textContent = 'Loading Map Data...';
            }
          } catch (error) {
            console.error('Failed to load test map:', error);
          }
        })();

        lastKey = '';
        lastKeyTime = 0;
      }
    });

    this.placeBaseBtn.addEventListener('click', () => {
      if (this.selector.currentMode === 'placing-base') {
        this.selector.cancelSelection();
      } else {
        this.selector.startBaseSelection();
      }
    });

    this.shareBtn.addEventListener('click', async () => {
      if (this.currentState?.config) {
        try {
          await navigator.clipboard.writeText(this.currentState.config.toString());
          // Show brief success notification
          const originalText = this.shareBtn.textContent;
          this.shareBtn.textContent = 'Copied!';
          this.shareBtn.disabled = true;
          setTimeout(() => {
            this.shareBtn.textContent = originalText;
            this.shareBtn.disabled = false;
          }, 2000);
        } catch (error) {
          console.error('Failed to copy to clipboard:', error);
          alert('Failed to copy to clipboard. Please try again.');
        }
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
      this.moneyDisplay.textContent = `$${money}`;
      this.waveDisplay.textContent = wave.toString();
      this.towerShopPanel.updateMoney(money);
      this.towerInfoPanel.updateMoney(money);
      this.updateWavePreview();

      // Disable Select Area buttons once a wave has started
      if (wave > 0) {
        this.selectBoundsBtn.disabled = true;
        this.selectCustomBtn.disabled = true;
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
    this.speedBtn.textContent = '1x';
    this.speedBtn.classList.remove('fast');
    this.speedBtn.classList.remove('slow');
    this.gameScene.waveManager.setSpeed(1);
  }

  private clearGame() {
    console.log('Clearing game...');
    this.gameScene.reset();
    this.selector.clearSelection();
    this.resetGameControls();
    this.towerInfoPanel.hide();
    this.towerShopPanel.hide();
    this.wavePreview.classList.add('hidden');
    this.gameControls.classList.add('hidden');
    this.roadToggle.classList.add('hidden');
    this.showRoadsCheckbox.checked = false;
    this.gameScene.setShowRoads(false);
    this.selectBoundsBtn.disabled = false;
    this.selectCustomBtn.disabled = false;
    this.updateStepHelp(1, 'Select play area');
    console.log('Game cleared');
  }

  private showGameOver(wave: number, kills: number, moneyEarned: number) {
    const overlay = document.getElementById('game-over-overlay');
    const waveEl = document.getElementById('game-over-wave');
    const killsEl = document.getElementById('game-over-kills');
    const moneyEl = document.getElementById('game-over-money');
    const playAgainBtn = document.getElementById('play-again-btn');
    const replayMapBtn = document.getElementById('replay-map-btn');

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

    if (replayMapBtn) {
      replayMapBtn.onclick = async () => {
        if (overlay) overlay.classList.add('hidden');
        await this.replayCurrentMap();
      };
    }
  }

  private async replayCurrentMap() {
    const currentConfig = this.selector.getState().config;
    if (!currentConfig) {
      console.error('No map configuration available to replay');
      this.clearGame();
      return;
    }

    this.clearGame();
    this.selector.loadConfiguration(currentConfig);

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
      await this.gameScene.loadRoadsFromOSM(currentConfig.bounds, currentConfig, (message) => {
        if (loadingText) loadingText.textContent = message;
      });

      this.gameScene.setMapConfiguration(currentConfig);
      this.towerInfoPanel.hide();
      this.towerShopPanel.show();
      this.wavePreview.classList.remove('hidden');
      this.gameControls.classList.remove('hidden');
      this.roadToggle.classList.remove('hidden');
      this.updateWavePreview();
    } catch (error) {
      console.error('Failed to reload map:', error);
      alert('Failed to reload the map. Please try selecting a new area.');
      this.clearGame();
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (loadingText) loadingText.textContent = 'Loading Map Data...';
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

  private updateStepHelp(step: number, text: string) {
    this.selectionHelp.innerHTML = `<span class="step-number">${step}</span> ${text}`;
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

    // Enable place base button only if we have area but no config yet
    // Once base location is placed (config exists), lock the button
    this.placeBaseBtn.disabled = !state.area || state.config !== null;

    // Enable share/start only if we have a full config
    this.shareBtn.disabled = !state.config;
    this.startWaveBtn.disabled = !state.config;

    if (state.config) {
      this.gameScene.recalculateEntries(state.config);
      this.gameScene.setMapConfiguration(state.config);
      this.towerShopPanel.show();
      this.wavePreview.classList.remove('hidden');
      this.gameControls.classList.remove('hidden');
      this.roadToggle.classList.remove('hidden');
      this.updateWavePreview();
    }
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

  const selectionHelp = document.getElementById('selection-help') as HTMLElement;

  const mapSelector = new MapSelector(
    leafletMap,
    (state) => {
      uiManager.onStateChange(state);
    },
    // onBoundsSelected: Auto-load roads
    async (bounds, area) => {
      const loadingOverlay = document.getElementById('loading-overlay');
      const loadingText = document.getElementById('loading-text');
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');

      try {
        // Pass area for filtering, but null config since base isn't placed yet
        await gameScene.loadRoadsFromOSM(bounds, null, (message) => {
          if (loadingText) loadingText.textContent = message;
        }, area);
      } finally {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (loadingText) loadingText.textContent = 'Loading Map Data...';
      }
    },
    // validateBaseLocation: Check if point is on road
    (point) => {
      return gameScene.isPointOnRoad(point);
    },
    // onCornerCountChange: Update help text during custom selection
    (count) => {
      if (count < 4) {
        selectionHelp.innerHTML = `<span class="step-number">1</span> Click corner ${count + 1} of 4`;
      } else {
        selectionHelp.innerHTML = '<span class="step-number">1</span> Select play area';
      }
    }
  );

  const uiManager = new UIManager(mapSelector, gameScene, leafletMap);

  console.log('Maps Tower Defense initialized');
  console.log('Select an area, place base location, then load roads to begin!');
});

window.addEventListener('resize', () => {
  phaserGame.scale.resize(window.innerWidth, window.innerHeight);
});

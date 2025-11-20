import { Tower } from '../game/Tower';
import { TOWER_CONFIGS, TARGETING_LABELS } from '../game/TowerTypes';

export class TowerInfoPanel {
  private panel: HTMLElement;
  private titleElement: HTMLElement;
  private contentElement: HTMLElement;
  private currentTower: Tower | null = null;

  private onUpgrade: (tower: Tower) => void;
  private onSell: (tower: Tower) => void;

  constructor(onUpgrade: (tower: Tower) => void, onSell: (tower: Tower) => void) {
    this.onUpgrade = onUpgrade;
    this.onSell = onSell;

    this.panel = document.getElementById('tower-info-panel')!;
    this.titleElement = document.getElementById('towerInfoTitle')!;
    this.contentElement = document.getElementById('towerInfoContent')!;
  }

  public showTower(tower: Tower): void {
    this.currentTower = tower;
    this.render();
    this.panel.classList.remove('hidden');
  }

  public hide(): void {
    this.currentTower = null;
    this.panel.classList.add('hidden');
  }

  public updateDisplay(): void {
    if (this.currentTower) {
      this.render();
    }
  }

  private render(): void {
    if (!this.currentTower) return;

    const tower = this.currentTower;
    const config = TOWER_CONFIGS[tower.type];
    const upgradeCost = tower.getUpgradeCost();
    const sellValue = tower.getSellValue();
    const uptime = Math.floor(tower.getUptime() / 1000);

    this.titleElement.textContent = `${config.name} Tower (Level ${tower.level})`;

    const accuracyPercent = tower.statistics.shotsFired > 0
      ? Math.round((tower.statistics.shotsHit / tower.statistics.shotsFired) * 100)
      : 0;

    this.contentElement.innerHTML = `
      <div class="tower-info-actions">
        ${upgradeCost !== null
          ? `<button id="upgradeTowerBtn" data-cost="${upgradeCost}">Upgrade ($${upgradeCost})</button>`
          : '<button disabled>Max Level</button>'
        }
        <button id="sellTowerBtn" data-value="${sellValue}">Sell ($${sellValue})</button>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Total Invested:</span>
        <span class="tower-info-value">$${tower.getTotalInvested()}</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Kills:</span>
        <span class="tower-info-value">${tower.statistics.kills}</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Damage Dealt:</span>
        <span class="tower-info-value">${tower.statistics.damageDealt}</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Accuracy:</span>
        <span class="tower-info-value">${accuracyPercent}% (${tower.statistics.shotsHit}/${tower.statistics.shotsFired})</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Efficiency:</span>
        <span class="tower-info-value">${tower.getEfficiency().toFixed(1)} dmg/$</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Range:</span>
        <span class="tower-info-value">${tower.stats.range}</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Damage:</span>
        <span class="tower-info-value">${tower.stats.damage}</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Fire Rate:</span>
        <span class="tower-info-value">${(1000 / tower.stats.fireRate).toFixed(2)}/s</span>
      </div>
      <div class="tower-info-row">
        <span class="tower-info-label">Uptime:</span>
        <span class="tower-info-value">${uptime}s</span>
      </div>
    `;

    const upgradeBtn = document.getElementById('upgradeTowerBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.handleUpgrade());
    }

    const sellBtn = document.getElementById('sellTowerBtn');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => this.handleSell());
    }
  }

  private handleUpgrade(): void {
    if (this.currentTower) {
      this.onUpgrade(this.currentTower);
    }
  }

  private handleSell(): void {
    if (this.currentTower) {
      this.onSell(this.currentTower);
    }
  }
}

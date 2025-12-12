import { Tower } from '../game/Tower';
import { TOWER_CONFIGS } from '../game/TowerTypes';

export class TowerInfoPanel {
  private panel: HTMLElement;
  private titleElement: HTMLElement;
  private contentElement: HTMLElement;
  private currentTower: Tower | null = null;
  private currentMoney: number = 0;

  private onUpgrade: (tower: Tower) => void;
  private onSell: (tower: Tower) => void;

  constructor(onUpgrade: (tower: Tower) => void, onSell: (tower: Tower) => void) {
    this.onUpgrade = onUpgrade;
    this.onSell = onSell;

    this.panel = document.getElementById('tower-info-panel')!;
    this.titleElement = document.getElementById('towerInfoTitle')!;
    this.contentElement = document.getElementById('towerInfoContent')!;
  }

  public updateMoney(money: number): void {
    this.currentMoney = money;
    this.updateUpgradeButton();
  }

  private updateUpgradeButton(): void {
    const upgradeBtn = document.getElementById('upgradeTowerBtn') as HTMLButtonElement;
    if (!upgradeBtn || !this.currentTower) return;

    const upgradeCost = this.currentTower.getUpgradeCost();
    if (upgradeCost === null) return;

    const canAfford = this.currentMoney >= upgradeCost;
    upgradeBtn.disabled = !canAfford;
    upgradeBtn.classList.toggle('unaffordable', !canAfford);

    if (canAfford) {
      upgradeBtn.title = 'Improve tower stats';
    } else {
      upgradeBtn.title = `Need $${upgradeCost - this.currentMoney} more`;
    }
  }

  public showTower(tower: Tower, currentMoney?: number): void {
    this.currentTower = tower;
    if (currentMoney !== undefined) {
      this.currentMoney = currentMoney;
    }
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

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private render(): void {
    if (!this.currentTower) return;

    const tower = this.currentTower;
    const config = TOWER_CONFIGS[tower.type];
    const upgradeCost = tower.getUpgradeCost();
    const sellValue = tower.getSellValue();
    const uptime = tower.getUptime();
    const dps = (tower.stats.damage * (1000 / tower.stats.fireRateMs)).toFixed(1);

    this.titleElement.innerHTML = `
      <span class="tower-title-name">${config.name}</span>
      <span class="tower-title-level">Lv.${tower.level}</span>
    `;

    const accuracyPercent = tower.statistics.shotsFired > 0
      ? Math.round((tower.statistics.shotsHit / tower.statistics.shotsFired) * 100)
      : 0;

    this.contentElement.innerHTML = `
      <div class="tower-info-actions">
        ${upgradeCost !== null
          ? `<button id="upgradeTowerBtn" class="upgrade-btn" title="Improve tower stats">Upgrade $${upgradeCost}</button>`
          : '<button disabled class="upgrade-btn maxed">Max Level</button>'
        }
        <button id="sellTowerBtn" class="sell-btn" title="Remove tower and recoup some cost">Sell $${sellValue}</button>
      </div>

      <div class="tower-info-section">
        <div class="tower-info-row">
          <span class="tower-info-label" title="Choose how this tower picks targets">Targeting</span>
          <select id="targetingModeSelect" class="targeting-select">
            <option value="FIRST" ${tower.targetingMode === 'FIRST' ? 'selected' : ''}>First</option>
            <option value="LAST" ${tower.targetingMode === 'LAST' ? 'selected' : ''}>Last</option>
            <option value="CLOSEST" ${tower.targetingMode === 'CLOSEST' ? 'selected' : ''}>Nearest</option>
            <option value="STRONGEST" ${tower.targetingMode === 'STRONGEST' ? 'selected' : ''}>Strongest</option>
          </select>
        </div>
      </div>

      <div class="tower-info-section">
        <h4 class="tower-info-section-title">Stats</h4>
        <div class="tower-stats-grid">
          <div class="tower-stat-item" title="Damage per shot">
            <span class="stat-label">Damage</span>
            <span class="stat-value">${tower.stats.damage}</span>
          </div>
          <div class="tower-stat-item" title="Attack range in meters">
            <span class="stat-label">Range</span>
            <span class="stat-value">${tower.stats.range}m</span>
          </div>
          <div class="tower-stat-item" title="Shots per second">
            <span class="stat-label">Fire Rate</span>
            <span class="stat-value">${(1000 / tower.stats.fireRateMs).toFixed(1)}/s</span>
          </div>
          <div class="tower-stat-item highlight" title="Theoretical damage per second">
            <span class="stat-label">DPS</span>
            <span class="stat-value">${dps}</span>
          </div>
        </div>
      </div>

      <div class="tower-info-section">
        <h4 class="tower-info-section-title">Performance</h4>
        <div class="tower-stats-grid">
          <div class="tower-stat-item" title="Total enemies destroyed">
            <span class="stat-label">Kills</span>
            <span class="stat-value">${tower.statistics.kills}</span>
          </div>
          <div class="tower-stat-item" title="Total damage dealt to enemies">
            <span class="stat-label">Damage</span>
            <span class="stat-value">${tower.statistics.damageDealt}</span>
          </div>
          <div class="tower-stat-item" title="Percentage of shots that hit a target">
            <span class="stat-label">Accuracy</span>
            <span class="stat-value">${accuracyPercent}%</span>
          </div>
          <div class="tower-stat-item" title="Damage dealt per dollar invested">
            <span class="stat-label">Efficiency</span>
            <span class="stat-value">${tower.getEfficiency().toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div class="tower-info-footer">
        <span title="Total money spent on this tower">Invested: $${tower.getTotalInvested()}</span>
        <span title="Time since tower was placed">Active: ${this.formatUptime(uptime)}</span>
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

    const targetingSelect = document.getElementById('targetingModeSelect') as HTMLSelectElement;
    if (targetingSelect && this.currentTower) {
      targetingSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (this.currentTower) {
          this.currentTower.setTargetingMode(target.value as any);
          console.log(`Targeting mode changed to: ${target.value}`);
        }
      });
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

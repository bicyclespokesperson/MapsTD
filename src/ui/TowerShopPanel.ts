import { TowerType, TOWER_CONFIGS } from '../game/TowerTypes';

export class TowerShopPanel {
  private panel: HTMLElement;
  private cardsContainer: HTMLElement;
  private selectedType: TowerType | null = null;
  private currentMoney: number = 100;
  private towerCards: Map<TowerType, HTMLElement> = new Map();
  private onTowerSelected: (type: TowerType | null) => void;

  constructor(onTowerSelected: (type: TowerType | null) => void) {
    this.onTowerSelected = onTowerSelected;

    this.panel = document.getElementById('tower-shop-panel')!;
    this.cardsContainer = document.getElementById('tower-cards')!;

    this.createTowerCards();
    this.updateAffordability();
  }

  private getTowerDescription(type: TowerType): string {
    const descriptions: Record<TowerType, string> = {
      'GUNNER': 'Balanced tower with decent damage and fire rate. Good starter choice.',
      'SNIPER': 'Long range, high damage, slow fire rate. Great for picking off tough enemies.',
      'MINIGUN': 'Very fast fire rate with low damage per shot. Shreds groups of weak enemies.',
      'CANNON': 'Deals splash damage to groups. Slow but devastating against clusters.',
      'HELICOPTER': 'Mobile tower that patrols an area. Can reach enemies others cannot.',
      'BOMB': 'One-time use explosive that destroys roads and everything in its radius.',
    };
    return descriptions[type];
  }

  private createTowerCards(): void {
    const towerTypes: TowerType[] = ['GUNNER', 'SNIPER', 'MINIGUN', 'CANNON', 'HELICOPTER', 'BOMB'];

    for (const type of towerTypes) {
      const config = TOWER_CONFIGS[type];
      const card = document.createElement('div');
      card.className = 'tower-card';
      card.title = this.getTowerDescription(type);

      const icon = document.createElement('div');
      icon.className = 'tower-card-icon';
      icon.style.backgroundColor = `#${config.color.toString(16).padStart(6, '0')}`;

      const name = document.createElement('div');
      name.className = 'tower-card-name';
      name.textContent = config.name;

      const cost = document.createElement('div');
      cost.className = 'tower-card-cost';
      cost.textContent = `$${config.baseCost}`;

      const stats = document.createElement('div');
      stats.className = 'tower-card-stats';

      if (type === 'BOMB') {
        stats.innerHTML = `
          <span title="Damage dealt to all enemies in radius">${config.baseStats.damage} dmg</span><br>
          <span title="Explosion radius in meters">${config.baseStats.range}m radius</span><br>
          <span class="tower-card-special">Single use</span>
        `;
      } else {
        const dps = (config.baseStats.damage * (1000 / config.baseStats.fireRateMs)).toFixed(0);
        stats.innerHTML = `
          <span title="Damage per shot">${config.baseStats.damage} dmg</span>
          <span title="Attack range in meters">${config.baseStats.range}m</span><br>
          <span title="Damage per second" class="tower-card-dps">${dps} DPS</span>
        `;
      }

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(cost);
      card.appendChild(stats);

      card.addEventListener('click', () => this.handleCardClick(type));

      this.cardsContainer.appendChild(card);
      this.towerCards.set(type, card);
    }
  }

  private handleCardClick(type: TowerType): void {
    const config = TOWER_CONFIGS[type];

    if (this.currentMoney < config.baseCost) {
      return;
    }

    if (this.selectedType === type) {
      this.deselectTower();
    } else {
      this.selectTower(type);
    }
  }

  public selectTower(type: TowerType): void {
    if (this.selectedType) {
      this.towerCards.get(this.selectedType)?.classList.remove('selected');
    }

    this.selectedType = type;
    this.towerCards.get(type)?.classList.add('selected');
    this.onTowerSelected(type);
  }

  public deselectTower(): void {
    if (this.selectedType) {
      this.towerCards.get(this.selectedType)?.classList.remove('selected');
    }
    this.selectedType = null;
    this.onTowerSelected(null);
  }

  public getSelectedType(): TowerType | null {
    return this.selectedType;
  }

  public updateMoney(money: number): void {
    this.currentMoney = money;
    this.updateAffordability();
  }

  private updateAffordability(): void {
    for (const [type, card] of this.towerCards.entries()) {
      const config = TOWER_CONFIGS[type];
      if (this.currentMoney < config.baseCost) {
        card.classList.add('disabled');
      } else {
        card.classList.remove('disabled');
      }
    }
  }

  public show(): void {
    this.panel.classList.remove('hidden');
  }

  public hide(): void {
    this.panel.classList.add('hidden');
    this.deselectTower();
  }
}

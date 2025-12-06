import * as L from 'leaflet';
import { MapConfiguration } from './mapConfiguration';
import { GAME_CONFIG } from './config';

export type SelectionMode = 'none' | 'drawing-bounds' | 'placing-base';

export interface SelectionState {
  mode: SelectionMode;
  bounds: L.LatLngBounds | null;
  baseLocation: L.LatLng | null;
  config: MapConfiguration | null;
}

export class MapSelector {
  private map: L.Map;
  private state: SelectionState;

  private boundsRectangle: L.Rectangle | null = null;
  private baseMarker: L.Marker | null = null;
  private noBuildCircle: L.Circle | null = null;

  private startPoint: L.LatLng | null = null;
  private tempRectangle: L.Rectangle | null = null;
  private sizeTooltip: L.Tooltip | null = null;
  private rangePreviewCircle: L.Circle | null = null;

  private onStateChange: (state: SelectionState) => void;
  private onBoundsSelected?: (bounds: L.LatLngBounds) => void;
  private validateBaseLocation?: (point: L.LatLng) => boolean;

  constructor(
    map: L.Map, 
    onStateChange: (state: SelectionState) => void,
    onBoundsSelected?: (bounds: L.LatLngBounds) => void,
    validateBaseLocation?: (point: L.LatLng) => boolean
  ) {
    this.map = map;
    this.onStateChange = onStateChange;
    this.onBoundsSelected = onBoundsSelected;
    this.validateBaseLocation = validateBaseLocation;
    this.state = {
      mode: 'none',
      bounds: null,
      baseLocation: null,
      config: null,
    };
  }

  startBoundsSelection(): void {
    this.clearSelection();
    this.state.mode = 'drawing-bounds';
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.dragging.disable();

    this.map.on('mousedown', this.onMouseDown, this);
    this.map.on('mousemove', this.onMouseMove, this);
    this.map.on('mouseup', this.onMouseUp, this);

    this.notifyStateChange();
  }

  startBaseSelection(): void {
    if (!this.state.bounds) {
      throw new Error('Must select bounds before placing base location');
    }

    this.state.mode = 'placing-base';
    this.map.getContainer().classList.add('base-cursor');

    this.map.once('click', this.onBaseLocationClick, this);

    this.notifyStateChange();
  }

  cancelSelection(): void {
    this.map.off('mousedown', this.onMouseDown, this);
    this.map.off('mousemove', this.onMouseMove, this);
    this.map.off('mouseup', this.onMouseUp, this);
    this.map.off('click', this.onBaseLocationClick, this);

    this.map.getContainer().style.cursor = '';
    this.map.getContainer().classList.remove('base-cursor');
    this.map.dragging.enable();

    if (this.tempRectangle) {
      this.tempRectangle.remove();
      this.tempRectangle = null;
    }

    if (this.sizeTooltip) {
      this.sizeTooltip.remove();
      this.sizeTooltip = null;
    }

    if (this.rangePreviewCircle) {
      this.rangePreviewCircle.remove();
      this.rangePreviewCircle = null;
    }

    this.startPoint = null;
    this.state.mode = 'none';
    this.notifyStateChange();
  }

  clearSelection(): void {
    this.cancelSelection();

    if (this.boundsRectangle) {
      this.boundsRectangle.remove();
      this.boundsRectangle = null;
    }

    if (this.baseMarker) {
      this.baseMarker.remove();
      this.baseMarker = null;
    }

    if (this.noBuildCircle) {
      this.noBuildCircle.remove();
      this.noBuildCircle = null;
    }

    if (this.rangePreviewCircle) {
      this.rangePreviewCircle.remove();
      this.rangePreviewCircle = null;
    }

    this.state = {
      mode: 'none',
      bounds: null,
      baseLocation: null,
      config: null,
    };

    this.notifyStateChange();
  }

  loadConfiguration(config: MapConfiguration): void {
    this.clearSelection();

    this.state.bounds = config.bounds;
    this.state.baseLocation = config.baseLocation;
    this.state.config = config;

    this.boundsRectangle = L.rectangle(config.bounds, {
      color: '#3388ff',
      weight: 3,
      fillOpacity: 0.1,
    }).addTo(this.map);

    this.baseMarker = L.marker(config.baseLocation, {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(this.map);

    this.baseMarker.bindPopup('<b>Base Location</b>');

    this.noBuildCircle = L.circle(config.baseLocation, {
      radius: config.getNoBuildRadiusMeters(),
      color: '#ff0000',
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5',
    }).addTo(this.map);

    this.map.fitBounds(config.bounds);
    this.notifyStateChange();
  }

  getState(): SelectionState {
    return { ...this.state };
  }

  get currentMode(): SelectionMode {
    return this.state.mode;
  }

  isSelecting(): boolean {
    return this.state.mode === 'drawing-bounds';
  }

  private onMouseDown = (e: L.LeafletMouseEvent): void => {
    if (this.state.mode !== 'drawing-bounds') return;

    this.startPoint = e.latlng;

    const bounds = L.latLngBounds(this.startPoint, this.startPoint);
    this.tempRectangle = L.rectangle(bounds, {
      color: '#3388ff',
      weight: 2,
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(this.map);

    this.sizeTooltip = L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'size-tooltip',
    })
      .setLatLng(this.startPoint)
      .setContent('0m × 0m')
      .addTo(this.map);
  };

  private onMouseMove = (e: L.LeafletMouseEvent): void => {
    if (!this.startPoint || !this.tempRectangle) return;

    const bounds = L.latLngBounds([this.startPoint, e.latlng]);
    this.tempRectangle.setBounds(bounds);

    const { widthKm, heightKm } = this.getBoundsSize(bounds);
    const status = this.getSizeStatus(widthKm, heightKm);
    const color = this.getStatusColor(status);

    this.tempRectangle.setStyle({ color });

    if (this.sizeTooltip) {
      const widthStr = this.formatSize(widthKm);
      const heightStr = this.formatSize(heightKm);
      this.sizeTooltip.setLatLng(bounds.getCenter());
      this.sizeTooltip.setContent(`${widthStr} × ${heightStr}`);
    }

    // Update range preview circle
    const center = bounds.getCenter();
    if (!this.rangePreviewCircle) {
      this.rangePreviewCircle = L.circle(center, {
        radius: GAME_CONFIG.MAP.AVERAGE_TOWER_RANGE,
        color: '#ffffff',
        weight: 1,
        dashArray: '5, 5',
        fillOpacity: 0.1,
        interactive: false
      }).addTo(this.map);
      
      this.rangePreviewCircle.bindTooltip('Avg Tower Range', {
        permanent: true,
        direction: 'center',
        className: 'range-tooltip',
      }).openTooltip();
    } else {
      this.rangePreviewCircle.setLatLng(center);
    }
  };

  private onMouseUp = (e: L.LeafletMouseEvent): void => {
    if (!this.startPoint || !this.tempRectangle) return;

    const bounds = L.latLngBounds([this.startPoint, e.latlng]);
    const { widthKm, heightKm } = this.getBoundsSize(bounds);
    const { MIN_WIDTH_KM, MAX_WIDTH_KM, MIN_HEIGHT_KM, MAX_HEIGHT_KM } = GAME_CONFIG.MAP;

    if (widthKm < MIN_WIDTH_KM || heightKm < MIN_HEIGHT_KM) {
      alert(`Selection too small. Minimum size is ${MIN_WIDTH_KM}km × ${MIN_HEIGHT_KM}km`);
      this.cancelSelection();
      return;
    }

    if (widthKm > MAX_WIDTH_KM || heightKm > MAX_HEIGHT_KM) {
      alert(`Selection too large. Maximum size is ${MAX_WIDTH_KM}km × ${MAX_HEIGHT_KM}km`);
      this.cancelSelection();
      return;
    }

    if (this.sizeTooltip) {
      this.sizeTooltip.remove();
      this.sizeTooltip = null;
    }

    if (this.rangePreviewCircle) {
      this.rangePreviewCircle.remove();
      this.rangePreviewCircle = null;
    }

    if (this.boundsRectangle) {
      this.boundsRectangle.remove();
    }

    this.boundsRectangle = this.tempRectangle;
    this.boundsRectangle.setStyle({ weight: 3, color: '#3388ff', interactive: false });

    this.tempRectangle = null;
    this.startPoint = null;

    this.state.bounds = bounds;
    this.cancelSelection();

    if (this.onBoundsSelected) {
        this.onBoundsSelected(bounds);
    }
  };

  private onBaseLocationClick = (e: L.LeafletMouseEvent): void => {
    if (!this.state.bounds) return;

    if (!this.state.bounds.contains(e.latlng)) {
      alert('Base location must be inside the selected bounds!');
      this.startBaseSelection();
      return;
    }
    
    if (this.validateBaseLocation && !this.validateBaseLocation(e.latlng)) {
        alert('Base location must be on a road!');
        this.startBaseSelection();
        return;
    }

    if (this.baseMarker) {
      this.baseMarker.remove();
    }

    if (this.noBuildCircle) {
      this.noBuildCircle.remove();
    }

    this.baseMarker = L.marker(e.latlng, {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(this.map);

    this.baseMarker.bindPopup('<b>Base Location</b>').openPopup();

    try {
      this.state.baseLocation = e.latlng;
      this.state.config = new MapConfiguration(this.state.bounds, this.state.baseLocation);

      this.noBuildCircle = L.circle(e.latlng, {
        radius: this.state.config.getNoBuildRadiusMeters(),
        color: '#ff0000',
        fillColor: '#ff0000',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(this.map);

      this.state.mode = 'none';
      this.map.getContainer().style.cursor = '';
      this.map.getContainer().classList.remove('base-cursor');
      this.notifyStateChange();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
      this.startBaseSelection();
    }
  };

  private notifyStateChange(): void {
    this.onStateChange(this.getState());
  }

  private getBoundsSize(bounds: L.LatLngBounds): { widthKm: number; heightKm: number } {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const nw = L.latLng(ne.lat, sw.lng);

    const widthM = sw.distanceTo(L.latLng(sw.lat, ne.lng));
    const heightM = sw.distanceTo(nw);

    return {
      widthKm: widthM / 1000,
      heightKm: heightM / 1000,
    };
  }

  private getSizeStatus(widthKm: number, heightKm: number): 'valid' | 'warning' | 'error' {
    const { MIN_WIDTH_KM, MAX_WIDTH_KM, MIN_HEIGHT_KM, MAX_HEIGHT_KM } = GAME_CONFIG.MAP;

    if (widthKm < MIN_WIDTH_KM || heightKm < MIN_HEIGHT_KM) {
      return 'error';
    }
    if (widthKm > MAX_WIDTH_KM || heightKm > MAX_HEIGHT_KM) {
      return 'error';
    }

    const widthRatio = widthKm / MAX_WIDTH_KM;
    const heightRatio = heightKm / MAX_HEIGHT_KM;
    if (widthRatio > 0.8 || heightRatio > 0.8) {
      return 'warning';
    }

    return 'valid';
  }

  private formatSize(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }

  private getStatusColor(status: 'valid' | 'warning' | 'error'): string {
    switch (status) {
      case 'valid': return '#3388ff';
      case 'warning': return '#ff9800';
      case 'error': return '#f44336';
    }
  }
}

import * as L from 'leaflet';
import { MapConfiguration } from './mapConfiguration';

export type SelectionMode = 'none' | 'drawing-bounds' | 'placing-defend';

export interface SelectionState {
  mode: SelectionMode;
  bounds: L.LatLngBounds | null;
  defendPoint: L.LatLng | null;
  config: MapConfiguration | null;
}

export class MapSelector {
  private map: L.Map;
  private state: SelectionState;

  private boundsRectangle: L.Rectangle | null = null;
  private defendMarker: L.Marker | null = null;
  private noBuildCircle: L.Circle | null = null;

  private startPoint: L.LatLng | null = null;
  private tempRectangle: L.Rectangle | null = null;

  private onStateChange: (state: SelectionState) => void;

  constructor(map: L.Map, onStateChange: (state: SelectionState) => void) {
    this.map = map;
    this.onStateChange = onStateChange;
    this.state = {
      mode: 'none',
      bounds: null,
      defendPoint: null,
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

  startDefendPointSelection(): void {
    if (!this.state.bounds) {
      throw new Error('Must select bounds before placing defend point');
    }

    this.state.mode = 'placing-defend';
    this.map.getContainer().style.cursor = 'crosshair';

    this.map.once('click', this.onDefendPointClick, this);

    this.notifyStateChange();
  }

  cancelSelection(): void {
    this.map.off('mousedown', this.onMouseDown, this);
    this.map.off('mousemove', this.onMouseMove, this);
    this.map.off('mouseup', this.onMouseUp, this);
    this.map.off('click', this.onDefendPointClick, this);

    this.map.getContainer().style.cursor = '';
    this.map.dragging.enable();

    if (this.tempRectangle) {
      this.tempRectangle.remove();
      this.tempRectangle = null;
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

    if (this.defendMarker) {
      this.defendMarker.remove();
      this.defendMarker = null;
    }

    if (this.noBuildCircle) {
      this.noBuildCircle.remove();
      this.noBuildCircle = null;
    }

    this.state = {
      mode: 'none',
      bounds: null,
      defendPoint: null,
      config: null,
    };

    this.notifyStateChange();
  }

  loadConfiguration(config: MapConfiguration): void {
    this.clearSelection();

    this.state.bounds = config.bounds;
    this.state.defendPoint = config.defendPoint;
    this.state.config = config;

    this.boundsRectangle = L.rectangle(config.bounds, {
      color: '#3388ff',
      weight: 3,
      fillOpacity: 0.1,
    }).addTo(this.map);

    this.defendMarker = L.marker(config.defendPoint, {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(this.map);

    this.defendMarker.bindPopup('<b>Defend This Point!</b>');

    this.noBuildCircle = L.circle(config.defendPoint, {
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

  private onMouseDown = (e: L.LeafletMouseEvent): void => {
    if (this.state.mode !== 'drawing-bounds') return;

    this.startPoint = e.latlng;

    this.tempRectangle = L.rectangle([this.startPoint, this.startPoint], {
      color: '#3388ff',
      weight: 2,
      fillOpacity: 0.1,
    }).addTo(this.map);
  };

  private onMouseMove = (e: L.LeafletMouseEvent): void => {
    if (!this.startPoint || !this.tempRectangle) return;

    const bounds = L.latLngBounds(this.startPoint, e.latlng);
    this.tempRectangle.setBounds(bounds);
  };

  private onMouseUp = (e: L.LeafletMouseEvent): void => {
    if (!this.startPoint || !this.tempRectangle) return;

    const bounds = L.latLngBounds(this.startPoint, e.latlng);

    if (this.boundsRectangle) {
      this.boundsRectangle.remove();
    }

    this.boundsRectangle = this.tempRectangle;
    this.boundsRectangle.setStyle({ weight: 3 });

    this.tempRectangle = null;
    this.startPoint = null;

    this.state.bounds = bounds;
    this.cancelSelection();
  };

  private onDefendPointClick = (e: L.LeafletMouseEvent): void => {
    if (!this.state.bounds) return;

    if (!this.state.bounds.contains(e.latlng)) {
      alert('Defend point must be inside the selected bounds!');
      this.startDefendPointSelection();
      return;
    }

    if (this.defendMarker) {
      this.defendMarker.remove();
    }

    if (this.noBuildCircle) {
      this.noBuildCircle.remove();
    }

    this.defendMarker = L.marker(e.latlng, {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(this.map);

    this.defendMarker.bindPopup('<b>Defend This Point!</b>').openPopup();

    try {
      this.state.defendPoint = e.latlng;
      this.state.config = new MapConfiguration(this.state.bounds, this.state.defendPoint);

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
      this.notifyStateChange();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
      this.startDefendPointSelection();
    }
  };

  private notifyStateChange(): void {
    this.onStateChange(this.getState());
  }
}

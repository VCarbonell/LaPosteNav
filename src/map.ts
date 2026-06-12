import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Voie } from './state';
import type { LatLng } from './geocode';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string;
const STYLE_URL = `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`;

let map: maplibregl.Map | null = null;
const markers: maplibregl.Marker[] = [];

export function initMap(containerId: string): void {
  if (map) return;

  map = new maplibregl.Map({
    container: containerId,
    style: STYLE_URL,
    center: [3.5, 43.55], // centre approximatif de la tournée (Hérault)
    zoom: 11,
    attributionControl: { compact: true },
  });
}

export function showRoute(
  routeCoords: [number, number][],
  voies: Voie[],
  coords: Map<string, LatLng>,
): void {
  if (!map) return;

  const onLoad = () => {
    clearRoute();
    addRouteLayers(routeCoords);
    addMarkers(voies, coords);
    fitBounds(routeCoords);
  };

  if (map.isStyleLoaded()) {
    onLoad();
  } else {
    map.once('load', onLoad);
  }
}

function clearRoute(): void {
  if (!map) return;
  if (map.getLayer('route-line')) map.removeLayer('route-line');
  if (map.getLayer('route-outline')) map.removeLayer('route-outline');
  if (map.getSource('route')) map.removeSource('route');
  markers.forEach(m => m.remove());
  markers.length = 0;
}

function addRouteLayers(coordinates: [number, number][]): void {
  if (!map) return;
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    },
  });

  map.addLayer({
    id: 'route-outline',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': 0.8 },
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2563eb', 'line-width': 4 },
  });
}

// Rayon de séparation quand plusieurs voies géocodent au même point (~30 m).
const SPREAD_DEG = 0.0003;

function spreadPosition(
  lat: number,
  lng: number,
  placed: Array<{ lat: number; lng: number }>,
): { lat: number; lng: number } {
  const clashes = placed.filter(
    p =>
      Math.abs(p.lat - lat) < SPREAD_DEG * 2 &&
      Math.abs(p.lng - lng) < SPREAD_DEG * 2,
  );
  if (clashes.length === 0) return { lat, lng };
  // Étaler en cercle (8 positions max avant recouvrement)
  const angle = (clashes.length * Math.PI * 2) / 8;
  return {
    lat: lat + SPREAD_DEG * Math.sin(angle),
    lng: lng + SPREAD_DEG * Math.cos(angle),
  };
}

function addMarkers(voies: Voie[], coords: Map<string, LatLng>): void {
  if (!map) return;
  const placed: Array<{ lat: number; lng: number }> = [];
  let seq = 1;

  for (const voie of voies) {
    if (!voie.inclure) continue;
    const pt = coords.get(voie.id);
    if (!pt) continue;

    const { lat, lng } = spreadPosition(pt.lat, pt.lng, placed);
    placed.push({ lat, lng });

    const el = document.createElement('div');
    el.className = 'map-marker' + (voie.lat ? ' map-marker--manual' : '');
    el.textContent = String(seq++);
    el.title = voie.rue;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map!);
    markers.push(marker);
  }
}

function fitBounds(coordinates: [number, number][]): void {
  if (!map || coordinates.length === 0) return;
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 40, duration: 600 },
  );
}

export function destroyMap(): void {
  if (!map) return;
  map.remove();
  map = null;
}

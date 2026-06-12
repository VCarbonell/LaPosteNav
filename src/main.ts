import { loadState, reset, state } from './state';
import { renderList, addVoie, initModal, initMoveModal, initGpsModal, markGeoErrors } from './list';
import { geocodeVoie, type LatLng } from './geocode';
import { computeRoute } from './route';
import { initMap, showRoute, getMap } from './map';
import {
  startNavigation,
  stopNavigation,
  recenter,
  setOnTrackingChange,
  isNavActive,
} from './nav';
import { getPitch, setPitch, getMode, setMode, type TransportMode } from './settings';
import './style.css';

// ---- view switching ----

function showView(name: 'list' | 'map'): void {
  document.getElementById('view-list')!.classList.toggle('hidden', name !== 'list');
  document.getElementById('view-map')!.classList.toggle('hidden', name !== 'map');
}

// ---- loading overlay ----

function setLoading(visible: boolean, text = 'Calcul en cours…'): void {
  const overlay = document.getElementById('loading-overlay')!;
  overlay.classList.toggle('hidden', !visible);
  document.getElementById('loading-text')!.textContent = text;
}

// ---- geocoding + routing ----

async function runTrace(): Promise<void> {
  const included = state.voies.filter(v => v.inclure);
  if (included.length < 2) {
    alert('Il faut au moins 2 voies incluses pour tracer un itinéraire.');
    return;
  }

  setLoading(true, `Géocodage… (0 / ${included.length})`);

  // Reset error flags
  state.voies.forEach(v => { v.geoError = undefined; });

  // Geocode all included voies (batches of 5 to respect ORS rate limit)
  const coordsMap = new Map<string, LatLng>();
  const BATCH = 5;
  let done = 0;
  for (let i = 0; i < included.length; i += BATCH) {
    const batch = included.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async voie => {
        let pt: LatLng | null = null;
        if (voie.lat != null && voie.lng != null) {
          pt = { lat: voie.lat, lng: voie.lng };
        } else if (!voie.commune.trim()) {
          voie.geoError = true;
        } else {
          pt = await geocodeVoie(voie.rue, voie.commune, voie.cp, voie.num);
        }
        if (pt) {
          coordsMap.set(voie.id, pt);
        } else {
          voie.geoError = true;
        }
        done++;
        setLoading(true, `Géocodage… (${done} / ${included.length})`);
      }),
    );
  }

  const errorCount = included.filter(v => v.geoError).length;
  markGeoErrors();

  const waypoints = included
    .filter(v => !v.geoError)
    .map(v => coordsMap.get(v.id)!)
    .filter(Boolean);

  if (waypoints.length < 2) {
    setLoading(false);
    alert(
      `Impossible de tracer : ${errorCount} voie(s) sans coordonnées trouvées.\n` +
      'Renseignez les communes/CP manquants ou saisissez des coordonnées GPS manuelles.',
    );
    return;
  }

  setLoading(true, 'Calcul de l\'itinéraire…');
  const mode = getMode();
  const routeCoords = await computeRoute(waypoints, mode, (segDone, segTotal) => {
    setLoading(true, `Itinéraire… (${segDone} / ${segTotal} segments)`);
  });

  setLoading(false);

  if (!routeCoords) {
    alert('Erreur lors du calcul de l\'itinéraire (ORS). Vérifiez votre clé API et votre connexion.');
    return;
  }

  // Build per-voie coord map for markers (only non-error voies)
  const markerCoords = new Map<string, LatLng>();
  for (const voie of included) {
    const pt = coordsMap.get(voie.id);
    if (pt) markerCoords.set(voie.id, pt);
  }

  showView('map');
  initMap('map-container');
  showRoute(routeCoords, state.voies, markerCoords);

  const title = document.getElementById('map-title')!;
  title.textContent = errorCount > 0
    ? `Itinéraire (${errorCount} voie${errorCount > 1 ? 's' : ''} ignorée${errorCount > 1 ? 's' : ''})`
    : `Itinéraire (${waypoints.length} voies)`;
}

// ---- navigation mode ----

const meArrow = () => document.getElementById('me-arrow')!;
const btnFollow = () => document.getElementById('btn-follow')!;
const btnNav = () => document.getElementById('btn-nav')!;
const btnRetrace = () => document.getElementById('btn-retrace')!;

function setNavUI(active: boolean): void {
  btnNav().textContent = active ? '■ Arrêter' : '▶ Conduire';
  btnNav().classList.toggle('nav-active', active);
  btnRetrace().classList.toggle('hidden', active);
  if (!active) {
    meArrow().classList.add('hidden');
    btnFollow().classList.add('hidden');
  }
}

async function toggleNav(): Promise<void> {
  if (isNavActive()) {
    stopNavigation();
    setNavUI(false);
    return;
  }

  const map = getMap();
  if (!map) return;

  setNavUI(true);
  await startNavigation(map, getPitch());
}

// ---- settings modal ----

function initSettings(): void {
  const modal = document.getElementById('settings-modal')!;
  const slider = document.getElementById('pitch-slider') as HTMLInputElement;
  const pitchVal = document.getElementById('pitch-value')!;

  // Initialise les valeurs depuis localStorage
  const savedPitch = getPitch();
  slider.value = String(savedPitch);
  pitchVal.textContent = String(savedPitch);

  const savedMode = getMode();
  const modeRadio = document.querySelector(
    `input[name="transport-mode"][value="${savedMode}"]`,
  ) as HTMLInputElement | null;
  if (modeRadio) modeRadio.checked = true;

  document.getElementById('btn-settings')!.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  document.getElementById('settings-close')!.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('settings-overlay')!.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    pitchVal.textContent = String(v);
    setPitch(v);
  });

  document.querySelectorAll<HTMLInputElement>('input[name="transport-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      setMode(radio.value as TransportMode);
    });
  });
}

// ---- init ----

async function init(): Promise<void> {
  await loadState();
  renderList();
  initModal();
  initMoveModal();
  initGpsModal();
  initSettings();

  document.getElementById('btn-add')!.addEventListener('click', addVoie);

  document.getElementById('btn-reset')!.addEventListener('click', async () => {
    if (!confirm('Réinitialiser la liste ? Toutes les modifications seront perdues.')) return;
    await reset();
    renderList();
    window.scrollTo({ top: 0 });
  });

  document.getElementById('btn-trace')!.addEventListener('click', () => runTrace());

  document.getElementById('btn-back')!.addEventListener('click', () => {
    if (isNavActive()) {
      stopNavigation();
      setNavUI(false);
    }
    showView('list');
  });

  document.getElementById('btn-retrace')!.addEventListener('click', () => {
    showView('list');
    setTimeout(() => runTrace(), 50);
  });

  document.getElementById('btn-nav')!.addEventListener('click', () => toggleNav());

  document.getElementById('btn-follow')!.addEventListener('click', () => {
    recenter();
  });

  // Met à jour la flèche et le bouton recentrer selon l'état du suivi
  setOnTrackingChange((active: boolean) => {
    meArrow().classList.toggle('hidden', !active);
    btnFollow().classList.toggle('hidden', active);
  });
}

init();

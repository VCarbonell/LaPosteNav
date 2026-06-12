import { loadState, reset, state } from './state';
import { renderList, addVoie, initModal, markGeoErrors } from './list';
import { geocodeVoie, type LatLng } from './geocode';
import { computeRoute } from './route';
import { initMap, showRoute } from './map';
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
          // Commune manquante → géocodage sans commune renverrait n'importe quoi en France
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
  const routeCoords = await computeRoute(waypoints, (segDone, segTotal) => {
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

// ---- init ----

async function init(): Promise<void> {
  await loadState();
  renderList();
  initModal();

  document.getElementById('btn-add')!.addEventListener('click', addVoie);

  document.getElementById('btn-reset')!.addEventListener('click', async () => {
    if (!confirm('Réinitialiser la liste ? Toutes les modifications seront perdues.')) return;
    await reset();
    renderList();
    window.scrollTo({ top: 0 });
  });

  document.getElementById('btn-trace')!.addEventListener('click', () => runTrace());

  document.getElementById('btn-back')!.addEventListener('click', () => showView('list'));

  document.getElementById('btn-retrace')!.addEventListener('click', () => {
    showView('list');
    setTimeout(() => runTrace(), 50);
  });
}

init();

import Sortable from 'sortablejs';
import { state, save, type Voie } from './state';

let sortable: Sortable | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ------- helpers -------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 400);
}

// ------- render -------

export function renderList(): void {
  const container = document.getElementById('list-container')!;
  let ul = document.getElementById('voie-list') as HTMLUListElement | null;

  if (!ul) {
    ul = document.createElement('ul');
    ul.id = 'voie-list';
    ul.className = 'voie-list';
    container.appendChild(ul);
    ul.addEventListener('input', onListInput);
    ul.addEventListener('change', onListChange);
    ul.addEventListener('click', onListClick);
  }

  if (sortable) {
    sortable.destroy();
    sortable = null;
  }

  ul.innerHTML = '';
  for (const voie of state.voies) {
    ul.appendChild(createItem(voie));
  }

  sortable = Sortable.create(ul, {
    handle: '.drag-handle',
    animation: 150,
    delay: 120,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    onEnd() {
      const ids = [...ul!.querySelectorAll<HTMLElement>('.voie-item')].map(
        el => el.dataset.id!
      );
      const map = new Map(state.voies.map(v => [v.id, v]));
      state.voies = ids.map(id => map.get(id)!);
      save();
    },
  });
}

function createItem(voie: Voie): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'voie-item';
  li.dataset.id = voie.id;
  li.dataset.inclure = String(voie.inclure);

  const hasCoords = voie.lat != null && voie.lng != null;

  li.innerHTML = `
    <div class="drag-handle" aria-label="Déplacer" role="button">⠿</div>
    <div class="voie-body">
      <div class="row row-main">
        <input
          class="field rue"
          data-field="rue"
          value="${esc(voie.rue)}"
          placeholder="Nom de la rue"
          aria-label="Nom de la rue"
        />
        <span class="manual-badge${hasCoords ? ' manual-badge--active' : ''}" aria-label="Coordonnées GPS manuelles" title="Point GPS manuel — prime sur le géocodage">📍</span>
        <span class="geo-badge${voie.geoError ? ' geo-badge--error' : ''}" aria-label="Erreur de géocodage" title="Adresse introuvable — renseignez la commune/CP ou saisissez des coordonnées GPS">❗</span>
        <label class="inclure-label" title="${voie.inclure ? 'Inclus dans le tracé' : 'Exclu du tracé'}">
          <input type="checkbox" class="inclure-check" ${voie.inclure ? 'checked' : ''} aria-label="Inclure dans le tracé" />
        </label>
      </div>
      <div class="row row-loc">
        <input
          class="field commune"
          data-field="commune"
          value="${esc(voie.commune)}"
          placeholder="Commune"
          aria-label="Commune"
        />
        <input
          class="field cp"
          data-field="cp"
          value="${esc(voie.cp)}"
          placeholder="CP"
          aria-label="Code postal"
          inputmode="numeric"
        />
        <button class="btn-copy-commune" type="button" title="Copier commune+CP vers d'autres voies" aria-label="Copier commune et CP">→</button>
      </div>
      <div class="row row-num">
        <input
          class="field num"
          data-field="num"
          value="${esc(voie.num)}"
          placeholder="Numéros"
          aria-label="Numéros"
        />
        <button class="btn-gps${hasCoords ? ' has-coords' : ''}" type="button" aria-label="Coordonnées GPS manuelles" title="Saisir des coordonnées GPS pour cette voie">📍</button>
        <button class="btn-move" type="button" aria-label="Déplacer cette voie">↕</button>
        <button class="btn-duplicate" type="button" aria-label="Dupliquer cette voie">⧉</button>
        <button class="btn-delete" type="button" aria-label="Supprimer cette voie">✕</button>
      </div>
    </div>
  `;

  return li;
}

// ------- event handlers -------

function onListInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  const field = target.dataset.field;
  if (!field) return;

  const li = target.closest<HTMLElement>('.voie-item');
  if (!li) return;
  const voie = state.voies.find(v => v.id === li.dataset.id);
  if (!voie) return;

  voie[field as 'rue' | 'commune' | 'cp' | 'num'] = target.value;
  debouncedSave();
}

function onListChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (!target.classList.contains('inclure-check')) return;

  const li = target.closest<HTMLElement>('.voie-item');
  if (!li) return;
  const voie = state.voies.find(v => v.id === li.dataset.id);
  if (!voie) return;

  voie.inclure = target.checked;
  li.dataset.inclure = String(voie.inclure);
  const label = target.closest<HTMLLabelElement>('.inclure-label');
  if (label) label.title = voie.inclure ? 'Inclus dans le tracé' : 'Exclu du tracé';
  save();
}

function onListClick(e: Event): void {
  const target = e.target as HTMLElement;
  const li = target.closest<HTMLElement>('.voie-item');
  if (!li) return;

  if (target.classList.contains('btn-duplicate')) {
    const idx = state.voies.findIndex(v => v.id === li.dataset.id);
    if (idx === -1) return;
    const source = state.voies[idx];
    const copy: Voie = { ...source, id: crypto.randomUUID(), geoError: undefined };
    state.voies.splice(idx + 1, 0, copy);
    save();
    const newLi = createItem(copy);
    li.after(newLi);
    newLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (target.classList.contains('btn-delete')) {
    const voie = state.voies.find(v => v.id === li.dataset.id);
    const name = voie?.rue || 'cette voie';
    if (!confirm(`Supprimer « ${name} » ?`)) return;
    state.voies = state.voies.filter(v => v.id !== li.dataset.id);
    li.remove();
    save();
    return;
  }

  if (target.classList.contains('btn-copy-commune')) {
    const voie = state.voies.find(v => v.id === li.dataset.id);
    if (voie) openCopyModal(voie.commune, voie.cp, voie.id);
  }

  if (target.classList.contains('btn-move')) {
    const voie = state.voies.find(v => v.id === li.dataset.id);
    if (voie) openMoveModal(voie.id);
  }

  if (target.classList.contains('btn-gps')) {
    const voie = state.voies.find(v => v.id === li.dataset.id);
    if (voie) openGpsModal(voie.id);
  }
}

// ------- add voie -------

export function addVoie(): void {
  const voie: Voie = {
    id: crypto.randomUUID(),
    rue: '',
    commune: '',
    cp: '',
    num: '',
    inclure: true,
  };
  state.voies.push(voie);
  save();

  const ul = document.getElementById('voie-list');
  if (!ul) { renderList(); return; }

  const li = createItem(voie);
  ul.appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'center' });
  (li.querySelector('.field.rue') as HTMLInputElement | null)?.focus();
}

// ------- copy commune modal -------

let modalCommune = '';
let modalCp = '';
let modalSourceId = '';

export function initModal(): void {
  document.getElementById('modal-close')!.addEventListener('click', closeCopyModal);
  document.getElementById('modal-overlay')!.addEventListener('click', closeCopyModal);
  document.getElementById('modal-select-empty')!.addEventListener('click', selectEmptyVoies);
  document.getElementById('modal-apply')!.addEventListener('click', applyCopy);
}

function openCopyModal(commune: string, cp: string, sourceId: string): void {
  modalCommune = commune;
  modalCp = cp;
  modalSourceId = sourceId;

  const infoEl = document.getElementById('modal-info')!;
  infoEl.textContent = `Appliquer « ${commune || '(vide)'} ${cp || ''} » à :`;

  const listEl = document.getElementById('modal-list')!;
  listEl.innerHTML = '';

  for (const voie of state.voies) {
    if (voie.id === sourceId) continue;
    const label = document.createElement('label');
    label.className = 'modal-voie';
    label.innerHTML = `
      <input type="checkbox" value="${voie.id}" />
      <span class="modal-rue">${esc(voie.rue || '(sans nom)')}</span>
      <span class="modal-loc">${esc(voie.commune) || '—'}${voie.cp ? ' ' + esc(voie.cp) : ''}</span>
    `;
    listEl.appendChild(label);
  }

  document.getElementById('copy-modal')!.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCopyModal(): void {
  document.getElementById('copy-modal')!.classList.add('hidden');
  document.body.style.overflow = '';
}

function selectEmptyVoies(): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>('#modal-list input[type="checkbox"]');
  checkboxes.forEach(cb => {
    const voie = state.voies.find(v => v.id === cb.value);
    if (voie && !voie.commune && !voie.cp) cb.checked = true;
  });
}

// ------- geo error badges -------

export function markGeoErrors(): void {
  for (const voie of state.voies) {
    const li = document.querySelector<HTMLElement>(`.voie-item[data-id="${voie.id}"]`);
    if (!li) continue;
    const badge = li.querySelector<HTMLElement>('.geo-badge');
    if (badge) badge.classList.toggle('geo-badge--error', !!voie.geoError);
  }
}

// ------- move modal -------

let moveSourceId = '';

export function initMoveModal(): void {
  document.getElementById('move-modal-close')!.addEventListener('click', closeMoveModal);
  document.getElementById('move-modal-overlay')!.addEventListener('click', closeMoveModal);
  document.getElementById('move-modal-apply')!.addEventListener('click', applyMove);
}

function openMoveModal(sourceId: string): void {
  moveSourceId = sourceId;
  const voie = state.voies.find(v => v.id === sourceId)!;

  document.getElementById('move-modal-info')!.textContent =
    `Déplacer « ${voie.rue || '(sans nom)'} »`;

  const listEl = document.getElementById('move-modal-list')!;
  listEl.innerHTML = '';

  const mkOption = (value: string, rue: string, loc: string) => {
    const label = document.createElement('label');
    label.className = 'modal-voie';
    label.innerHTML = `
      <input type="radio" name="move-target" value="${esc(value)}" />
      <span class="modal-rue">${esc(rue)}</span>
      <span class="modal-loc">${esc(loc)}</span>
    `;
    listEl.appendChild(label);
  };

  mkOption('__start__', 'Début de la liste', '');
  for (const v of state.voies) {
    if (v.id === sourceId) continue;
    const loc = [v.commune, v.cp].filter(Boolean).join(' ');
    mkOption(v.id, v.rue || '(sans nom)', loc);
  }

  document.getElementById('move-modal')!.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMoveModal(): void {
  document.getElementById('move-modal')!.classList.add('hidden');
  document.body.style.overflow = '';
}

function applyMove(): void {
  const selected = document.querySelector<HTMLInputElement>('#move-modal-list input[type="radio"]:checked');
  if (!selected) return;

  const targetValue = selected.value;
  const srcIdx = state.voies.findIndex(v => v.id === moveSourceId);
  if (srcIdx === -1) return;

  const [moved] = state.voies.splice(srcIdx, 1);

  if (targetValue === '__start__') {
    state.voies.unshift(moved);
  } else {
    const dstIdx = state.voies.findIndex(v => v.id === targetValue);
    state.voies.splice(dstIdx + 1, 0, moved);
  }

  save();
  closeMoveModal();
  renderList();
}

function applyCopy(): void {
  const checked = document.querySelectorAll<HTMLInputElement>('#modal-list input[type="checkbox"]:checked');
  checked.forEach(cb => {
    const voie = state.voies.find(v => v.id === cb.value);
    if (!voie) return;
    voie.commune = modalCommune;
    voie.cp = modalCp;

    // mise à jour DOM directe (évite un re-render complet)
    const li = document.querySelector<HTMLElement>(`.voie-item[data-id="${voie.id}"]`);
    if (li) {
      (li.querySelector<HTMLInputElement>('.field.commune'))!.value = modalCommune;
      (li.querySelector<HTMLInputElement>('.field.cp'))!.value = modalCp;
    }
  });

  save();
  closeCopyModal();
}

// ------- GPS modal -------

let gpsSourceId = '';

export function initGpsModal(): void {
  document.getElementById('gps-modal-close')!.addEventListener('click', closeGpsModal);
  document.getElementById('gps-modal-overlay')!.addEventListener('click', closeGpsModal);
  document.getElementById('gps-btn-save')!.addEventListener('click', applyGps);
  document.getElementById('gps-btn-clear')!.addEventListener('click', clearGps);
  document.getElementById('gps-btn-position')!.addEventListener('click', capturePosition);
}

function openGpsModal(voieId: string): void {
  gpsSourceId = voieId;
  const voie = state.voies.find(v => v.id === voieId)!;

  document.getElementById('gps-modal-info')!.textContent = voie.rue || '(sans nom)';

  const currentEl = document.getElementById('gps-current')!;
  const clearBtn = document.getElementById('gps-btn-clear')!;
  const input = document.getElementById('gps-input') as HTMLInputElement;

  if (voie.lat != null && voie.lng != null) {
    currentEl.textContent = `${voie.lat.toFixed(6)}, ${voie.lng.toFixed(6)}`;
    currentEl.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
    input.value = `${voie.lat.toFixed(6)}, ${voie.lng.toFixed(6)}`;
  } else {
    currentEl.classList.add('hidden');
    clearBtn.classList.add('hidden');
    input.value = '';
  }

  const posBtn = document.getElementById('gps-btn-position') as HTMLButtonElement;
  posBtn.disabled = false;
  posBtn.textContent = '📍 Ma position actuelle';

  document.getElementById('gps-modal')!.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGpsModal(): void {
  document.getElementById('gps-modal')!.classList.add('hidden');
  document.body.style.overflow = '';
}

function capturePosition(): void {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas disponible sur cet appareil.');
    return;
  }

  const posBtn = document.getElementById('gps-btn-position') as HTMLButtonElement;
  posBtn.disabled = true;
  posBtn.textContent = '⏳ Localisation…';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const input = document.getElementById('gps-input') as HTMLInputElement;
      input.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      posBtn.disabled = false;
      posBtn.textContent = '📍 Ma position actuelle';
    },
    () => {
      posBtn.disabled = false;
      posBtn.textContent = '📍 Ma position actuelle';
      alert('Impossible d\'obtenir la position. Vérifiez les permissions de géolocalisation.');
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function applyGps(): void {
  const input = (document.getElementById('gps-input') as HTMLInputElement).value.trim();
  if (!input) { closeGpsModal(); return; }

  const match = input.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    alert('Format invalide. Saisissez les coordonnées sous la forme : 48.8566, 2.3522');
    return;
  }

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert('Coordonnées hors limites (lat : −90..90, lng : −180..180).');
    return;
  }

  const voie = state.voies.find(v => v.id === gpsSourceId);
  if (!voie) return;

  voie.lat = lat;
  voie.lng = lng;
  voie.geoError = undefined;
  save();
  updateManualBadge(gpsSourceId, true);
  closeGpsModal();
}

function clearGps(): void {
  const voie = state.voies.find(v => v.id === gpsSourceId);
  if (!voie) return;

  delete voie.lat;
  delete voie.lng;
  save();
  updateManualBadge(gpsSourceId, false);
  closeGpsModal();
}

function updateManualBadge(voieId: string, hasCoords: boolean): void {
  const li = document.querySelector<HTMLElement>(`.voie-item[data-id="${voieId}"]`);
  if (!li) return;
  li.querySelector('.manual-badge')?.classList.toggle('manual-badge--active', hasCoords);
  const btn = li.querySelector<HTMLElement>('.btn-gps');
  if (btn) btn.classList.toggle('has-coords', hasCoords);
}

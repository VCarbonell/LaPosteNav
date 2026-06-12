import Sortable from 'sortablejs';
import { state, save, Voie } from './state';

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

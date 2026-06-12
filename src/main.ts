import { loadState, reset } from './state';
import { renderList, addVoie, initModal } from './list';
import './style.css';

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
}

init();

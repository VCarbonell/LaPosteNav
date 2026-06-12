import { get, set } from 'idb-keyval';
import { SEED } from './seed';

export interface Voie {
  id: string;
  rue: string;
  commune: string;
  cp: string;
  num: string;
  inclure: boolean;
  lat?: number;   // coordonnées GPS manuelles (priment sur le géocodage)
  lng?: number;
  // champs transients (non persistés) — remis à undefined à chaque calcul
  geoError?: boolean;
}

const KEY = 'tournee-v1';

export const state: { voies: Voie[] } = { voies: [] };

export async function loadState(): Promise<void> {
  const saved = await get<Voie[]>(KEY);
  state.voies = saved ?? makeSeed();
}

export async function save(): Promise<void> {
  await set(KEY, state.voies);
}

export async function reset(): Promise<void> {
  state.voies = makeSeed();
  await save();
}

function makeSeed(): Voie[] {
  return SEED.map(s => ({
    id: crypto.randomUUID(),
    rue: s.rue,
    commune: s.commune,
    cp: s.cp,
    num: s.num,
    inclure: s.inclure !== false,
  }));
}

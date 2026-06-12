export type TransportMode = 'driving-car' | 'cycling-regular' | 'foot-walking';

export function getPitch(): number {
  const v = Number(localStorage.getItem('nav-pitch'));
  return v >= 0 && v <= 60 ? v : 50;
}

export function setPitch(v: number): void {
  localStorage.setItem('nav-pitch', String(Math.max(0, Math.min(60, v))));
}

export function getMode(): TransportMode {
  const v = localStorage.getItem('nav-mode');
  return v === 'cycling-regular' || v === 'foot-walking' ? v : 'driving-car';
}

export function setMode(v: TransportMode): void {
  localStorage.setItem('nav-mode', v);
}

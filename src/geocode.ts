import { get, set } from 'idb-keyval';

const ORS_KEY = import.meta.env.VITE_ORS_KEY as string;
const CACHE_PREFIX = 'geocode-v1-';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Extrait le dernier entier "raisonnable" du champ numéros (ex. "14-12-10-8 · (Garage)" → 8). */
function lastHouseNumber(num: string): number | null {
  const hits = num.match(/\b(\d+)\b/g);
  if (!hits) return null;
  for (let i = hits.length - 1; i >= 0; i--) {
    const n = parseInt(hits[i], 10);
    if (n > 0 && n < 2000) return n;
  }
  return null;
}

export async function geocodeVoie(
  rue: string,
  commune: string,
  cp: string,
  num = '',
): Promise<LatLng | null> {
  const cacheKey = `${CACHE_PREFIX}${rue}|${commune}|${cp}|${num}`;
  const cached = await get<LatLng>(cacheKey);
  if (cached) return cached;

  const houseNum = lastHouseNumber(num);
  const streetPart = houseNum != null ? `${houseNum} ${rue}` : rue;
  const query = [streetPart, commune, cp].filter(Boolean).join(', ');
  if (!query.trim()) return null;

  const url =
    `https://api.openrouteservice.org/geocode/search` +
    `?api_key=${ORS_KEY}` +
    `&text=${encodeURIComponent(query)}` +
    `&boundary.country=FR` +
    `&size=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    const result: LatLng = { lat, lng };
    await set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

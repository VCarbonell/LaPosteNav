import { get, set } from 'idb-keyval';
import type { LatLng } from './geocode';

const ORS_KEY = import.meta.env.VITE_ORS_KEY as string;
const ROUTE_CACHE_KEY = 'route-v1';
const MAX_WAYPOINTS = 49; // ORS limit is 50; keep 49 to allow overlap for chunking

export interface RouteCache {
  fingerprint: string;
  coordinates: [number, number][]; // [lng, lat]
}

function fingerprint(points: LatLng[]): string {
  return points.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
}

async function fetchSegment(
  waypoints: LatLng[],
): Promise<[number, number][] | null> {
  const coordinates = waypoints.map(p => [p.lng, p.lat]);
  try {
    const res = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ORS_KEY,
        },
        body: JSON.stringify({ coordinates }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number][] } }>;
    };
    return data.features?.[0]?.geometry?.coordinates ?? null;
  } catch {
    return null;
  }
}

export async function computeRoute(
  points: LatLng[],
  onProgress?: (done: number, total: number) => void,
): Promise<[number, number][] | null> {
  if (points.length < 2) return null;

  const fp = fingerprint(points);

  // Return cached route if waypoints unchanged
  const cached = await get<RouteCache>(ROUTE_CACHE_KEY);
  if (cached?.fingerprint === fp) return cached.coordinates;

  // Chunk into overlapping segments of MAX_WAYPOINTS
  const chunks: LatLng[][] = [];
  for (let i = 0; i < points.length - 1; i += MAX_WAYPOINTS - 1) {
    chunks.push(points.slice(i, i + MAX_WAYPOINTS));
    if (chunks[chunks.length - 1].length < 2) {
      chunks.pop();
      break;
    }
  }

  const allCoords: [number, number][] = [];
  for (let i = 0; i < chunks.length; i++) {
    const segCoords = await fetchSegment(chunks[i]);
    if (!segCoords) return null;
    // Skip the first point of subsequent segments to avoid duplication
    const slice = i === 0 ? segCoords : segCoords.slice(1);
    allCoords.push(...slice);
    onProgress?.(i + 1, chunks.length);
  }

  await set(ROUTE_CACHE_KEY, { fingerprint: fp, coordinates: allCoords });
  return allCoords;
}

export function routeToGeoJSON(
  coordinates: [number, number][],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {},
      },
    ],
  };
}

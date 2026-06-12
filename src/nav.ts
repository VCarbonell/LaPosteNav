import type maplibregl from 'maplibre-gl';

export type TrackingChangeCallback = (active: boolean) => void;

let watchId: number | null = null;
let navActive = false;
let tracking = false;
let navPitch = 50;
let mapRef: maplibregl.Map | null = null;
let onTrackingChange: TrackingChangeCallback | null = null;

// Last known position
let lastLat: number | null = null;
let lastLng: number | null = null;

// Heading sources
let lastGpsHeading: number | null = null;
let lastCompassHeading: number | null = null;

// Low-pass smoothed heading
let smoothedHeading = 0;
const ALPHA = 0.15;

function smoothHeading(raw: number): number {
  let diff = raw - smoothedHeading;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  smoothedHeading = (smoothedHeading + ALPHA * diff + 360) % 360;
  return smoothedHeading;
}

function getActiveRawHeading(): number {
  // GPS heading has priority; fallback to compass when GPS returns null (stopped)
  return lastGpsHeading ?? lastCompassHeading ?? smoothedHeading;
}

function updateCamera(lat: number, lng: number, bearing: number): void {
  if (!mapRef || !tracking) return;
  mapRef.easeTo({
    center: [lng, lat],
    bearing,
    pitch: navPitch,
    zoom: 17,
    duration: 300,
  });
}

function handlePosition(pos: GeolocationPosition): void {
  const { latitude: lat, longitude: lng, heading } = pos.coords;
  lastLat = lat;
  lastLng = lng;
  lastGpsHeading = heading; // null when stationary
  updateCamera(lat, lng, smoothHeading(getActiveRawHeading()));
}

let orientationRafId: number | null = null;

function handleOrientation(e: DeviceOrientationEvent): void {
  if (!navActive || lastLat === null) return;
  // webkitCompassHeading on iOS (0–360, clockwise from north)
  // alpha on Android (degrees, anti-clockwise → convert)
  const raw =
    (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading ??
    (e.alpha !== null ? (360 - e.alpha) % 360 : null);
  if (raw === null) return;
  lastCompassHeading = raw;

  // Only use compass to update camera when GPS is not providing heading
  if (lastGpsHeading !== null) return;

  if (orientationRafId !== null) return;
  orientationRafId = requestAnimationFrame(() => {
    orientationRafId = null;
    if (lastLat === null || lastLng === null) return;
    updateCamera(lastLat, lastLng, smoothHeading(getActiveRawHeading()));
  });
}

async function requestCompassPermission(): Promise<boolean> {
  type DOEWithPerm = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<string>;
  };
  const DOE = DeviceOrientationEvent as DOEWithPerm;
  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true; // Android / desktop: no permission needed
}

function setTracking(active: boolean): void {
  if (tracking === active) return;
  tracking = active;
  onTrackingChange?.(active);
}

const onDragStart = () => setTracking(false);

export function setOnTrackingChange(cb: TrackingChangeCallback): void {
  onTrackingChange = cb;
}

export async function startNavigation(
  map: maplibregl.Map,
  pitch: number,
): Promise<void> {
  if (navActive) return;
  navActive = true;
  mapRef = map;
  navPitch = pitch;
  tracking = true;

  map.on('dragstart', onDragStart);

  watchId = navigator.geolocation.watchPosition(
    handlePosition,
    err => console.warn('GPS:', err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
  );

  const granted = await requestCompassPermission();
  if (granted) {
    window.addEventListener('deviceorientation', handleOrientation);
  }

  onTrackingChange?.(true);
}

export function stopNavigation(): void {
  if (!navActive) return;
  navActive = false;
  tracking = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  window.removeEventListener('deviceorientation', handleOrientation);

  if (mapRef) {
    mapRef.off('dragstart', onDragStart);
    mapRef = null;
  }

  lastLat = null;
  lastLng = null;
  lastGpsHeading = null;
}

export function recenter(): void {
  setTracking(true);
  if (lastLat !== null && lastLng !== null) {
    updateCamera(lastLat, lastLng, smoothedHeading);
  }
}

export function isNavActive(): boolean {
  return navActive;
}

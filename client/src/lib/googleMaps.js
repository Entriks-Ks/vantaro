const API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const MAP_ID = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID').trim();

/** Approximate bounding box for Germany (mainland). Keeps AT/CH mostly out of view. */
export const GERMANY_BOUNDS = {
  north: 55.06,
  south: 47.32,
  west: 5.87,
  east: 14.95,
};

export const GERMANY_CENTER = { lat: 51.1657, lng: 10.4515 };

/** Cloud-based map style id — required for AdvancedMarkerElement. */
export const GOOGLE_MAP_ID = MAP_ID || 'DEMO_MAP_ID';

export function isInGermany(lat, lng) {
  return (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= GERMANY_BOUNDS.south
    && lat <= GERMANY_BOUNDS.north
    && lng >= GERMANY_BOUNDS.west
    && lng <= GERMANY_BOUNDS.east
  );
}

let loadPromise = null;
let geocodeLoadPromise = null;
let authFailed = false;

export function hasGoogleMapsKey() {
  return Boolean(API_KEY);
}

export function didGoogleMapsAuthFail() {
  return authFailed;
}

export function coordsFrom(position) {
  if (!position) return null;
  const lat = typeof position.lat === 'function' ? position.lat() : Number(position.lat);
  const lng = typeof position.lng === 'function' ? position.lng() : Number(position.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Maps JS bundles web-vitals and can throw
 * "Cannot read properties of undefined (reading 'startTime')" from reportAllChanges.
 * That crash is internal telemetry and does not affect the map.
 */
function ignoreMapsWebVitalsCrash() {
  if (window.__vantaroMapsStartTimeGuard) return;
  window.__vantaroMapsStartTimeGuard = true;
  const suppress = (event) => {
    const message = String(event?.message || event?.error?.message || '');
    if (!message.includes("reading 'startTime'")) return false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    return true;
  };
  window.addEventListener('error', suppress, true);
  const previous = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (suppress({ message, error })) return true;
    if (typeof previous === 'function') return previous(message, source, lineno, colno, error);
    return false;
  };
}

function ensureMapsBootstrap() {
  if (window.google?.maps?.importLibrary) return;

  const options = {
    key: API_KEY,
    v: 'weekly',
    language: 'de',
    region: 'DE',
  };

  let loader = null;
  const googleNs = (window.google = window.google || {});
  const mapsNs = (googleNs.maps = googleNs.maps || {});
  const pending = new Set();

  mapsNs.importLibrary = (name) => {
    pending.add(name);
    loader ||= new Promise((resolve, reject) => {
      window.gm_authFailure = () => {
        authFailed = true;
        loadPromise = null;
        reject(new Error(
          'Google Maps: API-Schlüssel ungültig oder APIs nicht aktiviert (Maps JavaScript, Places API (New), Geocoding).',
        ));
      };

      const start = async () => {
        await Promise.resolve();
        const params = new URLSearchParams(options);
        params.set('libraries', [...pending].join(','));
        params.set('callback', 'google.maps.__ib__');
        mapsNs.__ib__ = resolve;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.async = true;
        script.onerror = () => reject(new Error('Google Maps Script konnte nicht geladen werden.'));
        document.head.appendChild(script);
      };

      start().catch(reject);
    });

    return loader.then(() => window.google.maps.importLibrary(name));
  };
}

async function importMapsLibraries() {
  const maps = window.google?.maps;
  if (!maps?.importLibrary) {
    throw new Error('Google Maps konnte nicht geladen werden.');
  }
  await Promise.all([
    maps.importLibrary('maps'),
    maps.importLibrary('places'),
    maps.importLibrary('marker'),
  ]);
  if (!window.google?.maps?.places || !window.google?.maps?.marker) {
    throw new Error('Google Places- oder Marker-Bibliothek nicht geladen.');
  }
  return window.google.maps;
}

export function loadGoogleMaps() {
  if (!API_KEY) {
    return Promise.reject(new Error('Google-Maps-Schlüssel fehlt.'));
  }

  if (authFailed) {
    return Promise.reject(new Error('Google Maps API-Schlüssel abgelehnt'));
  }

  if (window.google?.maps?.places?.PlaceAutocompleteElement && window.google?.maps?.marker) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  ignoreMapsWebVitalsCrash();
  ensureMapsBootstrap();

  loadPromise = importMapsLibraries().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

/** Load only the Geocoder — do not pull Places/Marker into the page. */
export function loadGoogleGeocoding() {
  if (!API_KEY) {
    return Promise.reject(new Error('Google-Maps-Schlüssel fehlt.'));
  }
  if (authFailed) {
    return Promise.reject(new Error('Google Maps API-Schlüssel abgelehnt'));
  }
  if (window.google?.maps?.Geocoder) {
    return Promise.resolve(window.google.maps);
  }
  if (geocodeLoadPromise) return geocodeLoadPromise;

  ignoreMapsWebVitalsCrash();
  ensureMapsBootstrap();

  geocodeLoadPromise = window.google.maps.importLibrary('geocoding')
    .then(() => window.google.maps)
    .catch(async () => {
      // Older bundles expose Geocoder via the maps library.
      await window.google.maps.importLibrary('maps');
      return window.google.maps;
    })
    .catch((error) => {
      geocodeLoadPromise = null;
      throw error;
    });

  return geocodeLoadPromise;
}

function addressPart(components, type, useShort = false) {
  const part = (components || []).find((entry) => (entry.types || []).includes(type));
  if (!part) return '';
  if (useShort) return part.shortText || part.short_name || '';
  return part.longText || part.long_name || '';
}

export function getCountryCode(place) {
  const parts = place?.addressComponents || place?.address_components || [];
  return addressPart(parts, 'country', true).toUpperCase();
}

export function parsePlaceAddress(place) {
  const parts = place?.addressComponents || place?.address_components || [];
  const route = addressPart(parts, 'route');
  const number = addressPart(parts, 'street_number');
  const zip = addressPart(parts, 'postal_code');
  const city =
    addressPart(parts, 'locality')
    || addressPart(parts, 'postal_town')
    || addressPart(parts, 'sublocality_level_1')
    || addressPart(parts, 'administrative_area_level_3');

  const location = place?.location || place?.geometry?.location;
  const coords = coordsFrom(location);
  const country = getCountryCode(place);
  const displayName = String(place?.displayName || place?.name || '').trim();

  // City-only pick (e.g. "Augsburg"): keep street empty so user can refine
  const street = [route, number].filter(Boolean).join(' ');

  return {
    street,
    zip,
    city: city || (street ? '' : displayName),
    country,
    inGermany: country === 'DE',
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
}

export async function placeFromPrediction(placePrediction) {
  const place = placePrediction?.toPlace?.();
  if (!place?.fetchFields) return parsePlaceAddress(placePrediction);
  await place.fetchFields({
    fields: ['addressComponents', 'formattedAddress', 'location', 'displayName'],
  });
  return parsePlaceAddress(place);
}

/** Geocode a free-text German address to lat/lng. */
export async function geocodeAddress(query) {
  const text = String(query || '').trim();
  if (!text || !hasGoogleMapsKey()) return null;

  const maps = await loadGoogleGeocoding();
  const geocoder = new maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { address: text, componentRestrictions: { country: 'DE' }, language: 'de' },
      (results, status) => {
        if (status === 'REQUEST_DENIED') {
          reject(new Error('Geocoding API ist nicht aktiviert oder der Schlüssel ist eingeschränkt.'));
          return;
        }
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve(coordsFrom(results[0].geometry.location));
      },
    );
  });
}

/** Reverse-geocode a map click into street / zip / city (Germany only). */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !hasGoogleMapsKey()) return null;

  const maps = await loadGoogleGeocoding();
  const geocoder = new maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { location: { lat, lng }, language: 'de' },
      (results, status) => {
        if (status === 'REQUEST_DENIED') {
          reject(new Error('Geocoding API ist nicht aktiviert oder der Schlüssel ist eingeschränkt.'));
          return;
        }
        if (status !== 'OK' || !results?.length) {
          resolve(null);
          return;
        }

        const german = results.find((result) => getCountryCode(result) === 'DE');
        if (!german) {
          const other = parsePlaceAddress(results[0]);
          resolve({ ...other, inGermany: false });
          return;
        }

        resolve(parsePlaceAddress(german));
      },
    );
  });
}

const geocodeCache = new Map();

/** Build a Germany-scoped address query from street/zip/city parts. */
export function germanyAddressQuery(parts) {
  const street = String(parts?.street || '').trim();
  const zip = String(parts?.zip || '').trim();
  const city = String(parts?.city || '').trim();
  const locality = [zip, city].filter(Boolean).join(' ');
  const line = [street, locality].filter(Boolean).join(', ');
  return line ? `${line}, Deutschland` : '';
}

/** Great-circle distance in km between two { lat, lng } points. */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function roundDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 10) return Math.round(km * 10) / 10;
  return Math.round(km);
}

/** Geocode with in-memory cache (dedupes in-flight requests). */
export async function cachedGeocodeAddress(query) {
  const key = String(query || '').trim().toLowerCase();
  if (!key || !hasGoogleMapsKey()) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const pending = geocodeAddress(query)
    .catch(() => null)
    .then((coords) => {
      geocodeCache.set(key, Promise.resolve(coords));
      return coords;
    });
  geocodeCache.set(key, pending);
  return pending;
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function zipProximityRank(lead, origin) {
  const cityLead = String(lead?.city || '').trim().toLowerCase();
  const cityOrigin = String(origin?.city || '').trim().toLowerCase();
  const zipLead = String(lead?.zip || '').replace(/\D/g, '');
  const zipOrigin = String(origin?.zip || '').replace(/\D/g, '');
  const sameCity = cityLead && cityOrigin && cityLead === cityOrigin ? 0 : 1;
  const samePrefix = zipLead.slice(0, 2) && zipLead.slice(0, 2) === zipOrigin.slice(0, 2) ? 0 : 1;
  const leadNum = Number(zipLead.slice(0, 5));
  const originNum = Number(zipOrigin.slice(0, 5));
  const delta = Number.isFinite(leadNum) && Number.isFinite(originNum)
    ? Math.abs(leadNum - originNum)
    : 99999;
  return sameCity * 1_000_000 + samePrefix * 100_000 + delta;
}

/**
 * Sort leads by distance to an origin address (street/zip/city).
 * Uses Google Geocoding when available; otherwise PLZ/city proximity.
 */
export async function sortLeadsByProximity(leads, originAddress) {
  const list = Array.isArray(leads) ? [...leads] : [];
  const originQuery = germanyAddressQuery(originAddress);
  const originLabel = [originAddress?.street, [originAddress?.zip, originAddress?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  if (!list.length || !originQuery) {
    return { leads: list, sorted: false, mode: null, originLabel, origin: null };
  }

  if (hasGoogleMapsKey()) {
    try {
      const origin = await cachedGeocodeAddress(originQuery);
      if (origin) {
        const enriched = await mapPool(list, 4, async (lead) => {
          const leadQuery = germanyAddressQuery(lead);
          const coords = leadQuery ? await cachedGeocodeAddress(leadQuery) : null;
          return {
            ...lead,
            distanceKm: coords ? roundDistanceKm(haversineKm(origin, coords)) : null,
          };
        });
        enriched.sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) return 0;
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
        return { leads: enriched, sorted: true, mode: 'geo', originLabel, origin };
      }
    } catch {
      /* fall through to ZIP proximity */
    }
  }

  const ranked = list.map((lead) => ({
    ...lead,
    distanceKm: null,
    _zipRank: zipProximityRank(lead, originAddress),
  }));
  ranked.sort((a, b) => a._zipRank - b._zipRank);
  return {
    leads: ranked.map(({ _zipRank, ...lead }) => lead),
    sorted: true,
    mode: 'zip',
    originLabel,
    origin: null,
  };
}

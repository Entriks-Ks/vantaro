const API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

/** Approximate bounding box for Germany (mainland). Keeps AT/CH mostly out of view. */
export const GERMANY_BOUNDS = {
  north: 55.06,
  south: 47.32,
  west: 5.87,
  east: 14.95,
};

export const GERMANY_CENTER = { lat: 51.1657, lng: 10.4515 };

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
let authFailed = false;

export function hasGoogleMapsKey() {
  return Boolean(API_KEY);
}

export function didGoogleMapsAuthFail() {
  return authFailed;
}

export function loadGoogleMaps() {
  if (!API_KEY) {
    return Promise.reject(new Error('Google-Maps-Schlüssel fehlt.'));
  }

  if (authFailed) {
    return Promise.reject(new Error('Google Maps API-Schlüssel abgelehnt'));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const fail = (message) => {
      authFailed = true;
      loadPromise = null;
      reject(new Error(message));
    };

    window.gm_authFailure = () => {
      fail(
        'Google Maps: API-Schlüssel ungültig oder APIs nicht aktiviert (Maps JavaScript, Places, Geocoding).',
      );
    };

    const callbackName = '__vantaroGoogleMapsInit';
    window[callbackName] = () => {
      delete window[callbackName];
      if (!window.google?.maps?.places) {
        fail('Google Places-Bibliothek nicht geladen. Places API aktivieren.');
        return;
      }
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places&language=de&region=DE&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[callbackName];
      fail('Google Maps Script konnte nicht geladen werden.');
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

function addressPart(components, type, useShort = false) {
  const part = components.find((entry) => entry.types.includes(type));
  if (!part) return '';
  return useShort ? part.short_name : part.long_name;
}

export function getCountryCode(place) {
  return addressPart(place?.address_components || [], 'country', true).toUpperCase();
}

export function parsePlaceAddress(place) {
  const parts = place?.address_components || [];
  const route = addressPart(parts, 'route');
  const number = addressPart(parts, 'street_number');
  const zip = addressPart(parts, 'postal_code');
  const city =
    addressPart(parts, 'locality')
    || addressPart(parts, 'postal_town')
    || addressPart(parts, 'sublocality_level_1')
    || addressPart(parts, 'administrative_area_level_3');

  const location = place?.geometry?.location;
  const lat = location ? location.lat() : null;
  const lng = location ? location.lng() : null;
  const country = getCountryCode(place);

  // City-only pick (e.g. "Augsburg"): keep street empty so user can refine
  const street = [route, number].filter(Boolean).join(' ');

  return {
    street,
    zip,
    city: city || (street ? '' : String(place?.name || '').trim()),
    country,
    inGermany: country === 'DE',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

/** Geocode a free-text German address to lat/lng. */
export async function geocodeAddress(query) {
  const text = String(query || '').trim();
  if (!text || !hasGoogleMapsKey()) return null;

  const maps = await loadGoogleMaps();
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
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      },
    );
  });
}

/** Reverse-geocode a map click into street / zip / city (Germany only). */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !hasGoogleMapsKey()) return null;

  const maps = await loadGoogleMaps();
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

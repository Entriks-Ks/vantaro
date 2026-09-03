import { useEffect, useRef, useState } from 'react';
import {
  GERMANY_BOUNDS,
  GERMANY_CENTER,
  GOOGLE_MAP_ID,
  coordsFrom,
  hasGoogleMapsKey,
  isInGermany,
  loadGoogleMaps,
} from '../lib/googleMaps';

const PIN_ZOOM = 15;
const MIN_ZOOM = 5;
const MAX_ZOOM = 19;

/**
 * Google Map for Geschäftsadresse — Germany-focused viewport.
 * Shows pin and supports click / drag within Germany.
 */
export default function AddressMap({
  lat = null,
  lng = null,
  onMapClick,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) {
      setStatus('error');
      setError('Kein Google-Maps-API-Schlüssel (VITE_GOOGLE_MAPS_API_KEY).');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;

        const germanyBox = new maps.LatLngBounds(
          { lat: GERMANY_BOUNDS.south, lng: GERMANY_BOUNDS.west },
          { lat: GERMANY_BOUNDS.north, lng: GERMANY_BOUNDS.east },
        );

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: GERMANY_CENTER,
            zoom: MIN_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            mapId: GOOGLE_MAP_ID,
            restriction: {
              latLngBounds: germanyBox,
              strictBounds: true,
            },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
          });

          mapRef.current.fitBounds(germanyBox, 24);

          mapRef.current.addListener('click', (event) => {
            const clicked = event?.latLng;
            if (!clicked) return;
            const next = coordsFrom(clicked);
            if (!next || !isInGermany(next.lat, next.lng)) return;
            onMapClickRef.current?.(next);
          });
        }

        setStatus('ready');

        const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && isInGermany(lat, lng);
        if (!hasPin) {
          if (markerRef.current) {
            markerRef.current.map = null;
            markerRef.current = null;
          }
          mapRef.current.fitBounds(germanyBox, 24);
          return;
        }

        const position = { lat, lng };
        if (!markerRef.current) {
          const { AdvancedMarkerElement, PinElement } = maps.marker || {};
          if (!AdvancedMarkerElement) {
            throw new Error('AdvancedMarkerElement nicht verfügbar.');
          }
          markerRef.current = new AdvancedMarkerElement({
            map: mapRef.current,
            position,
            gmpDraggable: true,
            title: 'Geschäftsadresse',
          });
          if (PinElement) {
            try {
              markerRef.current.replaceChildren(new PinElement({
                background: '#56d3c4',
                borderColor: '#1f8a7d',
                glyphColor: '#0b1220',
              }));
            } catch {
              /* keep default pin */
            }
          }
          markerRef.current.addListener('dragend', () => {
            const next = coordsFrom(markerRef.current?.position);
            if (!next) return;
            if (!isInGermany(next.lat, next.lng)) {
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                markerRef.current.position = { lat, lng };
              }
              return;
            }
            onMapClickRef.current?.(next);
          });
        } else {
          markerRef.current.position = position;
          markerRef.current.map = mapRef.current;
        }

        mapRef.current.panTo(position);
        if (mapRef.current.getZoom() < 12) mapRef.current.setZoom(PIN_ZOOM);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        const msg = String(err?.message || '');
        if (/abgelehnt|ungültig|nicht aktiviert|Auth/i.test(msg)) {
          setError('Kartensuche vorübergehend nicht verfügbar — Adresse bitte manuell eintragen.');
          return;
        }
        setError(msg || 'Karte konnte nicht geladen werden.');
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (!hasGoogleMapsKey()) {
    return (
      <div className={`broker-address-map is-error ${className}`.trim()}>
        <p className="broker-address-map__hint">
          Maps-Schlüssel fehlt in <code>client/.env</code> (
          <code>VITE_GOOGLE_MAPS_API_KEY</code>).
        </p>
      </div>
    );
  }

  return (
    <div className={`broker-address-map ${status === 'error' ? 'is-error' : ''} ${className}`.trim()}>
      <div
        ref={containerRef}
        className="broker-address-map__canvas"
        role="img"
        aria-label={
          Number.isFinite(lat) && Number.isFinite(lng)
            ? 'Karte der Geschäftsadresse in Deutschland'
            : 'Deutschlandkarte — Stadt oder Straße suchen'
        }
      />
      {status === 'loading' ? (
        <p className="broker-address-map__hint">Karte wird geladen…</p>
      ) : null}
      {status === 'ready' && !(Number.isFinite(lat) && Number.isFinite(lng)) ? (
        <p className="broker-address-map__hint">
          z. B. „Augsburg“ oder „Maximilianstraße Augsburg“ tippen — oder auf die Karte klicken.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="broker-address-map__hint is-error-text">{error}</p>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  GERMANY_BOUNDS,
  GERMANY_CENTER,
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
            const next = { lat: clicked.lat(), lng: clicked.lng() };
            if (!isInGermany(next.lat, next.lng)) return;
            onMapClickRef.current?.(next);
          });
        }

        setStatus('ready');

        const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && isInGermany(lat, lng);
        if (!hasPin) {
          if (markerRef.current) {
            markerRef.current.setMap(null);
            markerRef.current = null;
          }
          mapRef.current.fitBounds(germanyBox, 24);
          return;
        }

        const position = { lat, lng };
        if (!markerRef.current) {
          markerRef.current = new maps.Marker({
            map: mapRef.current,
            position,
            draggable: true,
            title: 'Geschäftsadresse',
          });
          markerRef.current.addListener('dragend', () => {
            const pos = markerRef.current.getPosition();
            if (!pos) return;
            const next = { lat: pos.lat(), lng: pos.lng() };
            if (!isInGermany(next.lat, next.lng)) {
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                markerRef.current.setPosition({ lat, lng });
              }
              return;
            }
            onMapClickRef.current?.(next);
          });
        } else {
          markerRef.current.setPosition(position);
          markerRef.current.setMap(mapRef.current);
        }

        mapRef.current.panTo(position);
        if (mapRef.current.getZoom() < 12) mapRef.current.setZoom(PIN_ZOOM);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'Karte konnte nicht geladen werden.');
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

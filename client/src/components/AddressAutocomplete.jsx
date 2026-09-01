import { useEffect, useRef } from 'react';
import {
  GERMANY_BOUNDS,
  hasGoogleMapsKey,
  loadGoogleMaps,
  parsePlaceAddress,
} from '../lib/googleMaps';

/**
 * Street input with Google Places Autocomplete (DE only).
 * Falls back to a normal input when no API key is set.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  name = 'street',
  disabled = false,
  required = false,
  placeholder = 'Adresse suchen oder eingeben',
  autoComplete = 'street-address',
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!hasGoogleMapsKey() || disabled) return undefined;

    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !inputRef.current || autocompleteRef.current) return;

        const autocomplete = new maps.places.Autocomplete(inputRef.current, {
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          // geocode = streets + cities/PLZ (not only Hausnummern)
          types: ['geocode'],
          componentRestrictions: { country: 'de' },
          bounds: new maps.LatLngBounds(
            { lat: GERMANY_BOUNDS.south, lng: GERMANY_BOUNDS.west },
            { lat: GERMANY_BOUNDS.north, lng: GERMANY_BOUNDS.east },
          ),
        });

        autocomplete.addListener('place_changed', () => {
          const parsed = parsePlaceAddress(autocomplete.getPlace());
          onPlaceSelectRef.current?.(parsed);
        });

        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        /* Keep plain input usable without Maps */
      });

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [disabled]);

  return (
    <input
      ref={inputRef}
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
    />
  );
}

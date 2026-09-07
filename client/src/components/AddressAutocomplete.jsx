import { useEffect, useRef, useState } from 'react';
import {
  GERMANY_BOUNDS,
  hasGoogleMapsKey,
  loadGoogleMaps,
  placeFromPrediction,
} from '../lib/googleMaps';

/**
 * Street input with PlaceAutocompleteElement (DE only).
 * Falls back to a normal input when Maps is unavailable.
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
  const hostRef = useRef(null);
  const widgetRef = useRef(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) return undefined;

    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !hostRef.current || widgetRef.current) return;
        if (!maps.places?.PlaceAutocompleteElement) {
          throw new Error('PlaceAutocompleteElement nicht verfügbar.');
        }

        const widget = new maps.places.PlaceAutocompleteElement({
          includedRegionCodes: ['de'],
          requestedLanguage: 'de',
          requestedRegion: 'de',
          locationBias: GERMANY_BOUNDS,
          placeholder,
          name,
          value: valueRef.current || '',
          noInputIcon: true,
        });

        const onSelect = async (event) => {
          const parsed = await placeFromPrediction(event.placePrediction);
          onPlaceSelectRef.current?.(parsed);
        };

        const onInput = () => {
          onChangeRef.current?.(widget.value || '');
        };

        const onError = () => {
          widget.remove();
          if (widgetRef.current === widget) widgetRef.current = null;
          if (!cancelled) setWidgetReady(false);
        };

        widget.addEventListener('gmp-select', onSelect);
        widget.addEventListener('input', onInput);
        widget.addEventListener('gmp-error', onError);
        hostRef.current.appendChild(widget);
        widgetRef.current = widget;
        setWidgetReady(true);
      })
      .catch(() => {
        if (!cancelled) setWidgetReady(false);
      });

    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      if (widget) {
        widget.remove();
        widgetRef.current = null;
      }
      setWidgetReady(false);
    };
  }, [name, placeholder]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    if ((widget.value || '') !== (value || '')) {
      widget.value = value || '';
    }
    widget.disabled = disabled;
  }, [disabled, value, widgetReady]);

  return (
    <div className="broker-place-autocomplete">
      <div ref={hostRef} className="broker-place-autocomplete__widget" />
      {widgetReady ? null : (
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      )}
    </div>
  );
}

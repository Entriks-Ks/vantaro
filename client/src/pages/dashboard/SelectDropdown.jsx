import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function useDropdownDismiss(open, setOpen, wrapRef) {
  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen, wrapRef]);
}

export function SelectDropdown({ label, icon: FallbackIcon, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = options.find((option) => option.id === value) || options[0];
  const TriggerIcon = current.icon || FallbackIcon;
  const hiddenAlert = options.some((option) => option.alert && option.id !== current.id);

  useDropdownDismiss(open, setOpen, wrapRef);

  return (
    <div className="broker-filter-dd broker-select-dd" ref={wrapRef}>
      <button
        type="button"
        className={`broker-filter-dd__trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        {TriggerIcon ? <TriggerIcon size={15} strokeWidth={2.1} aria-hidden="true" /> : null}
        <span className="broker-filter-dd__label">{label}</span>
        <span className="broker-filter-dd__value">{current.label}</span>
        {hiddenAlert ? <span className="broker-select-dd__dot" aria-label="Handlungsbedarf" /> : null}
        <ChevronDown size={14} className={`broker-filter-dd__chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="broker-filter-dd__panel broker-select-dd__panel" role="listbox" aria-label={label}>
          {options.map((option) => {
            const selected = option.id === current.id;
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`broker-select-dd__option${selected ? ' is-selected' : ''}`}
                title={option.title}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <span className="broker-select-dd__icon" aria-hidden="true">
                  {OptionIcon ? <OptionIcon size={15} strokeWidth={2.1} /> : null}
                </span>
                <span className="broker-filter-dd__text">{option.label}</span>
                {option.count != null ? (
                  <span className={`broker-filter-dd__count${option.alert ? ' is-alert' : ''}`}>{option.count}</span>
                ) : <span />}
                <span className="broker-select-dd__check" aria-hidden="true">
                  {selected ? <Check size={14} strokeWidth={2.6} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

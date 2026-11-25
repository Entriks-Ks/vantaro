import { L } from '../lib/i18n';

export default function BootScreen({ caption = L('Wird geladen', 'Loading') }) {
  return (
    <div className="preloader preloader--embed" role="status" aria-live="polite" aria-label={`VANTARO ${caption}`}>
      <span className="loader" aria-hidden="true" />
    </div>
  );
}

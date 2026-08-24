export default function BootScreen({ caption = 'wird geladen' }) {
  return (
    <div className="preloader preloader--embed" role="status" aria-live="polite" aria-label={`VANTARO ${caption}`}>
      <span className="loader" aria-hidden="true" />
    </div>
  );
}

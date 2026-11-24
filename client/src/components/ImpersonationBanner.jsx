import { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { endImpersonation, readImpersonation } from '../lib/impersonation';

/** Always-visible strip while IT Support is signed in as a customer. */
export default function ImpersonationBanner() {
  const [state] = useState(() => readImpersonation());
  const [leaving, setLeaving] = useState(false);
  if (!state) return null;

  const who = state.target.fullName
    ? `${state.target.fullName} (${state.target.email})`
    : state.target.email;

  const leave = async () => {
    setLeaving(true);
    await endImpersonation();
  };

  return (
    <div className="impersonation-banner" role="status">
      <ShieldAlert size={17} strokeWidth={2.2} aria-hidden="true" />
      <span>
        Support-Sitzung: Sie sind als <strong>{who}</strong> angemeldet. Alles, was Sie tun, geschieht im Konto des Kunden.
      </span>
      <button type="button" onClick={leave} disabled={leaving}>
        <LogOut size={15} aria-hidden="true" />
        {leaving ? 'Wird beendet…' : 'Zurück zur IT-Support-Konsole'}
      </button>
    </div>
  );
}

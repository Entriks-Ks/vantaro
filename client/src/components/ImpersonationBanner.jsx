import { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { endImpersonation, readImpersonation } from '../lib/impersonation';
import { L } from '../lib/i18n';

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
        {L('Support-Sitzung: Sie sind als', 'Support session: you are signed in as')} <strong>{who}</strong>{L(' angemeldet. Alles, was Sie tun, geschieht im Konto des Kunden.', ". Everything you do happens in the customer's account.")}
      </span>
      <button type="button" onClick={leave} disabled={leaving}>
        <LogOut size={15} aria-hidden="true" />
        {leaving ? L('Wird beendet…', 'Ending…') : L('Zurück zur IT-Support-Konsole', 'Back to the IT Support console')}
      </button>
    </div>
  );
}

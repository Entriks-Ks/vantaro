import LegalLayout from './LegalLayout';
import { COMPLAINT_REASON_OPTIONS, ENERGY_COMPLAINT_REASONS } from '../lib/complaints';

// Bump CHECKOUT_TERMS_VERSION in server/src/lib/payments.js when this page changes materially.
export default function Erstattung() {
  return (
    <LegalLayout active="erstattung">
      <h1>Erstattungsrichtlinie</h1>
      <p className="legal-lede">
        Wann Sie für gekaufte Leads und Termine eine Gutschrift, eine
        Ersatzlieferung oder eine Rückerstattung erhalten und wie Sie diese
        beantragen. Diese Richtlinie ist Bestandteil unserer{' '}
        <a href="#agb">AGB</a>.
      </p>

      <h2>1. Kein Widerrufsrecht</h2>
      <p>
        VANTARO verkauft ausschließlich an Unternehmer. Das gesetzliche
        Widerrufsrecht für Verbraucher gilt daher nicht. Erstattungen erfolgen
        nach den folgenden Regeln.
      </p>

      <h2>2. Stornierung vor Lieferbeginn</h2>
      <p>
        Solange aus einer bezahlten Bestellung noch kein Lead und kein Termin
        geliefert wurde, können Sie die Bestellung per E-Mail an{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a> unter Angabe der
        Rechnungsnummer stornieren. Sie erhalten dann den vollen gezahlten Betrag
        zurück.
      </p>

      <h2>3. Reklamation einzelner Leads und Termine</h2>
      <p>
        Gelieferte Leads und Termine können Sie im Portal über
        „Reklamation“ melden. Akzeptiert werden folgende Gründe:
      </p>
      <h3>Versicherung (PKV)</h3>
      <ul>
        {COMPLAINT_REASON_OPTIONS.map((reason) => (
          <li key={reason.id}>
            <strong>{reason.label}:</strong> {reason.hint}
          </li>
        ))}
      </ul>
      <h3>Energie (Photovoltaik und Wärmepumpe)</h3>
      <ul>
        {ENERGY_COMPLAINT_REASONS.map((reason) => (
          <li key={reason.id}>
            <strong>{reason.label}:</strong> {reason.hint}
          </li>
        ))}
      </ul>
      <p>
        Bitte reklamieren Sie unverzüglich, spätestens 14 Tage nach der
        Lieferung, mit einer nachvollziehbaren Begründung und, wenn vorhanden,
        einem Nachweis (z. B. Screenshot oder Anrufprotokoll). Andere Gründe,
        etwa fehlendes Interesse oder kein Vertragsabschluss, berechtigen nicht zu
        einer Gutschrift.
      </p>

      <h2>4. Prüfung und Entscheidung</h2>
      <p>
        VANTARO prüft jede Reklamation und dokumentiert die Entscheidung im
        Portal:
      </p>
      <ul>
        <li>
          <strong>Anerkannt:</strong> Gutschrift des vollen Preises des
          betroffenen Leads bzw. Termins.
        </li>
        <li>
          <strong>Teilweise anerkannt:</strong> anteilige Gutschrift.
        </li>
        <li>
          <strong>Rückfrage:</strong> Wir benötigen weitere Angaben; die
          Reklamation bleibt offen, bis diese vorliegen.
        </li>
        <li>
          <strong>Abgelehnt:</strong> mit Begründung, die Sie im Portal sehen.
        </li>
      </ul>

      <h2>5. Form der Erstattung</h2>
      <p>
        Gutschriften werden vorrangig durch eine Ersatzlieferung ausgeglichen
        (Ersatzlead bzw. Ersatztermin in derselben Bestellung). Ist eine
        Ersatzlieferung nicht möglich oder bleibt nach Abschluss der Bestellung
        ein Guthaben, erstatten wir den Betrag auf Wunsch zurück.
      </p>
      <p>
        Rückerstattungen erfolgen ausschließlich auf die Kreditkarte, mit der
        bezahlt wurde, über die ProCredit Bank. Wir veranlassen die Erstattung
        innerhalb von 14 Tagen nach der Entscheidung bzw. Stornierung. Wann der
        Betrag auf Ihrer Kartenabrechnung erscheint, hängt von Ihrer
        kartenausgebenden Bank ab (in der Regel 5 bis 10 Bankarbeitstage).
        Barauszahlungen oder Erstattungen auf andere Konten sind nicht möglich.
      </p>

      <h2>6. Fehlerhafte Belastungen</h2>
      <p>
        Wurde Ihre Karte doppelt oder mit einem falschen Betrag belastet, melden
        Sie sich bitte umgehend unter{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>. Zu Unrecht
        belastete Beträge erstatten wir vollständig.
      </p>

      <h2>7. Kontakt</h2>
      <p>
        Fragen zu Erstattungen und Reklamationen richten Sie bitte unter Angabe
        der Rechnungsnummer an{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>

      <p className="legal-updated">Stand: November 2026</p>
    </LegalLayout>
  );
}

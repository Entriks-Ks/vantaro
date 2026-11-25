import LegalLayout, { EnglishVersionNote } from './LegalLayout';
import { COMPLAINT_REASON_OPTIONS, ENERGY_COMPLAINT_REASONS } from '../lib/complaints';
import { getLang } from '../lib/i18n';

// Bump CHECKOUT_TERMS_VERSION in server/src/lib/payments.js when this page changes materially.
export default function Erstattung() {
  return getLang() === 'en' ? <ErstattungEn /> : <ErstattungDe />;
}

function ErstattungDe() {
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
      <p>
        <strong>ENTRIKS L.L.C.</strong> (Betreiberin von VANTARO)
        <br />
        Lot Vaku L2.1, 10000 Prishtina, Kosovo
        <br />
        Telefon: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-Mail: <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Register: Kosovo Business Registration Agency (ARBK), NUI 811936668
        <br />
        Weitere Angaben: <a href="#impressum">Impressum</a>
      </p>

      <p className="legal-updated">Stand: November 2026</p>
    </LegalLayout>
  );
}

function ErstattungEn() {
  return (
    <LegalLayout active="erstattung">
      <h1>Refund policy</h1>
      <p className="legal-lede">
        When you receive a credit, a replacement delivery or a refund for
        purchased leads and appointments, and how to request it. This policy
        forms part of our <a href="#agb">terms and conditions</a>.
      </p>
      <EnglishVersionNote />

      <h2>1. No right of withdrawal</h2>
      <p>
        VANTARO sells exclusively to entrepreneurs. The statutory right of
        withdrawal for consumers therefore does not apply. Refunds are made in
        accordance with the following rules.
      </p>

      <h2>2. Cancellation before delivery starts</h2>
      <p>
        As long as no lead and no appointment has yet been delivered from a paid
        order, you can cancel the order by e-mail to{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>, stating the
        invoice number. You will then receive a refund of the full amount
        paid.
      </p>

      <h2>3. Complaints about individual leads and appointments</h2>
      <p>
        You can report delivered leads and appointments in the portal via
        “Complaint”. The following reasons are accepted:
      </p>
      <h3>Insurance (private health insurance, PKV)</h3>
      <ul>
        {COMPLAINT_REASON_OPTIONS.map((reason) => (
          <li key={reason.id}>
            <strong>{reason.label}:</strong> {reason.hint}
          </li>
        ))}
      </ul>
      <h3>Energy (photovoltaics and heat pumps)</h3>
      <ul>
        {ENERGY_COMPLAINT_REASONS.map((reason) => (
          <li key={reason.id}>
            <strong>{reason.label}:</strong> {reason.hint}
          </li>
        ))}
      </ul>
      <p>
        Please submit your complaint without undue delay, at the latest 14 days
        after delivery, with a comprehensible justification and, where
        available, evidence (e.g. a screenshot or call log). Other reasons,
        such as lack of interest or no contract being concluded, do not entitle
        you to a credit.
      </p>

      <h2>4. Review and decision</h2>
      <p>
        VANTARO reviews every complaint and documents the decision in the
        portal:
      </p>
      <ul>
        <li>
          <strong>Accepted:</strong> credit of the full price of the lead or
          appointment concerned.
        </li>
        <li>
          <strong>Partially accepted:</strong> partial credit.
        </li>
        <li>
          <strong>Query:</strong> we need further information; the complaint
          remains open until it has been provided.
        </li>
        <li>
          <strong>Rejected:</strong> with a justification that you can see in
          the portal.
        </li>
      </ul>

      <h2>5. Form of refund</h2>
      <p>
        Credits are primarily settled by a replacement delivery (replacement
        lead or replacement appointment within the same order). If a
        replacement delivery is not possible or a credit balance remains after
        the order has been completed, we will refund the amount on request.
      </p>
      <p>
        Refunds are made exclusively to the credit card used for payment, via
        ProCredit Bank. We initiate the refund within 14 days of the decision or
        cancellation. When the amount appears on your card statement depends on
        your card-issuing bank (usually 5 to 10 bank working days). Cash
        payouts or refunds to other accounts are not possible.
      </p>

      <h2>6. Incorrect charges</h2>
      <p>
        If your card has been charged twice or with an incorrect amount, please
        contact us immediately at{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>. We will refund
        any amounts charged in error in full.
      </p>

      <h2>7. Contact</h2>
      <p>
        Please send questions about refunds and complaints, stating the invoice
        number, to{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>.
      </p>
      <p>
        <strong>ENTRIKS L.L.C.</strong> (operator of VANTARO)
        <br />
        Lot Vaku L2.1, 10000 Prishtina, Kosovo
        <br />
        Phone: <a href="tel:+38343889344">+383 43 889 344</a>
        <br />
        E-mail: <a href="mailto:info@vantaro.io">info@vantaro.io</a>
        <br />
        Register: Kosovo Business Registration Agency (ARBK), NUI 811936668
        <br />
        Further details: <a href="#impressum">Legal notice</a>
      </p>

      <p className="legal-updated">Last updated: November 2026</p>
    </LegalLayout>
  );
}

import LegalLayout, { EnglishVersionNote } from './LegalLayout';
import { getLang } from '../lib/i18n';

// Bump CHECKOUT_TERMS_VERSION in server/src/lib/payments.js when this page changes materially.
export default function AGB() {
  return getLang() === 'en' ? <AGBEn /> : <AGBDe />;
}

function AGBDe() {
  return (
    <LegalLayout active="agb">
      <h1>Allgemeine Geschäftsbedingungen</h1>
      <p className="legal-lede">
        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für den Kauf von Leads
        und Terminen über das VANTARO-Partnerportal unter vantaro.io.
      </p>

      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>
        Anbieter und Vertragspartner ist die <strong>ENTRIKS L.L.C.</strong>,
        Lot Vaku L2.1, 10000 Prishtina, Kosovo (eingetragen bei der Kosovo
        Business Registration Agency, NUI 811936668), Geschäftsführer René
        Schirner, die die Plattform unter der Marke VANTARO betreibt. Telefon:{' '}
        <a href="tel:+38343889344">+383 43 889 344</a>, E-Mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>. Weitere Angaben
        finden Sie im <a href="#impressum">Impressum</a>.
      </p>
      <p>
        Das Angebot richtet sich ausschließlich an Unternehmer im Sinne von § 14
        BGB, insbesondere Versicherungsvermittler, Berater und Fachbetriebe für
        Photovoltaik und Wärmepumpen (nachfolgend „Kunde“). Verträge mit
        Verbrauchern werden nicht geschlossen. Abweichende Bedingungen des Kunden
        gelten nur, wenn VANTARO ihnen ausdrücklich schriftlich zustimmt.
      </p>

      <h2>2. Leistungen</h2>
      <p>
        VANTARO stellt dem Kunden qualifizierte Kontaktanfragen von
        Interessenten („Leads“) sowie vereinbarte Beratungstermine („Termine“)
        in den Bereichen private Krankenversicherung, Photovoltaik und Wärmepumpe
        zur Verfügung. Inhalt, Gebiet und Umfang ergeben sich aus der
        Paketbeschreibung im Portal zum Zeitpunkt der Bestellung.
      </p>
      <ul>
        <li>Leads und Termine werden exklusiv an einen Kunden übermittelt.</li>
        <li>
          Die Lieferung erfolgt ausschließlich digital über das Partnerportal;
          über neue Lieferungen informieren wir zusätzlich per E-Mail.
        </li>
        <li>
          VANTARO schuldet die Übermittlung der Kontaktdaten gemäß
          Paketbeschreibung, nicht den Abschluss eines Vertrags zwischen dem
          Kunden und dem Interessenten.
        </li>
      </ul>

      <h2>3. Bestellung und Vertragsschluss</h2>
      <p>
        Die Mindestabnahme beträgt 10 Leads bzw. Termine, weitere Mengen in
        Schritten von 5. Bei Energie-Paketen gibt der Kunde zusätzlich Gebiet
        bzw. PLZ und den gewünschten Zeitraum an.
      </p>
      <p>
        Vor der Zahlung sieht der Kunde eine Zusammenfassung mit Paket, Menge,
        etwaigen Rabatten und dem Gesamtbetrag. Mit der Bestätigung dieser AGB
        und der <a href="#erstattung">Erstattungsrichtlinie</a> und dem Klick auf
        „bezahlen“ gibt der Kunde eine verbindliche Bestellung ab. Der Vertrag
        kommt zustande, sobald die Bank die Zahlung bestätigt. Der Kunde erhält
        daraufhin eine Zahlungsbestätigung mit Rechnung per E-Mail.
      </p>

      <h2>4. Preise und Zahlung</h2>
      <p>
        Es gelten die zum Zeitpunkt der Bestellung im Portal angezeigten Preise je
        Lead bzw. Termin. Der zu zahlende Gesamtbetrag wird vor der Zahlung
        angezeigt. Die steuerliche Behandlung ist auf der Rechnung ausgewiesen.
      </p>
      <p>
        Die Zahlung erfolgt im Voraus per Kreditkarte (Visa, Mastercard) über die
        sichere Zahlungsseite der ProCredit Bank. Kartendaten werden ausschließlich
        bei der Bank eingegeben; VANTARO erhält und speichert keine vollständigen
        Kartennummern, sondern nur die von der Bank übermittelten Angaben zur
        Zahlung (z. B. Kartenmarke, letzte vier Ziffern, Genehmigungscode).
      </p>

      <h2>5. Lieferung</h2>
      <p>
        Nach Zahlungseingang wird die Bestellung als Anforderung angelegt. Leads
        und Termine werden fortlaufend im gewünschten Zeitraum bzw. Gebiet
        geliefert, bis die bestellte Menge erreicht ist. Angegebene Zeiträume sind
        Zielwerte, sofern nicht ausdrücklich ein fester Termin vereinbart wurde.
      </p>

      <h2>6. Pflichten des Kunden</h2>
      <ul>
        <li>
          Leads und Termine dürfen nur für die eigene Beratung genutzt und nicht
          an Dritte weitergegeben oder weiterverkauft werden.
        </li>
        <li>
          Der Kunde verarbeitet die übermittelten personenbezogenen Daten als
          eigener Verantwortlicher und beachtet die DSGVO sowie das
          Wettbewerbsrecht.
        </li>
        <li>
          Der Kunde hält seine Zugangsdaten geheim und informiert VANTARO
          unverzüglich bei Verdacht auf Missbrauch.
        </li>
      </ul>

      <h2>7. Reklamation und Erstattung</h2>
      <p>
        Reklamationen, Gutschriften, Ersatzlieferungen und Rückerstattungen
        richten sich nach unserer{' '}
        <a href="#erstattung">Erstattungsrichtlinie</a>, die Bestandteil dieser
        AGB ist.
      </p>

      <h2>8. Haftung</h2>
      <p>
        VANTARO haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei
        Verletzung von Leben, Körper oder Gesundheit sowie nach dem
        Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haftet VANTARO nur bei
        Verletzung einer wesentlichen Vertragspflicht und begrenzt auf den
        vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die Haftung
        ausgeschlossen.
      </p>

      <h2>9. Datenschutz</h2>
      <p>
        Informationen zur Verarbeitung personenbezogener Daten finden Sie in
        unserer <a href="#datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2>10. Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
        UN-Kaufrechts. Gerichtsstand für alle Streitigkeiten ist, soweit
        gesetzlich zulässig, der Sitz von VANTARO. Sollte eine Bestimmung dieser
        AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen
        unberührt.
      </p>

      <p className="legal-updated">Stand: November 2026</p>
    </LegalLayout>
  );
}

function AGBEn() {
  return (
    <LegalLayout active="agb">
      <h1>Terms and conditions</h1>
      <p className="legal-lede">
        These general terms and conditions (T&amp;C) apply to the purchase of
        leads and appointments via the VANTARO partner portal at vantaro.io.
      </p>
      <EnglishVersionNote />

      <h2>1. Provider and scope</h2>
      <p>
        The provider and contractual partner is <strong>ENTRIKS L.L.C.</strong>,
        Lot Vaku L2.1, 10000 Prishtina, Kosovo (registered with the Kosovo
        Business Registration Agency, NUI 811936668), managing director René
        Schirner, which operates the platform under the VANTARO brand. Phone:{' '}
        <a href="tel:+38343889344">+383 43 889 344</a>, e-mail:{' '}
        <a href="mailto:info@vantaro.io">info@vantaro.io</a>. Further details
        can be found in the <a href="#impressum">legal notice</a>.
      </p>
      <p>
        The offer is directed exclusively at entrepreneurs within the meaning of
        § 14 BGB (German Civil Code), in particular insurance intermediaries,
        advisors and specialist companies for photovoltaics and heat pumps
        (hereinafter “customer”). No contracts are concluded with consumers.
        Deviating terms of the customer apply only if VANTARO expressly agrees
        to them in writing.
      </p>

      <h2>2. Services</h2>
      <p>
        VANTARO provides the customer with qualified contact requests from
        prospective clients (“leads”) and arranged advisory appointments
        (“appointments”) in the fields of private health insurance,
        photovoltaics and heat pumps. Content, area and scope are determined by
        the package description in the portal at the time of the order.
      </p>
      <ul>
        <li>Leads and appointments are delivered exclusively to one customer.</li>
        <li>
          Delivery takes place exclusively digitally via the partner portal; we
          additionally notify the customer of new deliveries by e-mail.
        </li>
        <li>
          VANTARO owes the transmission of the contact details in accordance
          with the package description, not the conclusion of a contract
          between the customer and the prospective client.
        </li>
      </ul>

      <h2>3. Order and conclusion of contract</h2>
      <p>
        The minimum order is 10 leads or appointments, with additional
        quantities in steps of 5. For energy packages, the customer additionally
        specifies the area or postcode and the desired period.
      </p>
      <p>
        Before payment, the customer sees a summary showing the package,
        quantity, any discounts and the total amount. By accepting these T&amp;C
        and the <a href="#erstattung">refund policy</a> and clicking “pay”, the
        customer submits a binding order. The contract is concluded as soon as
        the bank confirms the payment. The customer then receives a payment
        confirmation with an invoice by e-mail.
      </p>

      <h2>4. Prices and payment</h2>
      <p>
        The prices per lead or appointment displayed in the portal at the time
        of the order apply. The total amount payable is displayed before
        payment. The tax treatment is shown on the invoice.
      </p>
      <p>
        Payment is made in advance by credit card (Visa, Mastercard) via the
        secure payment page of ProCredit Bank. Card details are entered
        exclusively with the bank; VANTARO does not receive or store full card
        numbers, only the payment details transmitted by the bank (e.g. card
        brand, last four digits, authorisation code).
      </p>

      <h2>5. Delivery</h2>
      <p>
        Once payment has been received, the order is created as a request.
        Leads and appointments are delivered on an ongoing basis within the
        desired period or area until the ordered quantity has been reached.
        Stated periods are target values unless a fixed date has been expressly
        agreed.
      </p>

      <h2>6. Obligations of the customer</h2>
      <ul>
        <li>
          Leads and appointments may only be used for the customer’s own
          advisory services and may not be passed on or resold to third
          parties.
        </li>
        <li>
          The customer processes the transmitted personal data as an
          independent controller and complies with the GDPR (DSGVO) and
          competition law.
        </li>
        <li>
          The customer keeps its access credentials secret and informs VANTARO
          without undue delay if misuse is suspected.
        </li>
      </ul>

      <h2>7. Complaints and refunds</h2>
      <p>
        Complaints, credits, replacement deliveries and refunds are governed by
        our <a href="#erstattung">refund policy</a>, which forms part of these
        T&amp;C.
      </p>

      <h2>8. Liability</h2>
      <p>
        VANTARO is liable without limitation in cases of intent and gross
        negligence, for injury to life, body or health, and under the German
        Product Liability Act (Produkthaftungsgesetz). In cases of slight
        negligence, VANTARO is liable only for breach of a material contractual
        obligation and limited to the foreseeable damage typical for the
        contract. Otherwise, liability is excluded.
      </p>

      <h2>9. Data protection</h2>
      <p>
        Information on the processing of personal data can be found in our{' '}
        <a href="#datenschutz">privacy policy</a>.
      </p>

      <h2>10. Final provisions</h2>
      <p>
        The law of the Federal Republic of Germany applies, excluding the UN
        Convention on Contracts for the International Sale of Goods (CISG). To
        the extent permitted by law, the place of jurisdiction for all disputes
        is the registered office of VANTARO. Should any provision of these
        T&amp;C be invalid, the validity of the remaining provisions shall
        remain unaffected.
      </p>

      <p className="legal-updated">Last updated: November 2026</p>
    </LegalLayout>
  );
}

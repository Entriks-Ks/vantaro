import LegalLayout from './LegalLayout';

// Bump CHECKOUT_TERMS_VERSION in server/src/lib/payments.js when this page changes materially.
export default function AGB() {
  return (
    <LegalLayout active="agb">
      <h1>Allgemeine Geschäftsbedingungen</h1>
      <p className="legal-lede">
        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für den Kauf von Leads
        und Terminen über das VANTARO-Partnerportal unter vantaro.io.
      </p>

      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>
        Anbieter ist <strong>VANTARO</strong>, Geschäftsführer René Schirner,
        E-Mail:{' '}
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

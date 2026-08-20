import LegalLayout from './LegalLayout';

export default function Datenschutz() {
  return (
    <LegalLayout active="datenschutz">
      <h1>Datenschutz</h1>
      <p className="legal-lede">
        Wir erklären, welche personenbezogenen Daten wir verarbeiten, zu welchem
        Zweck und welche Rechte Sie haben. Diese Erklärung gilt für die Website
        vantaro.io.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
      </p>
      <p>
        <strong>VANTARO</strong>
        <br />
        Geschäftsführer: René Schirner
        <br />
        E-Mail:{' '}
        <a href="mailto:rene.schirner@entriks.com">rene.schirner@entriks.com</a>
        <br />
        Weitere Angaben:{' '}
        <a href="#impressum">Impressum</a>
      </p>

      <h2>2. Hosting und Server-Logfiles</h2>
      <p>
        Beim Aufruf dieser Website werden durch den Hosting-Anbieter
        technisch notwendige Daten in sogenannten Server-Logfiles verarbeitet,
        etwa Browsertyp, Datum und Uhrzeit des Zugriffs, Referrer-URL und
        gekürzte IP-Adresse. Die Verarbeitung erfolgt zur Bereitstellung und
        Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>3. Kontaktaufnahme</h2>
      <p>
        Wenn Sie uns per E-Mail oder über das Kontaktformular schreiben,
        verarbeiten wir die von Ihnen mitgeteilten Daten (Name, E-Mail,
        Unternehmen, Anliegen), um Ihre Anfrage zu beantworten (Art. 6 Abs. 1
        lit. b DSGVO bzw. Art. 6 Abs. 1 lit. f DSGVO).
      </p>
      <p>
        Das Formular auf dieser Website überträgt in der aktuellen Demo keine
        Daten an einen Server. Eine verbindliche Anfrage senden Sie bitte per
        E-Mail an{' '}
        <a href="mailto:rene.schirner@entriks.com">rene.schirner@entriks.com</a>.
      </p>

      <h2>4. Cookies und Einwilligung</h2>
      <p>
        Wir verwenden Cookies und ähnliche Technologien. Technisch notwendige
        Cookies sind erforderlich, damit die Seite funktioniert, insbesondere
        um Ihre Auswahl zu speichern. Optionale Cookies für Statistik und
        Marketing setzen wir nur, wenn Sie einwilligen (Art. 6 Abs. 1 lit. a
        DSGVO, § 25 Abs. 1 TDDDG).
      </p>
      <ul>
        <li>
          <strong>Notwendig:</strong> Speicherung Ihrer Cookie-Auswahl und
          sicherer Betrieb der Seite.
        </li>
        <li>
          <strong>Statistik:</strong> Google Analytics (Google Ireland Limited) —
          hilft uns zu verstehen, wie die Seite genutzt wird. Wird nur geladen,
          wenn Sie unter „Statistik“ einwilligen.
        </li>
        <li>
          <strong>Marketing:</strong> Für relevantere Inhalte und Angebote —
          nur mit Einwilligung.
        </li>
      </ul>
      <p>
        Ihre Auswahl können Sie jederzeit über{' '}
        <button
          type="button"
          className="legal-text-btn"
          onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
        >
          Cookie-Einstellungen
        </button>{' '}
        ändern oder widerrufen. Der Widerruf berührt nicht die Rechtmäßigkeit
        der bis dahin erfolgten Verarbeitung.
      </p>

      <h2>5. Google Analytics</h2>
      <p>
        Sofern Sie in den{' '}
        <button
          type="button"
          className="legal-text-btn"
          onClick={() => window.dispatchEvent(new Event('vantaro:cookies'))}
        >
          Cookie-Einstellungen
        </button>{' '}
        der Kategorie „Statistik“ zugestimmt haben, setzen wir{' '}
        <strong>Google Analytics</strong> ein — einen Webanalysedienst der{' '}
        <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street,
        Dublin 4, Irland (nachfolgend „Google“).
      </p>
      <p>
        Google Analytics verwendet Cookies und vergleichbare Technologien, die
        auf Ihrem Endgerät gespeichert werden und die eine Analyse Ihrer
        Nutzung der Website ermöglichen. Dabei können insbesondere folgende
        Daten verarbeitet werden:
      </p>
      <ul>
        <li>gekürzte IP-Adresse</li>
        <li>aufgerufene Seiten und Verweildauer</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Referrer-URL (zuvor besuchte Seite)</li>
        <li>Browsertyp, Betriebssystem und Bildschirmauflösung</li>
        <li>Spracheinstellung und ungefährer Standort (auf Länder-/Regionsebene)</li>
      </ul>
      <p>
        <strong>Zweck:</strong> Reichweitenmessung, Analyse des Nutzerverhaltens
        und Verbesserung unseres Webangebots.
        <br />
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
        (Einwilligung). Ohne Ihre Einwilligung wird Google Analytics nicht
        geladen.
        <br />
        <strong>Mess-ID:</strong> G-Q63XEK9EGN
      </p>
      <p>
        Die durch Google Analytics erzeugten Informationen über Ihre Nutzung
        dieser Website werden in der Regel an einen Server von Google in den
        USA übertragen und dort gespeichert. Google kann dabei als
        Auftragsverarbeiter für uns tätig werden. Für Übermittlungen in
        Drittländer stützt sich Google u.&nbsp;a. auf die von der
        EU-Kommission genehmigten Standardvertragsklauseln.
      </p>
      <p>
        Weitere Informationen finden Sie in der Datenschutzerklärung von Google:{' '}
        <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/privacy
        </a>
        . Wie Google Daten bei der Nutzung von Websites und Apps verarbeitet,
        erläutert Google unter{' '}
        <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">
          https://policies.google.com/technologies/partner-sites
        </a>
        .
      </p>
      <p>
        Sie können die Einwilligung jederzeit widerrufen, indem Sie in den
        Cookie-Einstellungen „Statistik“ deaktivieren und Ihre Auswahl
        speichern. Bereits gespeicherte Analytics-Cookies verlieren dann ihre
        Wirksamkeit für künftige Messungen.
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für den
        jeweiligen Zweck erforderlich ist oder gesetzliche
        Aufbewahrungspflichten bestehen. Cookie-Einwilligungen speichern wir,
        bis Sie sie ändern oder die Speicherung in Ihrem Browser löschen.
        Kontaktanfragen löschen wir, wenn der Vorgang abgeschlossen ist und
        keine gesetzlichen Pflichten entgegenstehen. Bei Google Analytics
        richtet sich die Speicherdauer nach den Einstellungen in unserem
        Google-Analytics-Konto und den Vorgaben von Google; standardmäßig
        werden Ereignisdaten nach 14 Monaten gelöscht.
      </p>

      <h2>7. Empfänger</h2>
      <p>
        Daten werden nur weitergegeben, wenn dies zur Vertragserfüllung, auf
        Grundlage einer Einwilligung, zur Erfüllung einer rechtlichen Pflicht
        oder zur Wahrung berechtigter Interessen erforderlich ist, etwa an
        Hosting- oder IT-Dienstleister, die weisungsgebunden für uns tätig
        werden. Sofern Sie der Kategorie „Statistik“ zugestimmt haben, werden
        Daten an <strong>Google Ireland Limited</strong> (Google Analytics)
        übermittelt.
      </p>

      <h2>8. Ihre Rechte</h2>
      <p>Sie haben gegenüber uns folgende Rechte:</p>
      <ul>
        <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte schreiben Sie an{' '}
        <a href="mailto:rene.schirner@entriks.com">rene.schirner@entriks.com</a>.
      </p>

      <h2>9. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
        beschweren, insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts.
        Die Bundesbeauftragte für den Datenschutz und die Informationsfreiheit
        finden Sie unter{' '}
        <a href="https://www.bfdi.bund.de" rel="noopener noreferrer" target="_blank">
          www.bfdi.bund.de
        </a>
        .
      </p>

      <h2 id="hinweise">10. Hinweise zur Vermittlung</h2>
      <p>
        VANTARO vermittelt keine Versicherungen und gibt keine Produktempfehlungen.
        Qualifizierte Gesprächschancen werden an passende, selbst verantwortliche
        Vermittler übergeben. Personenbezogene Daten von Endkunden werden nur im
        Rahmen der jeweiligen Vereinbarung, der gesetzlichen Vorgaben und — soweit
        erforderlich — auf Grundlage einer Einwilligung verarbeitet.
      </p>

      <h2>11. Keine automatisierte Entscheidungsfindung</h2>
      <p>
        Es findet keine automatisierte Entscheidungsfindung einschließlich
        Profiling im Sinne von Art. 22 DSGVO statt, die Ihnen gegenüber
        rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich
        beeinträchtigt.
      </p>

      <h2>12. Änderungen</h2>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich die Verarbeitung
        oder die Rechtslage ändert. Es gilt die jeweils auf dieser Seite
        veröffentlichte Fassung.
      </p>

      <p className="legal-updated">Stand: August 2026</p>
    </LegalLayout>
  );
}

import { useState } from 'react';

const ITEMS = [
  {
    question: 'Sind die Chancen exklusiv?',
    answer:
      'Das VANTARO-Modell ist auf exklusives Routing ausgelegt: Eine freigegebene Chance wird einem passenden Vermittler zugeordnet. Die konkreten Exklusivitäts- und Qualitätsmerkmale werden je Pilotvereinbarung dokumentiert.',
  },
  {
    question: 'Was bedeutet „qualifiziert“ bei VANTARO?',
    answer:
      'Qualifiziert bedeutet nicht „abschlussbereit“. Es bedeutet: Der Gesprächskontext ist nachvollziehbar, die Zielgruppe passt grundsätzlich, ein konkreter Anlass oder ein relevantes Zeitfenster wurde erkannt und die Chance erfüllt die vereinbarte Qualitätsprüfung.',
  },
  {
    question: 'Wie funktioniert eine Reklamation?',
    answer:
      'Reklamationen werden über definierte Gründe, Fristen und Nachweise im Portal eingereicht. Die Entscheidung und eine mögliche Gutschrift werden im Transaktionsverlauf dokumentiert. Die verbindlichen Regeln stehen in der jeweiligen Vereinbarung.',
  },
  {
    question: 'Wie schnell muss ich reagieren?',
    answer:
      'Je schneller der Erstkontakt, desto höher die Chance auf ein gutes Gespräch. Im Pilot werden deshalb passende Bearbeitungsziele, Erinnerungen und Mengenlimits vereinbart — abgestimmt auf Ihre tatsächliche Kapazität.',
  },
  {
    question: 'Welche Voraussetzungen braucht mein Maklerhaus?',
    answer:
      'Sie benötigen eine passende fachliche Ausrichtung, verfügbare Beratungskapazität, definierte Zuständigkeiten und die Bereitschaft, Status und Ergebnis sauber zurückzuführen. VANTARO unterstützt bei Einrichtung, Portalnutzung und Teamroutine.',
  },
  {
    question: 'Ist VANTARO eine Versicherung oder ein Makler?',
    answer:
      'Nein. VANTARO ist die Vertriebs- und Prozessinfrastruktur für Finanzdienstleister. Fachliche Beratung, Produktauswahl und Vermittlung bleiben beim jeweils zuständigen und zugelassenen Vermittler.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="section faq" id="faq">
      <div className="wrap faq-grid">
        <div className="faq-copy">
          <div className="eyebrow">Klar beantwortet</div>
          <h2>
            Die Fragen, die vor dem <span>ersten Pilot</span> zählen.
          </h2>
          <p>
            Ein professioneller Prozess beginnt mit klaren Erwartungen. Hier sind die
            wichtigsten Punkte — offen, ohne Marketingnebel.
          </p>
          <a className="btn btn-outline" href="#kontakt">
            Weitere Frage stellen <span className="arrow">↗</span>
          </a>
        </div>

        <div className="faq-list">
          {ITEMS.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.question} className={`faq-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : index)}
                >
                  {item.question}
                  <span className="plus" aria-hidden="true" />
                </button>
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

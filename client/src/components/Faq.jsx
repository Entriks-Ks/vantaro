import { useState } from 'react';
import { L } from '../lib/i18n';

const ITEMS = [
  {
    question: L('Sind die Chancen exklusiv?', 'Are the opportunities exclusive?'),
    answer:
      L('Das VANTARO-Modell ist auf exklusives Routing ausgelegt: Eine freigegebene Chance wird einem passenden Vermittler zugeordnet. Die konkreten Exklusivitäts- und Qualitätsmerkmale werden je Pilotvereinbarung dokumentiert.', 'The VANTARO model is built on exclusive routing: an approved opportunity is assigned to one suitable intermediary. The specific exclusivity and quality criteria are documented in each pilot agreement.'),
  },
  {
    question: L('Was bedeutet „qualifiziert“ bei VANTARO?', 'What does “qualified” mean at VANTARO?'),
    answer:
      L('Qualifiziert bedeutet nicht „abschlussbereit“. Es bedeutet: Der Gesprächskontext ist nachvollziehbar, die Zielgruppe passt grundsätzlich, ein konkreter Anlass oder ein relevantes Zeitfenster wurde erkannt und die Chance erfüllt die vereinbarte Qualitätsprüfung.', 'Qualified does not mean “ready to sign”. It means: the conversation context is traceable, the target group fits in principle, a concrete reason or relevant time slot has been identified and the opportunity passes the agreed quality check.'),
  },
  {
    question: L('Wie funktioniert eine Reklamation?', 'How does a complaint work?'),
    answer:
      L('Reklamationen werden über definierte Gründe, Fristen und Nachweise im Portal eingereicht. Die Entscheidung und eine mögliche Gutschrift werden im Transaktionsverlauf dokumentiert. Die verbindlichen Regeln stehen in der jeweiligen Vereinbarung.', 'Complaints are submitted in the portal using defined reasons, deadlines and evidence. The decision and any credit are documented in the transaction history. The binding rules are set out in the respective agreement.'),
  },
  {
    question: L('Wie schnell muss ich reagieren?', 'How quickly do I need to respond?'),
    answer:
      L('Je schneller der Erstkontakt, desto höher die Chance auf ein gutes Gespräch. Im Pilot werden deshalb passende Bearbeitungsziele, Erinnerungen und Mengenlimits vereinbart — abgestimmt auf Ihre tatsächliche Kapazität.', 'The faster the first contact, the higher the chance of a good conversation. In the pilot we therefore agree suitable processing targets, reminders and volume limits — matched to your actual capacity.'),
  },
  {
    question: L('Welche Bereiche deckt die Plattform ab?', 'Which lines of business does the platform cover?'),
    answer:
      L('VANTARO arbeitet mit zwei Bereichen: Versicherung (z. B. PKV, BU, Vorsorge) und Energie (Photovoltaik und Wärmepumpe). Matching, Portal, Guthaben und Follow-up folgen derselben Plattformlogik — mit bereichsspezifischen Qualifizierungs- und Produktregeln.', 'VANTARO works with two lines of business: insurance (e.g. private health, disability, retirement) and energy (solar PV and heat pumps). Matching, portal, credit and follow-up follow the same platform logic — with qualification and product rules specific to each line of business.'),
  },
  {
    question: L('Welche Voraussetzungen braucht mein Unternehmen?', 'What does my company need?'),
    answer:
      L('Sie benötigen eine passende fachliche Ausrichtung in Versicherung oder Energie, verfügbare Beratungskapazität, definierte Zuständigkeiten und die Bereitschaft, Status und Ergebnis sauber zurückzuführen. VANTARO unterstützt bei Einrichtung, Portalnutzung und Teamroutine.', 'You need a suitable professional focus in insurance or energy, available advisory capacity, defined responsibilities and the willingness to report status and outcomes properly. VANTARO supports you with setup, portal use and team routines.'),
  },
  {
    question: L('Ist VANTARO selbst Versicherer, Energieanbieter oder Makler?', 'Is VANTARO itself an insurer, energy supplier or broker?'),
    answer:
      L('Nein. VANTARO ist die Vertriebs- und Prozessplattform. Fachliche Beratung, Produktauswahl und Abschluss bleiben beim jeweils zuständigen Partner — ob Versicherungsmakler oder Energievertrieb.', 'No. VANTARO is the sales and process platform. Professional advice, product selection and closing remain with the responsible partner — whether insurance broker or energy sales company.'),
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="section faq" id="faq">
      <div className="wrap faq-grid">
        <div className="faq-copy">
          <div className="eyebrow">{L('Klar beantwortet', 'Clearly answered')}</div>
          <h2>
            {L('Die Fragen, die vor dem', 'The questions that matter before the')} <span>{L('ersten Pilot', 'first pilot')}</span>{L(' zählen.', '.')}
          </h2>
          <p>
            {L('Ein professioneller Prozess beginnt mit klaren Erwartungen. Hier sind die wichtigsten Punkte — offen, ohne Marketingnebel.', 'A professional process starts with clear expectations. Here are the key points — openly, without marketing fog.')}
          </p>
          <a className="btn btn-outline" href="#kontakt">
            {L('Weitere Frage stellen', 'Ask another question')} <span className="arrow">↗</span>
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

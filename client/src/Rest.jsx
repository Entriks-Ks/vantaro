import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Briefcase, Building2, Check, CheckCircle, Clock, Fingerprint, Flame, GraduationCap, HeartPulse, Landmark, Layers, LayoutDashboard, Phone, Quote, ShieldCheck, ShieldHalf, Sun, Target, TrendingUp, Umbrella, UserCheck, UserPlus, Users } from 'lucide-react';
import Faq from './components/Faq';
import ContactUs from './components/ContactUs';
import { TestimonialMarquee } from './components/testimonial';
import { SectorProfileMarquee } from './components/SectorProfiles';
import { L, locale } from './lib/i18n';

function SectorGrid() {
  const sectors = [
    { icon: HeartPulse, title: L('Private Krankenversicherung', 'Private health insurance'), desc: L('Für Selbstständige, Angestellte, Beamte und Unternehmer mit erkennbarem Beratungsanlass.', 'For self-employed people, employees, civil servants and business owners with a clear reason for advice.'), state: L('Versicherung · live', 'Insurance · live'), main: true, stat: L('68% Terminquote', '68% appointment rate') },
    { icon: Sun, title: L('Photovoltaik', 'Solar PV'), desc: L('Qualifizierte PV-Chancen und Termine für Energievertriebe — mit Gebiet, Objektkontext und klarer Übergabe.', 'Qualified solar PV opportunities and appointments for energy sales teams — with territory, property context and a clear handover.'), state: L('Energie · live', 'Energy · live'), main: true, stat: L('Lead oder Termin', 'Lead or appointment') },
    { icon: Flame, title: L('Wärmepumpe', 'Heat pump'), desc: L('Wärmepumpen-Leads und -Termine mit regionalem Matching und strukturierter Vorqualifizierung.', 'Heat pump leads and appointments with regional matching and structured pre-qualification.'), state: L('Energie · live', 'Energy · live'), main: true, stat: L('Lead oder Termin', 'Lead or appointment') },
    { icon: ShieldHalf, title: L('Berufsunfähigkeit', 'Disability insurance'), desc: L('Absicherungsbedarf, Beruf und Zeitfenster für das Erstgespräch strukturiert vorbereitet.', 'Coverage needs, occupation and time slot for the first call, prepared in a structured way.'), state: L('Versicherung', 'Insurance'), stat: L('54% Terminquote', '54% appointment rate') },
    { icon: Landmark, title: L('Betriebliche Altersvorsorge', 'Company pension schemes'), desc: L('Arbeitgeber- und Arbeitnehmergespräche mit passender Gesprächslogik und Zuständigkeit.', 'Employer and employee conversations with the right call logic and responsibilities.'), state: L('Versicherung', 'Insurance'), stat: L('61% Terminquote', '61% appointment rate') },
    { icon: Umbrella, title: L('Altersvorsorge & Rürup', 'Retirement & Rürup pensions'), desc: L('Langfristige Vorsorgeanlässe für Privatkunden, Selbstständige und gutverdienende Zielgruppen.', 'Long-term retirement planning needs for private clients, the self-employed and high earners.'), state: L('Versicherung', 'Insurance'), stat: L('47% Terminquote', '47% appointment rate') },
    { icon: Building2, title: L('Gewerbe & Unternehmer', 'Commercial & business owners'), desc: L('Unternehmen nach Branche, Größe, Risiko und konkreter Absicherungsfrage zuordnen.', 'Businesses matched by industry, size, risk and specific coverage question.'), state: L('Versicherung', 'Insurance'), stat: L('43% Terminquote', '43% appointment rate') },
  ];

  return (
    <section className="section sectors" id="sparten">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">{L('Versicherung & Energie', 'Insurance & energy')}</div>
          <h2>{L('Zwei Bereiche. Eine', 'Two lines of business. One')} <span style={{ color: 'var(--signal-dark)' }}>{L('Plattform.', 'platform.')}</span></h2>
          <p className="lede">{L('VANTARO liefert qualifizierte Chancen für Versicherungspartner und Energievertriebe — jeweils mit eigenem Anforderungsprofil, Qualitätsstandard und Matching, aber derselben Portal- und Follow-up-Logik.', 'VANTARO delivers qualified opportunities to insurance partners and energy sales teams — each with its own requirements profile, quality standard and matching, but the same portal and follow-up logic.')}</p>
        </div>

        <div className="sector-grid-v2">
          {sectors.map((sec) => {
            const Icon = sec.icon;
            return (
              <article key={sec.title} className={`sector-v2${sec.main ? ' sector-v2--main' : ''}`}>
                <div className="sector-v2-icon"><Icon /></div>
                <h3>{sec.title}</h3>
                <p>{sec.desc}</p>
                <div className="sector-v2-footer">
                  <span className={`sector-v2-state${sec.main ? ' sector-v2-state--main' : ''}`}>{sec.state}</span>
                  <span className="sector-v2-stat">{sec.stat}</span>
                </div>
              </article>
            );
          })}
          <article className="sector-v2 sector-v2--cta">
            <div className="sector-v2-icon sector-v2-icon--cta"><ArrowUpRight /></div>
            <h3>{L('Ihr Produkt fehlt?', 'Missing your product?')}</h3>
            <p>{L('Wir definieren gemeinsam Zielgruppe, Qualitätskriterien und Kapazität für einen neuen Leadtyp in Versicherung oder Energie.', 'Together we define the target group, quality criteria and capacity for a new lead type in insurance or energy.')}</p>
            <a className="sector-v2-link" href="#kontakt">{L('Produkt vorschlagen', 'Suggest a product')} <ArrowUpRight size={14} /></a>
          </article>
        </div>
      </div>
    </section>
  );
}

export default function Rest() {
  const [workspaceView, setWorkspaceView] = useState('dashboard');

  useEffect(() => {
    const range = document.getElementById('leadRange');
    const count = document.getElementById('leadCount');
    const value = document.getElementById('calcValue');
    const form = document.getElementById('demoForm');
    const status = document.getElementById('formStatus');

    const updateCalc = () => {
      if (!range || !count || !value) return;
      const leads = Number(range.value);
      count.textContent = leads;
      value.textContent = new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(leads * 119);
    };
    range?.addEventListener('input', updateCalc);
    updateCalc();

    const onSubmit = (event) => {
      event.preventDefault();
      status?.classList.add('show');
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = L('Anfrage vorbereitet ✓', 'Request prepared ✓');
    };
    form?.addEventListener('submit', onSubmit);

    return () => {
      range?.removeEventListener('input', updateCalc);
      form?.removeEventListener('submit', onSubmit);
    };
  }, []);

  const workspaceTabs = [
    { id: 'dashboard', label: L('Übersicht', 'Overview'), icon: LayoutDashboard },
    { id: 'leads', label: L('Chancen', 'Opportunities'), icon: UserPlus },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'academy', label: L('Akademie', 'Academy'), icon: GraduationCap },
  ];

  const portalFeatures = [
    { icon: Layers, title: L('Chancen & Aufgaben', 'Opportunities & tasks'), text: L('Neue Leads und Termine, nächste Aktion und Bearbeitungsstatus an einem Ort.', 'New leads and appointments, next action and processing status in one place.') },
    { icon: Landmark, title: L('Pakete, Guthaben & Reklamationen', 'Packages, credit & complaints'), text: L('Kauf, Reservierung, Abbuchung und Gutschrift — transparent im Transaktionsverlauf.', 'Purchase, reservation, debit and credit — transparent in the transaction history.') },
    { icon: Phone, title: L('Follow-up & Auswertung', 'Follow-up & reporting'), text: L('Erstkontakt, Termine, Kontaktquote und Wirtschaftlichkeit sichtbar steuern.', 'Manage first contact, appointments, contact rate and profitability at a glance.') },
    { icon: UserCheck, title: L('Team und Akademie', 'Team and academy'), text: L('Zuständigkeiten, Gesprächsqualität und vertriebliche Entwicklung verbinden.', 'Connect responsibilities, call quality and sales development.') },
  ];

  const qualityStages = [
    {
      number: '01',
      title: L('Agenten schulen', 'Train agents'),
      description: L('Gesprächsführung, aktives Zuhören, Dispositionen und klare Rollengrenzen.', 'Call management, active listening, dispositions and clear role boundaries.'),
    },
    {
      number: '02',
      title: L('Gespräch führen', 'Run the call'),
      description: L('Einheitliche Leitfäden statt Zufall — mit Raum für echte Antworten.', 'Consistent call guides instead of chance — with room for genuine answers.'),
    },
    {
      number: '03',
      title: L('Kontext erfassen', 'Capture context'),
      description: L('Berufsbild, Anlass, Status und Zeitfenster werden strukturiert dokumentiert.', 'Occupation, reason, status and time slot are documented in a structured way.'),
    },
    {
      number: '04',
      title: L('Qualität prüfen', 'Check quality'),
      description: L('Dubletten, Mindestkriterien, Nachweis und Exklusivität vor der Übergabe.', 'Duplicates, minimum criteria, evidence and exclusivity before handover.'),
    },
    {
      number: '05',
      title: L('Passend routen', 'Route to the right partner'),
      description: L('Sparte, Region, Kapazität und Käuferprofil bestimmen die Zuordnung.', 'Line of business, region, capacity and buyer profile determine the assignment.'),
    },
    {
      number: '06',
      title: L('Ergebnis zurückführen', 'Feed back the outcome'),
      description: L('Kontakt, Termin, Antrag und Ergebnisfeedback verbessern die nächste Runde.', 'Contact, appointment, application and outcome feedback improve the next round.'),
      featured: true,
    },
  ];

  const qualityMetrics = [
    { value: '100 %', label: L('Prozessklarheit', 'process clarity') },
    { value: '−32 %', label: L('weniger Reklamationen', 'fewer complaints') },
    { value: '+28 %', label: L('Qualität & Wirkung', 'quality & impact') },
    { value: 'Loop', label: L('kontinuierlich besser', 'continuous improvement') },
  ];

  const testimonials = [
    {
      quote: L("Mit VANTARO erhalten wir passende PKV-Chancen mit Kontext und einem klaren nächsten Schritt. Unser Team kann Beratungsgespräche besser vorbereiten und systematischer neue Kunden gewinnen.", "With VANTARO we receive matching private health insurance (PKV) opportunities with context and a clear next step. Our team can prepare advisory calls better and win new clients more systematically."),
      author: L("PKV-Maklerhaus", "PKV brokerage"),
      role: L("Geschäftsführer", "Managing Director"),
      company: L("Versicherung · Pilotprofil", "Insurance · pilot profile"),
      rating: 5,
    },
    {
      quote: L("Für Photovoltaik brauchen wir keine Datensätze, sondern vorqualifizierte Gespräche im richtigen Gebiet. Portal, Pakete und Terminübergabe sitzen endlich in einer Strecke.", "For solar PV we don't need data records, we need pre-qualified conversations in the right territory. Portal, packages and appointment handover finally sit in one workflow."),
      author: L("PV-Vertriebspartner", "Solar PV sales partner"),
      role: L("Vertriebsleitung", "Head of Sales"),
      company: L("Energie · Pilotprofil", "Energy · pilot profile"),
      rating: 5,
    },
    {
      quote: L("Die Vorqualifizierung hilft uns, schneller in relevante bAV-Gespräche einzusteigen. Wir investieren unsere Zeit dort, wo ein konkreter Anlass und ein echtes Zeitfenster vorhanden sind.", "Pre-qualification helps us get into relevant company pension conversations faster. We invest our time where there is a concrete reason and a real time slot."),
      author: L("bAV-Spezialist", "Company pension specialist"),
      role: "Senior Consultant",
      company: L("Finanzberatung · Pilotprofil", "Financial advice · pilot profile"),
      rating: 5,
    },
    {
      quote: L("Wärmepumpen-Termine mit klarer Übergabe und nachvollziehbarem Status — so lässt sich Kapazität planen, statt Inboxen zu jagen.", "Heat pump appointments with a clear handover and traceable status — so we can plan capacity instead of chasing inboxes."),
      author: L("Wärmepumpen-Partner", "Heat pump partner"),
      role: L("Inhaber", "Owner"),
      company: L("Energie · Pilotprofil", "Energy · pilot profile"),
      rating: 5,
    },
    {
      quote: L("Mit dem Portal sehen wir sofort, was heute bearbeitet werden muss. So gewinnen wir Neukunden strukturierter — vom Erstkontakt bis zum Termin.", "With the portal we see immediately what needs to be handled today. That way we win new clients in a more structured way — from first contact to appointment."),
      author: L("KV-Makler", "Health insurance broker"),
      role: L("Vertriebsleiter", "Sales Manager"),
      company: L("Versicherungsmakler · Pilotprofil", "Insurance broker · pilot profile"),
      rating: 5,
    },
    {
      quote: L("Kein unkontrollierter Datenhandel, sondern exklusiv geroutete Interessenten mit echtem Bedarf. Der Qualitätsunterschied ist ab Tag eins spürbar.", "No uncontrolled data trading, but exclusively routed prospects with genuine needs. The difference in quality is noticeable from day one."),
      author: L("BU-Fachberater", "Disability insurance specialist"),
      role: L("Inhaber", "Owner"),
      company: L("Einkommensschutz", "Income protection"),
      rating: 5,
    },
  ];

  const sectorProfiles = [
    { icon: HeartPulse, label: L('Kurzprofil 01', 'Profile 01'), title: L('PKV-Spezialist', 'PKV specialist'), description: L('Gesucht werden qualifizierte Selbstständige und Angestellte mit konkretem Beratungsanlass.', 'Looking for qualified self-employed people and employees with a concrete reason for advice.') },
    { icon: Sun, label: L('Kurzprofil 02', 'Profile 02'), title: L('PV-Vertrieb', 'Solar PV sales'), description: L('Photovoltaik-Leads und -Termine mit Gebiet, Objektkontext und klarer Gesprächsbereitschaft.', 'Solar PV leads and appointments with territory, property context and a clear willingness to talk.') },
    { icon: Flame, label: L('Kurzprofil 03', 'Profile 03'), title: L('Wärmepumpen-Partner', 'Heat pump partner'), description: L('Regionale Wärmepumpen-Chancen mit strukturierter Vorqualifizierung und Terminübergabe.', 'Regional heat pump opportunities with structured pre-qualification and appointment handover.') },
    { icon: Users, label: L('Kurzprofil 04', 'Profile 04'), title: L('Maklerhaus KV', 'Health insurance brokerage'), description: L('Mehr planbare Versicherungschancen für ein Team mit klarer Bearbeitungskapazität.', 'More predictable insurance opportunities for a team with clear processing capacity.') },
    { icon: Landmark, label: L('Kurzprofil 05', 'Profile 05'), title: L('bAV-Berater', 'Company pension advisor'), description: L('Arbeitgeberkontakte mit Anlass, Ansprechpartner und gewünschtem nächsten Schritt.', 'Employer contacts with a reason, contact person and desired next step.') },
    { icon: ShieldHalf, label: L('Kurzprofil 06', 'Profile 06'), title: L('BU-Fachberater', 'Disability insurance specialist'), description: L('Fokus auf Beruf, Absicherungsbedarf und eine nachvollziehbare Terminvorbereitung.', 'Focus on occupation, coverage needs and transparent appointment preparation.') },
    { icon: Building2, label: L('Kurzprofil 07', 'Profile 07'), title: L('Gewerbemakler', 'Commercial broker'), description: L('Unternehmer und Betriebe nach Branche, Größe und konkreter Absicherungsfrage.', 'Business owners and companies by industry, size and specific coverage question.') },
    { icon: Briefcase, label: L('Kurzprofil 08', 'Profile 08'), title: L('Energie-Partnerfirma', 'Energy partner company'), description: L('Team-Routing, Paketkauf und Follow-up für Photovoltaik und Wärmepumpe in einem Portal.', 'Team routing, package purchases and follow-up for solar PV and heat pumps in one portal.') },
  ];

  return (
    <>
{/* SIGNAL STRIP */}
        <section className="signal-strip">
            <div className="signal-strip-glow signal-strip-glow--left" aria-hidden="true"></div>
            <div className="signal-strip-glow signal-strip-glow--right" aria-hidden="true"></div>
            <div className="signal-strip-beam" aria-hidden="true"></div>
            <div className="wrap signal-strip-wrap">
                <div className="signal-strip-main">
                    <strong className="signal-title">
                        {L('Versicherung & Energie. Ein Workflow.', 'Insurance & energy. One workflow.')} <span className="signal-highlight">{L('Mehr planbarer Umsatz.', 'More predictable revenue.')}</span>
                    </strong>
                </div>
                <div className="signal-points">
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><Check size={13} strokeWidth={2.6} /></span>
                        <span className="signal-chip-label">{L('Exklusiv geroutet', 'Exclusively routed')}</span>
                    </div>
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><ShieldCheck size={13} strokeWidth={2.2} /></span>
                        <span className="signal-chip-label">{L('Q2 qualifiziert', 'Q2 qualified')}</span>
                    </div>
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><TrendingUp size={13} strokeWidth={2.2} /></span>
                        <span className="signal-chip-label">{L('Skalierbar & messbar', 'Scalable & measurable')}</span>
                    </div>
                </div>
            </div>
        </section>

        {/* POSITIONING */}
        <section className="section positioning" id="warum">
            <div className="wrap positioning-grid">
                <div className="positioning-copy">
                    <div className="eyebrow">{L('SO FUNKTIONIERT DIE PLATTFORM', 'HOW THE PLATFORM WORKS')}</div>
                    <h2>
                        {L('Keine', 'Not a')} <span className="accent">{L('Leadbörse.', 'lead marketplace.')}</span>
                        <br />
                        {L('Eine Vertriebsplattform.', 'A sales platform.')}
                    </h2>
                    <p className="lede">
                        {L('Ein Lead ist kein Erfolg. Erst wenn ein passender Partner ihn schnell erreicht, ein relevantes Gespräch entsteht und der Vorgang im Portal weitergeführt wird, wird aus Kontakt eine echte Geschäftschance — in Versicherung ebenso wie in Energie.', 'A lead is not a success. Only when the right partner reaches it quickly, a relevant conversation takes place and the case is continued in the portal does a contact become a real business opportunity — in insurance as well as in energy.')}
                    </p>

                    <div className="quote-line">
                        <span className="quote-icon" aria-hidden="true">
                            <Quote className="icon-md" />
                        </span>
                        <span className="quote-text">
                            {L('Wir liefern nicht einfach Kontakte.', "We don't just deliver contacts.")}
                            <br />
                            {L('Wir betreiben die Plattform, auf der Beratung möglich wird.', 'We run the platform that makes advice possible.')}
                        </span>
                    </div>

                    <a className="journey-cta" href="#kontakt">
                        {L('Mehr erfahren', 'Learn more')}
                        <span className="icon-inline journey-cta-icon" aria-hidden="true">
                            <ArrowRight className="icon-md" />
                        </span>
                    </a>
                </div>
                <div className="journey-container" aria-label={L('Vertriebsprozess', 'Sales process')}>
                    <ol className="journey-steps">
                        <li className="journey-step" data-accent="signal">
                            <span className="journey-badge" aria-hidden="true">
                                01
                            </span>
                            <span className="journey-icon" aria-hidden="true">
                                <Clock className="journey-icon-svg" />
                            </span>
                            <div className="journey-copy">
                                <h3>{L('Geschwindigkeit', 'Speed')}</h3>
                                <p>
                                    {L('Neue Chancen, klare Aufgaben und ein definierter nächster Schritt — damit Interesse nicht zwischen Postfach und Rückrufliste verschwindet.', "New opportunities, clear tasks and a defined next step — so interest doesn't get lost between inbox and callback list.")}
                                </p>
                            </div>
                        </li>
                        <li className="journey-step" data-accent="thread">
                            <span className="journey-badge" aria-hidden="true">
                                02
                            </span>
                            <span className="journey-icon" aria-hidden="true">
                                <ArrowRight className="journey-icon-svg" />
                            </span>
                            <div className="journey-copy">
                                <h3>{L('Exklusives Matching', 'Exclusive matching')}</h3>
                                <p>
                                    {L('Routing nach Bereich, Produkt, Region, Zielgruppe, Kapazität und Kompetenz. Eine Beratungschance wird nicht zum Preisvergleich zwischen fünf Käufern.', 'Routing by line of business, product, region, target group, capacity and expertise. An advisory opportunity does not become a price comparison between five buyers.')}
                                </p>
                            </div>
                        </li>
                        <li className="journey-step" data-accent="ink">
                            <span className="journey-badge" aria-hidden="true">
                                03
                            </span>
                            <span className="journey-icon" aria-hidden="true">
                                <TrendingUp className="journey-icon-svg" />
                            </span>
                            <div className="journey-copy">
                                <h3>Portal &amp; Follow-up</h3>
                                <p>
                                    {L('Chancen bearbeiten, Termine halten, Status zurückführen und Reklamationen steuern — im selben Workspace für Ihr Team.', 'Work opportunities, keep appointments, report status and manage complaints — in the same workspace for your team.')}
                                </p>
                            </div>
                        </li>
                        <li className="journey-step" data-accent="signal-thread">
                            <span className="journey-badge" aria-hidden="true">
                                04
                            </span>
                            <span className="journey-icon" aria-hidden="true">
                                <Layers className="journey-icon-svg" />
                            </span>
                            <div className="journey-copy">
                                <h3>{L('Zwei Bereiche, eine Logik', 'Two lines of business, one logic')}</h3>
                                <p>
                                    {L('Versicherung (PKV, BU, Vorsorge u. a.) und Energie (Photovoltaik, Wärmepumpe) laufen auf derselben Plattform — mit bereichsspezifischen Paketen und Regeln.', 'Insurance (private health, disability, retirement and more) and energy (solar PV, heat pumps) run on the same platform — with packages and rules specific to each line of business.')}
                                </p>
                            </div>
                        </li>
                    </ol>
                </div>
            </div>
        </section>

        {/* SYSTEM */}
        <section className="section system" id="system">
            <div className="wrap">
                <div className="section-head">
                    <div className="eyebrow light">{L('Plattform-Workflow', 'Platform workflow')}</div>
                    <h2>{L('So nutzen Partner VANTARO.', 'How partners use VANTARO.')} <span>{L('Vom Kontakt bis zum Ergebnis.', 'From contact to outcome.')}</span></h2>
                    <p className="lede">{L('Produktion, Qualität, Matching, Portal und Verkauf bleiben nicht getrennt — sie bilden eine durchgängige Betriebslogik für Versicherung und Energie.', "Production, quality, matching, portal and sales don't stay separate — they form one continuous operating logic for insurance and energy.")}</p>
                </div>
                <div className="system-flow">
                    <article className="flow-item"><span className="flow-node"><Phone size={16} /></span><span className="flow-number">{L('01 / KONTAKT', '01 / CONTACT')}</span><h3>{L('Interesse', 'Interest')}</h3><p>{L('Telefonischer Erstkontakt mit bereichsspezifischem Leitfaden, Rückruflogik und sauberer Disposition.', 'First contact by phone with a call guide specific to the line of business, callback logic and clean disposition.')}</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><ShieldCheck size={16} /></span><span className="flow-number">{L('02 / QUALITÄT', '02 / QUALITY')}</span><h3>{L('Qualitätsprüfung', 'Quality check')}</h3><p>{L('Kontext, Zielgruppe, Anlass und Nachweis werden geprüft — bevor die Chance weitergeht.', 'Context, target group, reason and evidence are checked — before the opportunity moves on.')}</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><UserCheck size={16} /></span><span className="flow-number">03 / MATCHING</span><h3>{L('Passung', 'Fit')}</h3><p>{L('Die Chance wird exklusiv dem passenden Partner mit Gebiet, Produktfokus und Kapazität zugeordnet.', 'The opportunity is assigned exclusively to the right partner by territory, product focus and capacity.')}</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><Clock size={16} /></span><span className="flow-number">04 / PORTAL</span><h3>{L('Bearbeitung', 'Processing')}</h3><p>{L('Pakete kaufen, Chancen öffnen, kontaktieren, terminieren und Status im Workspace zurückführen.', 'Buy packages, open opportunities, make contact, book appointments and report status in the workspace.')}</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><Target size={16} /></span><span className="flow-number">{L('05 / ERGEBNIS', '05 / OUTCOME')}</span><h3>Feedback</h3><p>{L('Ergebnis und Reklamation machen aus einzelnen Käufen eine messbare, optimierbare Umsatzstrecke.', 'Outcomes and complaints turn individual purchases into a measurable, optimisable revenue pipeline.')}</p></article>
                </div>
                <div className="system-note"><div><strong>{L('Das Betriebssystem hinter der Beratung.', 'The operating system behind the advice.')}</strong><p>{L('VANTARO verbindet Telefonie, Qualität, Matching, Guthaben, Reklamation und Ergebnis — für Versicherungspartner und Energievertriebe gleichermaßen.', 'VANTARO connects telephony, quality, matching, credit, complaints and outcomes — for insurance partners and energy sales teams alike.')}</p></div><a className="btn btn-outline-light" href="#portal">{L('Portal ansehen', 'View the portal')} <span className="arrow">↗</span></a></div>
            </div>
        </section>

        {/* USECASES */}
        <section className="section usecases" id="anwendungen">
            <div className="wrap">
                <div className="section-head">
                    <div className="eyebrow">{L('Plattformnutzung', 'Using the platform')}</div>
                    <h2>{L('Ein Workflow.', 'One workflow.')} <br />{L('Zwei klare', 'Two clear')} <span style={{ color: "var(--signal-dark)" }}>{L('Bereiche.', 'lines of business.')}</span></h2>
                    <p className="lede">{L('Sie wählen Versicherung oder Energie, erwerben passende Pakete und bearbeiten Chancen im Portal — vom Erstkontakt bis zum dokumentierten Ergebnis.', 'You choose insurance or energy, buy suitable packages and work opportunities in the portal — from first contact to documented outcome.')}</p>
                </div>
                <div className="usecase-grid">
                    <article className="usecase featured">
                        <div className="eyebrow light">{L('So arbeiten Partner mit VANTARO', 'How partners work with VANTARO')}</div>
                        <h3>{L('Registrieren, Bereich wählen, Chancen steuern — in einer Strecke.', 'Sign up, choose your line of business, manage opportunities — in one workflow.')}</h3>
                        <p>{L('Nach dem Onboarding wählen Sie Versicherung oder Energie. Danach kaufen Sie Pakete, erhalten exklusiv geroutete Chancen oder Termine und führen Kontakt, Status und Ergebnis im Partnerportal.', 'After onboarding you choose insurance or energy. You then buy packages, receive exclusively routed opportunities or appointments and manage contact, status and outcome in the partner portal.')}</p>
                        <div className="tag-row"><span className="tag">{L('Bereich wählen', 'Choose line of business')}</span><span className="tag">{L('Pakete & Matching', 'Packages & matching')}</span><span className="tag">{L('Portal-Follow-up', 'Portal follow-up')}</span></div>
                        <a className="usecase-link" href="#kontakt">{L('Plattform-Pilot besprechen', 'Discuss a platform pilot')} <span className="icon-inline"><ArrowUpRight /></span></a>
                    </article>
                    <article className="usecase">
                        <div className="eyebrow">{L('Ihre Einstiege', 'Your entry points')}</div>
                        <h3>{L('Versicherung und Energie auf derselben Plattform.', 'Insurance and energy on the same platform.')}</h3>
                        <p>{L('Beide Bereiche nutzen Qualität, Matching und Portal — mit eigenen Produkten und Übergabelogiken.', 'Both lines of business use quality, matching and the portal — with their own products and handover logic.')}</p>
                        <div className="usecase-stack">
                            <div className="stack-item"><strong>PKV</strong><span>{L('Versicherung', 'Insurance')}</span></div>
                            <div className="stack-item"><strong>{L('BU / Vorsorge', 'Disability / retirement')}</strong><span>{L('Versicherung', 'Insurance')}</span></div>
                            <div className="stack-item"><strong>{L('Photovoltaik', 'Solar PV')}</strong><span>{L('Energie', 'Energy')}</span></div>
                            <div className="stack-item"><strong>{L('Wärmepumpe', 'Heat pump')}</strong><span>{L('Energie', 'Energy')}</span></div>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        {/* SECTORS */}
        <SectorGrid />

        {/* PORTAL */}
        <section className="section portal-section" id="portal">
            <div className="wrap portal-grid">
                <div className="portal-copy">
                    <div className="eyebrow">{L('Ihr Partnerportal', 'Your partner portal')}</div>
                    <h2>{L('Die Chance ist nicht im Postfach. Sie ist', "The opportunity isn't in the inbox. It's")} <span>{L('im System.', 'in the system.')}</span></h2>
                    <p className="lede">{L('Ein Portal für Versicherung und Energie: priorisieren, kontaktieren, terminieren, dokumentieren und aus Ergebnissen lernen.', 'One portal for insurance and energy: prioritise, contact, schedule, document and learn from outcomes.')}</p>
                    <ul className="portal-list">
                        {portalFeatures.map((feature) => {
                          const Icon = feature.icon;
                          return (
                            <li key={feature.title}>
                                <span className="check-icon"><Icon /></span>
                                <span>
                                    <strong>{feature.title}</strong>
                                    <small>{feature.text}</small>
                                </span>
                            </li>
                          );
                        })}
                    </ul>
                    <a className="btn btn-dark" href="#kontakt">{L('Portal-Demo anfragen', 'Request a portal demo')} <span className="arrow">→</span></a>
                </div>

                <div className="workspace-shell" aria-label={L('Interaktive Vorschau des VANTARO-Partnerportals', 'Interactive preview of the VANTARO partner portal')}>
                    <div className="workspace-head">
                        <div className="workspace-brand"><span className="mini-mark">V</span> VANTARO / WORKSPACE</div>
                        <div className="workspace-user"><span>{L('Max Beispiel', 'Max Example')}</span><span className="avatar">ME</span></div>
                    </div>
                    <div className="workspace-layout">
                        <aside className="workspace-nav" aria-label={L('Portalbereiche', 'Portal sections')}>
                            {workspaceTabs.map((tab) => {
                              const Icon = tab.icon;
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  className={workspaceView === tab.id ? 'active' : undefined}
                                  onClick={() => setWorkspaceView(tab.id)}
                                >
                                  <Icon /> {tab.label}
                                </button>
                              );
                            })}
                        </aside>
                        <div className="workspace-content">
                            {workspaceView === 'dashboard' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>{L('Guten Morgen, Max', 'Good morning, Max')}</h3>
                                        <p>{L('Hier sehen Sie, was heute Bewegung braucht.', 'Here you can see what needs action today.')}</p>
                                    </div>
                                    <span className="period">{L('Diese Woche', 'This week')}</span>
                                </div>
                                <div className="metric-grid">
                                    <div className="metric"><span>{L('Neue Chancen', 'New opportunities')}</span><strong>24</strong><small>{L('+18 % vs. Vorwoche', '+18% vs. last week')}</small></div>
                                    <div className="metric"><span>{L('Erstkontakt', 'First contact')}</span><strong>18m</strong><small>{L('Median dieser Woche', 'Median this week')}</small></div>
                                    <div className="metric"><span>{L('Termine', 'Appointments')}</span><strong>7</strong><small>{L('3 in Vorbereitung', '3 in preparation')}</small></div>
                                    <div className="metric"><span>{L('Guthaben', 'Credit')}</span><strong>{L('2.840 €', '€2,840')}</strong><small>{L('verfügbar', 'available')}</small></div>
                                </div>
                                <div className="workspace-panels">
                                    <div className="panel panel-leads">
                                        <div className="panel-heading"><strong>{L('Priorisierte Chancen', 'Prioritised opportunities')}</strong><a href="#kontakt">{L('Alle anzeigen', 'Show all')}</a></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>{L('PKV / Selbstständig', 'PKV / self-employed')}</strong><span>{L('Versicherung · vor 11 Minuten · PLZ 50667', 'Insurance · 11 minutes ago · postcode 50667')}</span></div></div><div className="lead-price"><strong>{L('129 €', '€129')}</strong><span>{L('neu', 'new')}</span></div></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>{L('Photovoltaik / Termin', 'Solar PV / appointment')}</strong><span>{L('Energie · vor 28 Minuten · Bayern', 'Energy · 28 minutes ago · Bayern')}</span></div></div><div className="lead-price"><strong>{L('Termin', 'Appointment')}</strong><span>{L('offen', 'open')}</span></div></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>{L('Wärmepumpe / Lead', 'Heat pump / lead')}</strong><span>{L('Energie · gestern · NRW', 'Energy · yesterday · NRW')}</span></div></div><div className="lead-price"><strong>Lead</strong><span>{L('Rückruf', 'Callback')}</span></div></div>
                                    </div>
                                    <div className="panel panel-chart">
                                        <div className="panel-heading"><strong>{L('Verlauf', 'Trend')}</strong><a href="#preise">{L('Berichte', 'Reports')}</a></div>
                                        <div className="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                                        <div className="chart-legend"><span>{L('Kontaktquote', 'Contact rate')}</span><b>{L('64 %', '64%')}</b></div>
                                    </div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'leads' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>{L('Ihre Chancen', 'Your opportunities')}</h3>
                                        <p>{L('Filtern, priorisieren und den nächsten Schritt auslösen.', 'Filter, prioritise and trigger the next step.')}</p>
                                    </div>
                                    <span className="period">{L('Versicherung & Energie', 'Insurance & energy')}</span>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>{L('Aktive Chancen', 'Active opportunities')}</strong><a href="#kontakt">{L('Filter öffnen', 'Open filters')}</a></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>{L('PKV / Selbstständig · Q2', 'PKV / self-employed · Q2')}</strong><span>{L('Exklusiv · Zeitfenster bestätigt · PLZ 50667', 'Exclusive · time slot confirmed · postcode 50667')}</span></div></div><div className="lead-price"><strong>{L('129 €', '€129')}</strong><span className="pill">{L('Jetzt kontaktieren', 'Contact now')}</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>{L('Photovoltaik / Lead', 'Solar PV / lead')}</strong><span>{L('Gebiet bestätigt · Rückruf um 16:30 Uhr', 'Territory confirmed · callback at 16:30')}</span></div></div><div className="lead-price"><strong>Lead</strong><span>{L('Rückruf', 'Callback')}</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>{L('Wärmepumpe / Termin', 'Heat pump / appointment')}</strong><span>{L('Termin angefragt · Donnerstag, 10:00 Uhr', 'Appointment requested · Thursday, 10:00')}</span></div></div><div className="lead-price"><strong>{L('Termin', 'Appointment')}</strong><span className="pill">{L('bestätigt', 'confirmed')}</span></div></div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'team' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>{L('Team-Überblick', 'Team overview')}</h3>
                                        <p>{L('Aktivität, Verteilung und Coaching-Bedarf.', 'Activity, distribution and coaching needs.')}</p>
                                    </div>
                                    <span className="period">{L('Heute', 'Today')}</span>
                                </div>
                                <div className="metric-grid">
                                    <div className="metric"><span>{L('Aktive Nutzer', 'Active users')}</span><strong>6</strong><small>4 online</small></div>
                                    <div className="metric"><span>{L('Offene Aufgaben', 'Open tasks')}</span><strong>13</strong><small>{L('5 dringend', '5 urgent')}</small></div>
                                    <div className="metric"><span>{L('Terminquotes', 'Appointment rate')}</span><strong>{L('29 %', '29%')}</strong><small>Trend ↑</small></div>
                                    <div className="metric"><span>{L('QA-Score', 'QA score')}</span><strong>{L('92 %', '92%')}</strong><small>{L('letzte Stichprobe', 'latest sample')}</small></div>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>{L('Coaching-Hinweise', 'Coaching notes')}</strong><a href="#kontakt">{L('Akademie öffnen', 'Open academy')}</a></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>{L('Einwandbehandlung', 'Objection handling')}</strong><span>{L('2 Gespräche zur Nachschulung markiert', '2 calls flagged for retraining')}</span></div></div><div className="lead-price"><strong>{L('Heute', 'Today')}</strong><span>{L('offen', 'open')}</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>{L('Reaktionszeit', 'Response time')}</strong><span>{L('Team-Median verbessert sich', 'Team median is improving')}</span></div></div><div className="lead-price"><strong>{L('18 Min.', '18 min')}</strong><span>{L('aktuell', 'current')}</span></div></div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'academy' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>{L('Akademie', 'Academy')}</h3>
                                        <p>{L('Training direkt an der Vertriebsrealität.', 'Training grounded in real-world sales.')}</p>
                                    </div>
                                    <span className="period">{L('Mein Lernpfad', 'My learning path')}</span>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>{L('Ihr nächstes Modul', 'Your next module')}</strong><span className="pill">{L('68 % Fortschritt', '68% progress')}</span></div>
                                    <h4>{L('Erstgespräch: Bedarf erkennen, nicht beraten', 'First call: identify needs, not give advice')}</h4>
                                    <p className="small">{L('Gesprächsstruktur · Grenzen der Rolle · saubere Übergabe an Versicherung oder Energiepartner', 'Call structure · role boundaries · clean handover to insurance or energy partner')}</p>
                                    <div className="academy-progress"><div className="academy-progress-bar" /></div>
                                    <div className="workspace-tag">{L('12 Minuten · 1 Rollenspiel', '12 minutes · 1 role play')}</div>
                                </div>
                              </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* QUALITY */}
        <section className="section quality" id="qualitaet">
            <div className="wrap">
                <div className="quality-grid">
                    <div className="quality-copy">
                        <div className="eyebrow">{L('Qualität ist ein Produktionssystem', 'Quality is a production system')}</div>
                        <h2>{L('Vertrauen', 'Trust')}<br />{L('entsteht, wenn', 'is built when')}<br /><span>{L('nichts im Nebel', 'nothing is left')}<br />{L('bleibt.', 'in the dark.')}</span></h2>
                        <p className="lede">{L('Von der Agentenschulung bis zur Reklamationsentscheidung: VANTARO macht die relevanten Punkte sichtbar und wiederholbar.', 'From agent training to complaint decisions: VANTARO makes the relevant points visible and repeatable.')}</p>
                        <div className="quality-callout">
                            <span className="icon-inline"><ArrowUpRight className="icon-lg" /></span>
                            <div><strong>{L('Kein Beratungstheater.', 'No advice theatre.')}</strong><p>{L('Agenten gut führen in Prozess und Kontext. Die fachliche Beratung gehört in die Hände des qualifizierten Vermittlers.', 'Agents are guided well through process and context. Professional advice belongs in the hands of the qualified intermediary.')}</p></div>
                        </div>
                    </div>

                    <div className="quality-steps" aria-label={L('Operatives Qualitätssystem', 'Operational quality system')}>
                        {qualityStages.map((stage) => (
                            <article key={stage.number} className={`quality-step${stage.featured ? ' quality-step--outcome' : ''}`}>
                                <span className="quality-step__number">{stage.number}</span>
                                <h4>{stage.title}</h4>
                                <p>{stage.description}</p>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="quality-outcomes">
                    {qualityMetrics.map((metric) => (
                        <article key={metric.label} className="quality-outcome">
                          <strong>{metric.value}</strong>
                          <span>{metric.label}</span>
                        </article>
                    ))}
                </div>
            </div>
        </section>

        {/* PROOF */}
        <section className="section proof" id="vertrauen">
            <div className="wrap">
                <div className="proof-top">
                    <div className="section-head"><div className="eyebrow">{L('Proof ohne große Worte', 'Proof without big words')}</div><h2>{L('Wir zeigen,', 'We show you')} <span style={{ color: "var(--signal-dark)" }}>{L('wie es funktioniert.', 'how it works.')}</span></h2><p className="lede">{L('Echte Kundenstimmen und Fallstudien gehören zu echten Partnerschaften. Bis dahin überzeugt VANTARO mit einem überprüfbaren Prozess statt mit erfundenen Logos.', 'Real customer testimonials and case studies belong to real partnerships. Until then, VANTARO convinces with a verifiable process instead of invented logos.')}</p></div>
                    <div className="proof-badge">
                        <span className="icon-inline"><ShieldCheck /></span>
                        <span>{L('Proof-Architektur statt Behauptungen — transparent von Anfang an.', 'Proof architecture instead of claims — transparent from the start.')}</span>
                    </div>
                </div>
                <div className="proof-grid">
                    <article className="proof-card"><div className="proof-mark"><Fingerprint /></div><h3>{L('Jede Chance hat eine ID', 'Every opportunity has an ID')}</h3><p>{L('Zeitstempel, Qualitätsstatus, Exklusivität, Zuordnung und Statusverlauf machen nachvollziehbar, was wann passiert ist.', 'Timestamp, quality status, exclusivity, assignment and status history make it clear what happened when.')}</p></article>
                    <article className="proof-card dark"><div className="proof-mark"><CheckCircle /></div><h3>{L('Jeder Kauf hat Regeln', 'Every purchase has rules')}</h3><p>{L('Guthaben, Reservierung, Gutschrift und Reklamationsfristen werden nicht per Zuruf verwaltet, sondern im System geführt.', 'Credit, reservations, credit notes and complaint deadlines are not managed by word of mouth but tracked in the system.')}</p></article>
                    <article className="proof-card accent"><div className="proof-mark"><Clock /></div><h3>{L('Jeder Pilot wird messbar', 'Every pilot is measurable')}</h3><p>{L('Kontaktquote, Termine, Bearbeitungszeit und Storno werden zur Basis für die nächste Entscheidung — nicht zum Reporting-Schmuck.', 'Contact rate, appointments, processing time and cancellations become the basis for the next decision — not reporting decoration.')}</p></article>
                </div>
                <p className="proof-footnote"><strong>{L('Aktueller Status:', 'Current status:')}</strong> {L('VANTARO befindet sich im Aufbau der Pilotpartnerschaften. Partnerstimmen, Logos und Fallstudien werden nach Freigabe durch echte Versicherungs- und Energiepartner ergänzt.', 'VANTARO is currently building its pilot partnerships. Partner testimonials, logos and case studies will be added once approved by real insurance and energy partners.')}</p>
            </div>
        </section>

        {/* REFERENCES */}
        <section className="section references" id="referenzen">
            <div className="wrap">
                <div className="references-head">
                    <div className="section-head">
                        <div className="eyebrow">{L('Partnerstimmen & Praxisbilder', 'Partner voices & practice examples')}</div>
                        <h2>{L('Damit andere Partner sehen,', 'So other partners can see')} <span style={{ color: "var(--signal-dark)" }}>{L('wie es funktioniert.', 'how it works.')}</span></h2>
                        <p className="lede">{L('Die folgenden Profile sind als redaktionelle Beispiel- und Pilotprofile für Versicherung und Energie angelegt. Namen, Logos und Aussagen werden vor dem Livegang nur mit Freigabe und belegbaren Daten veröffentlicht.', 'The following profiles are editorial example and pilot profiles for insurance and energy. Names, logos and statements will only be published before go-live with approval and verifiable data.')}</p>
                    </div>
                    <div className="reference-disclosure">
                        <div className="disclosure-pill"><ShieldCheck size={14} /> {L('Transparenz', 'Transparency')}</div>
                        <strong>{L('Wichtig für Ihre Glaubwürdigkeit', 'Important for your credibility')}</strong>
                        <p>{L('Beispieltexte sind bereits strukturiert. Echte Referenzen können Sie später ohne Umbau an derselben Stelle einsetzen.', 'The example texts are already structured. Real references can later be inserted in the same place without rework.')}</p>
                    </div>
                </div>

                <div className="reference-marquee-wrapper">
                    <TestimonialMarquee testimonials={testimonials} speed={0.7} pauseOnHover={false} />
                </div>

                <div className="reference-mini-section">
                    <div className="reference-mini-head">
                        <span className="eyebrow">{L('Bereiche & Profile', 'Lines of business & profiles')}</span>
                        <h3>{L('Versicherung und Energie im Einsatz', 'Insurance and energy in action')}</h3>
                    </div>
                    <SectorProfileMarquee profiles={sectorProfiles} speed={0.6} pauseOnHover={false} direction="right" />
                </div>
            </div>
        </section>

        {/* ABOUT */}
        <section className="section about" id="ueber-uns">
            <div className="wrap about-grid">
                <div className="about-copy">
                    <div className="eyebrow light">{L('Über VANTARO', 'About VANTARO')}</div>
                    <h2>{L('40 Menschen.', '40 people.')} <span>{L('Ein gemeinsamer Fokus.', 'One shared focus.')}</span></h2>
                    <p className="lede">{L('Unser Team arbeitet daran, aus Gesprächen echte Beratungschancen zu machen — strukturiert, professionell und mit einem klaren Verständnis für Versicherungspartner und Energievertriebe.', 'Our team works to turn conversations into real advisory opportunities — structured, professional and with a clear understanding of insurance partners and energy sales teams.')}</p>
                    <p>{L('Aktuell arbeiten 40 Personen im VANTARO-Team daran, potenzielle Kunden telefonisch zu erreichen, Interesse und Bedarf einzuordnen und qualifizierte Gespräche für passende Partner vorzubereiten. Dabei geht es nicht um fachliche Beratung durch den Erstkontakt, sondern um saubere Qualifizierung und eine gute Übergabe — ob PKV oder Photovoltaik.', 'Currently 40 people in the VANTARO team reach potential customers by phone, assess interest and needs, and prepare qualified conversations for the right partners. The first contact is not about professional advice, but about clean qualification and a good handover — whether private health insurance or solar PV.')}</p>
                    <div className="about-actions">
                        <a className="btn btn-primary" href="#kontakt">{L('Mit VANTARO sprechen', 'Talk to VANTARO')} <span className="arrow">↗</span></a>
                        <a className="btn btn-outline-light" href="#qualitaet">{L('Qualitätsprozess', 'Quality process')} <span className="arrow">↑</span></a>
                    </div>
                </div>
                <div className="people-visual">
                    <div className="people-top">
                        <strong>VANTARO / OPERATIONS</strong>
                        <span>{L('● im Aufbau', '● in build-up')}</span>
                    </div>
                    <div className="people-count">
                        <strong>40</strong>
                        <span>{L('Menschen, die täglich an qualifizierten Beratungschancen arbeiten.', 'people working every day on qualified advisory opportunities.')}</span>
                    </div>
                    <div className="people-steps">
                        <div className="people-step">
                            <b>01</b>
                            <div>
                                <strong>{L('Erreichen', 'Reach')}</strong>
                                <span>{L('Potenzielle Kunden telefonisch ansprechen.', 'Approach potential customers by phone.')}</span>
                            </div>
                        </div>
                        <div className="people-step">
                            <b>02</b>
                            <div>
                                <strong>{L('Verstehen', 'Understand')}</strong>
                                <span>{L('Interesse, Anlass und Kontext erfassen.', 'Capture interest, reason and context.')}</span>
                            </div>
                        </div>
                        <div className="people-step">
                            <b>03</b>
                            <div>
                                <strong>{L('Übergeben', 'Hand over')}</strong>
                                <span>{L('Passendes Gespräch für den Partner vorbereiten.', 'Prepare the right conversation for the partner.')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* PRICING */}
        <section className="section pricing" id="preise">
            <div className="wrap">
                <div className="section-head"><div className="eyebrow light">{L('Transparent starten', 'Start transparently')}</div><h2>{L('Ein Preis für die Chance.', 'One price for the opportunity.')} <span>{L('Ein System für den Wert.', 'One system for the value.')}</span></h2><p className="lede">{L('Richtwerte für den Einstieg in Versicherung — Energiepakete (Photovoltaik und Wärmepumpe) werden im Pilot nach Gebiet, Lieferart und Volumen vereinbart.', 'Guide prices for getting started in insurance — energy packages (solar PV and heat pumps) are agreed in the pilot by territory, delivery type and volume.')}</p></div>
                <div className="pricing-grid">
                    <article className="price-card featured-price">
                        <div className="price-label">{L('Versicherung / PKV deutschlandweit', 'Insurance / PKV nationwide')}</div><h3>{L('Exklusive PKV-Chancen', 'Exclusive PKV opportunities')}</h3><p>{L('Für Partner, die nicht möglichst viele Datensätze, sondern passende Beratungsgespräche aufbauen wollen.', 'For partners who want to build suitable advisory conversations rather than collect as many data records as possible.')}</p>
                        <div className="price-rows"><div className="price-row"><span>{L('Einzelabnahme', 'Single purchase')}</span><strong>{L('129 €', '€129')} <small>{L('/ Chance', '/ opportunity')}</small></strong></div><div className="price-row"><span>{L('ab 20 Chancen / Monat', 'from 20 opportunities / month')}</span><strong>{L('119 €', '€119')} <small>{L('/ Chance', '/ opportunity')}</small></strong></div></div>
                        <div className="price-label" style={{ marginTop: 27 }}>{L('Versicherung / PKV regional', 'Insurance / PKV regional')}</div><div className="price-rows"><div className="price-row"><span>{L('Einzelabnahme', 'Single purchase')}</span><strong>{L('159 €', '€159')} <small>{L('/ Chance', '/ opportunity')}</small></strong></div><div className="price-row"><span>{L('ab 20 Chancen / Monat', 'from 20 opportunities / month')}</span><strong>{L('149 €', '€149')} <small>{L('/ Chance', '/ opportunity')}</small></strong></div></div>
                        <p className="small">{L('Richtwerte, zzgl. etwaiger USt. und abhängig von Qualitätsstufe, Region und konkreter Vereinbarung. Ein Lead ist kein garantierter Abschluss.', 'Guide prices, plus any applicable VAT, depending on quality level, region and the specific agreement. A lead is not a guaranteed sale.')}</p>
                    </article>
                    <div className="pricing-side">
                        <article className="side-card"><h3>{L('Energie & weitere Produkte', 'Energy & other products')}</h3><p>{L('Photovoltaik und Wärmepumpe als Lead oder Termin; weitere Versicherungssparten mit eigenen Qualitätsstandards.', 'Solar PV and heat pumps as leads or appointments; further insurance lines with their own quality standards.')}</p><ul><li>{L('PV & Wärmepumpe · Lead oder Termin', 'Solar PV & heat pump · lead or appointment')}</li><li>{L('Gebiet und Volumen steuerbar', 'Territory and volume adjustable')}</li><li>{L('BU, Vorsorge, Gewerbe u. a. im Ausbau', 'Disability, retirement, commercial and more in development')}</li></ul></article>
                        <article className="side-card calculator"><h3>{L('Planbar statt Bauchgefühl', 'Plannable, not gut feeling')}</h3><p>{L('Spielen Sie eine monatliche PKV-Abnahme als einfache Budgetgröße durch.', 'Try out a monthly PKV volume as a simple budget figure.')}</p><div className="range-label"><span>{L('Chancen pro Monat', 'Opportunities per month')}</span><strong id="leadCount">20</strong></div><input id="leadRange" type="range" min="10" max="60" defaultValue="20" step="5" aria-label={L('Chancen pro Monat', 'Opportunities per month')} /><div className="calc-result"><span>{L('Richtwert bei 119 €', 'Guide price at €119')}</span><strong id="calcValue">{L('2.380 €', '€2,380')}</strong></div></article>
                    </div>
                </div>
            </div>
        </section>

        <Faq />

        {/* CTA / KONTAKT */}
        <ContactUs />
    </>
  );
}

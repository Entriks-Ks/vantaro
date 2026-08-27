import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Briefcase, Building2, Check, CheckCircle, Clock, Fingerprint, GraduationCap, HeartPulse, Home, Landmark, Layers, LayoutDashboard, Phone, Quote, RefreshCw, ShieldCheck, ShieldHalf, Target, TrendingUp, Umbrella, UserCheck, UserPlus, Users, Zap } from 'lucide-react';
import Faq from './components/Faq';
import ContactUs from './components/ContactUs';
import { TestimonialMarquee } from './components/testimonial';
import { SectorProfileMarquee } from './components/SectorProfiles';

function SectorGrid() {
  const sectors = [
    { icon: HeartPulse, title: 'Private Krankenversicherung', desc: 'Für Selbstständige, Angestellte, Beamte und Unternehmer mit erkennbarem Beratungsanlass.', state: 'Startschwerpunkt', main: true, stat: '68% Terminquote' },
    { icon: ShieldHalf, title: 'Berufsunfähigkeit', desc: 'Absicherungsbedarf, Beruf und Zeitfenster für das Erstgespräch strukturiert vorbereitet.', state: 'kaufbar nach Pilot', stat: '54% Terminquote' },
    { icon: Landmark, title: 'Betriebliche Altersvorsorge', desc: 'Arbeitgeber- und Arbeitnehmergespräche mit passender Gesprächslogik und Zuständigkeit.', state: 'kaufbar nach Pilot', stat: '61% Terminquote' },
    { icon: Umbrella, title: 'Altersvorsorge & Rürup', desc: 'Langfristige Vorsorgeanlässe für Privatkunden, Selbstständige und gutverdienende Zielgruppen.', state: 'kaufbar nach Pilot', stat: '47% Terminquote' },
    { icon: Building2, title: 'Gewerbe & Unternehmer', desc: 'Unternehmen nach Branche, Größe, Risiko und konkreter Absicherungsfrage zuordnen.', state: 'kaufbar nach Pilot', stat: '43% Terminquote' },
    { icon: Home, title: 'Baufinanzierung', desc: 'Finanzierungsanfragen mit realistischem Vorhaben, Zeitfenster und Gesprächsbereitschaft.', state: 'kaufbar nach Pilot', stat: '38% Terminquote' },
    { icon: Briefcase, title: 'Unternehmerabsicherung', desc: 'Absicherung von Personen, Betrieb und Zukunft als anschlussfähiger Beratungspfad.', state: 'kaufbar nach Pilot', stat: '41% Terminquote' },
  ];

  return (
    <section className="section sectors" id="sparten">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Nicht nur PKV</div>
          <h2>Die Beratungschance richtet sich nach Ihrer <span style={{ color: 'var(--signal-dark)' }}>Sparte.</span></h2>
          <p className="lede">VANTARO baut die Nachfrage nicht auf ein einziges Thema. Vermittler können qualifizierte Chancen in mehreren Sparten erwerben — jeweils mit eigenem Anforderungsprofil, Qualitätsstandard und Matching.</p>
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
            <h3>Ihre Sparte fehlt?</h3>
            <p>Wir definieren gemeinsam Zielgruppe, Qualitätskriterien und Kapazität für einen neuen Leadtyp.</p>
            <a className="sector-v2-link" href="#kontakt">Sparte vorschlagen <ArrowUpRight size={14} /></a>
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
      value.textContent = new Intl.NumberFormat('de-DE', {
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
      if (submit) submit.textContent = 'Anfrage vorbereitet ✓';
    };
    form?.addEventListener('submit', onSubmit);

    return () => {
      range?.removeEventListener('input', updateCalc);
      form?.removeEventListener('submit', onSubmit);
    };
  }, []);

  const workspaceTabs = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'leads', label: 'Chancen', icon: UserPlus },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'academy', label: 'Academy', icon: GraduationCap },
  ];

  const portalFeatures = [
    { icon: Layers, title: 'Leadübersicht & Aufgaben', text: 'Neue Chancen, nächste Aktion und Bearbeitungsstatus an einem Ort.' },
    { icon: Landmark, title: 'Guthaben & Reklamationen', text: 'Reserviert, abgebucht, gutgeschrieben — mit nachvollziehbarem Transaktionsverlauf.' },
    { icon: Phone, title: 'Calltracking & Reports', text: 'Erstkontaktzeit, Kontaktquote, Termine und Wirtschaftlichkeit sichtbar.' },
    { icon: UserCheck, title: 'Team & Academy', text: 'Zuständigkeiten, Gesprächsqualität und vertriebliche Entwicklung verbinden.' },
  ];

  const qualityStages = [
    {
      number: '01',
      title: 'Agenten schulen',
      description: 'Gesprächsführung, aktives Zuhören, Dispositionen und klare Rollengrenzen.',
    },
    {
      number: '02',
      title: 'Gespräch führen',
      description: 'Einheitliche Leitfäden statt Zufall — mit Raum für echte Antworten.',
    },
    {
      number: '03',
      title: 'Kontext erfassen',
      description: 'Berufsbild, Anlass, Status und Zeitfenster werden strukturiert dokumentiert.',
    },
    {
      number: '04',
      title: 'Quality Gate prüfen',
      description: 'Dubletten, Mindestkriterien, Nachweis und Exklusivität vor der Übergabe.',
    },
    {
      number: '05',
      title: 'Passend routen',
      description: 'Sparte, Region, Kapazität und Käuferprofil bestimmen die Zuordnung.',
    },
    {
      number: '06',
      title: 'Ergebnis zurückführen',
      description: 'Kontakt, Termin, Antrag und Ergebnisfeedback verbessern die nächste Runde.',
      featured: true,
    },
  ];

  const qualityMetrics = [
    { value: '100 %', label: 'Prozessklarheit' },
    { value: '−32 %', label: 'weniger Reklamationen' },
    { value: '+28 %', label: 'Qualität & Wirkung' },
    { value: 'Loop', label: 'kontinuierlich besser' },
  ];

  const testimonials = [
    {
      quote: "Mit VANTARO erhalten wir passende PKV-Chancen mit Kontext und einem klaren nächsten Schritt. Unser Team kann Beratungsgespräche besser vorbereiten und systematischer neue Kunden gewinnen.",
      author: "PKV-Maklerhaus",
      role: "Geschäftsführer",
      company: "Maklerhaus · Pilotprofil",
      rating: 5,
    },
    {
      quote: "Die Vorqualifizierung hilft uns, schneller in relevante bAV-Gespräche einzusteigen. Wir investieren unsere Zeit dort, wo ein konkreter Anlass und ein echtes Zeitfenster vorhanden sind.",
      author: "bAV-Spezialist",
      role: "Senior Consultant",
      company: "Finanzberatung · Pilotprofil",
      rating: 5,
    },
    {
      quote: "Mit dem Portal sehen wir sofort, was heute bearbeitet werden muss. So gewinnen wir Neukunden strukturierter und können Umsatzchancen vom Erstkontakt bis zum Termin verfolgen.",
      author: "KV-Makler",
      role: "Vertriebsleiter",
      company: "Versicherungsmakler · Pilotprofil",
      rating: 5,
    },
    {
      quote: "Kein unkontrollierter Datenhandel, sondern exklusiv geroutete Interessenten mit echtem Bedarf. Der Qualitätsunterschied ist ab Tag eins spürbar.",
      author: "BU-Fachberater",
      role: "Inhaber",
      company: "Einkommensschutz",
      rating: 5,
    },
    {
      quote: "Die strukturierte Vorbereitung und das transparente Reklamationssystem geben unserem Team maximale Verlässlichkeit in der vertrieblichen Planung.",
      author: "Gewerbemakler",
      role: "Partner",
      company: "Unternehmerabsicherung",
      rating: 5,
    },
    {
      quote: "Von der Lead-Übersicht bis zum Calltracking: Das System ist exakt auf die Anforderungen moderner Makler abgestimmt.",
      author: "Baufinanzierungs-Experte",
      role: "Finanzierungsberater",
      company: "Baufinanzierung",
      rating: 5,
    },
  ];

  const sectorProfiles = [
    { icon: HeartPulse, label: 'Kurzprofil 01', title: 'PKV-Spezialist', description: 'Gesucht werden qualifizierte Selbstständige und Angestellte mit konkretem Beratungsanlass.' },
    { icon: Users, label: 'Kurzprofil 02', title: 'Maklerhaus KV', description: 'Mehr planbare Chancen für ein Team mit klarer regionaler Bearbeitungskapazität.' },
    { icon: Landmark, label: 'Kurzprofil 03', title: 'bAV-Berater', description: 'Arbeitgeberkontakte mit Anlass, Ansprechpartner und gewünschtem nächsten Schritt.' },
    { icon: ShieldHalf, label: 'Kurzprofil 04', title: 'BU-Fachberater', description: 'Fokus auf Beruf, Absicherungsbedarf und eine nachvollziehbare Terminvorbereitung.' },
    { icon: Building2, label: 'Kurzprofil 05', title: 'Gewerbemakler', description: 'Unternehmer und Betriebe nach Branche, Größe und konkreter Absicherungsfrage.' },
    { icon: Home, label: 'Kurzprofil 06', title: 'Baufinanzierer', description: 'Finanzierungsanfragen mit realistischem Zeitfenster und definierter Gesprächsbereitschaft.' },
    { icon: Umbrella, label: 'Kurzprofil 07', title: 'Vorsorgeberater', description: 'Beratungschancen rund um Altersvorsorge, Rürup und langfristige Finanzplanung.' },
    { icon: Briefcase, label: 'Kurzprofil 08', title: 'Unternehmerberater', description: 'Cross-Selling-fähige Gespräche zu Absicherung, Versorgung und Unternehmensrisiken.' },
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
                        Mehr Beratung. Mehr Abschlüsse. <span className="signal-highlight">Mehr planbarer Umsatz.</span>
                    </strong>
                </div>
                <div className="signal-points">
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><Check size={13} strokeWidth={2.6} /></span>
                        <span className="signal-chip-label">Exklusiv geroutet</span>
                    </div>
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><ShieldCheck size={13} strokeWidth={2.2} /></span>
                        <span className="signal-chip-label">Q2 qualifiziert</span>
                    </div>
                    <div className="signal-chip">
                        <span className="signal-chip-icon"><TrendingUp size={13} strokeWidth={2.2} /></span>
                        <span className="signal-chip-label">Skalierbar &amp; messbar</span>
                    </div>
                </div>
            </div>
        </section>

        {/* POSITIONING */}
        <section className="section positioning" id="warum">
            <div className="wrap positioning-grid">
                <div className="positioning-copy">
                    <div className="eyebrow">DIE NEUE VERTRIEBSLOGIK</div>
                    <h2>
                        Keine <span className="accent">Leadbörse.</span>
                        <br />
                        Eine Umsatzmaschine.
                    </h2>
                    <p className="lede">
                        Ein Lead ist kein Erfolg. Erst wenn ein passender Vermittler ihn
                        schnell erreicht, ein relevantes Gespräch entsteht und der Vorgang
                        weitergeführt wird, wird aus Kontakt eine echte Geschäftschance.
                    </p>

                    <div className="quote-line">
                        <span className="quote-icon" aria-hidden="true">
                            <Quote className="icon-md" />
                        </span>
                        <span className="quote-text">
                            Wir liefern nicht einfach Kontakte.
                            <br />
                            Wir bauen die Strecke, auf der Beratung möglich wird.
                        </span>
                    </div>

                    <a className="journey-cta" href="#kontakt">
                        Mehr erfahren
                        <span className="icon-inline journey-cta-icon" aria-hidden="true">
                            <ArrowRight className="icon-md" />
                        </span>
                    </a>
                </div>
                <div className="journey-container" aria-label="Vertriebsprozess">
                    <ol className="journey-steps">
                        <li className="journey-step" data-accent="signal">
                            <span className="journey-badge" aria-hidden="true">
                                01
                            </span>
                            <span className="journey-icon" aria-hidden="true">
                                <Clock className="journey-icon-svg" />
                            </span>
                            <div className="journey-copy">
                                <h3>Geschwindigkeit</h3>
                                <p>
                                    Neue Chancen, klare Aufgaben und ein definierter nächster
                                    Schritt — damit Interesse nicht zwischen Postfach und Rückrufliste
                                    verschwindet.
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
                                <h3>Exklusives Matching</h3>
                                <p>
                                    Routing nach Sparte, Region, Zielgruppe, Kapazität und Kompetenz.
                                    Eine Beratungschance wird nicht zum Preisvergleich zwischen fünf Käufern.
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
                                <h3>Wirtschaftlichkeit</h3>
                                <p>
                                    Kontaktquote, Terminquote, Reklamationen und Kosten pro Ergebnis werden
                                    sichtbar. Nicht nur der Einkaufspreis.
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
                                <h3>Wachstum mit Thread</h3>
                                <p>
                                    PKV als Startpunkt. BU, Vorsorge, bKV, Gewerbe und Finanzierung als
                                    anschlussfähige nächste Kapitel.
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
                    <div className="eyebrow light">Der VANTARO-Thread</div>
                    <h2>Jeder Schritt hat einen Platz. <span>Jede Chance ein Ziel.</span></h2>
                    <p className="lede">VANTARO trennt Produktion, Qualität, Matching und Verkauf nicht — sondern verbindet sie in einer durchgängigen Betriebslogik.</p>
                </div>
                <div className="system-flow">
                    <article className="flow-item"><span className="flow-node"><Phone size={16} /></span><span className="flow-number">01 / KONTAKT</span><h3>Interesse</h3><p>Telefonischer Erstkontakt mit Gesprächsleitfaden, Rückruflogik und sauberer Disposition.</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><ShieldCheck size={16} /></span><span className="flow-number">02 / QUALITÄT</span><h3>Quality Gate</h3><p>Kontext, Zielgruppe, Anlass und Nachweis werden geprüft — bevor die Chance weitergeht.</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><UserCheck size={16} /></span><span className="flow-number">03 / MATCHING</span><h3>Passung</h3><p>Die richtige Chance wird exklusiv dem passenden Vermittler mit verfügbarer Kapazität zugeordnet.</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><Clock size={16} /></span><span className="flow-number">04 / FOLLOW-UP</span><h3>Bearbeitung</h3><p>Aufgaben, Kontaktversuche, Termine und Notizen bilden den nächsten Verkaufsschritt ab.</p><span className="flow-arrow"><ArrowRight /></span></article>
                    <article className="flow-item"><span className="flow-node"><Target size={16} /></span><span className="flow-number">05 / ERGEBNIS</span><h3>Abschluss</h3><p>Ergebnisfeedback macht aus einzelnen Käufen eine optimierbare Umsatzstrecke.</p></article>
                </div>
                <div className="system-note"><div><strong>Das Betriebssystem hinter der Beratung.</strong><p>VANTARO verbindet Telefonie, Qualität, Matching, Guthaben, Reklamation und Ergebnis in einer durchgängigen Vertriebslogik.</p></div><a className="btn btn-outline-light" href="#portal">Portal ansehen <span className="arrow">↗</span></a></div>
            </div>
        </section>

        {/* USECASES */}
        <section className="section usecases" id="anwendungen">
            <div className="wrap">
                <div className="section-head">
                    <div className="eyebrow">Konkrete Anwendungsfälle</div>
                    <h2>Starten Sie mit einer Sparte. <br />Denken Sie in <span style={{ color: "var(--signal-dark)" }}>Kundenwert.</span></h2>
                    <p className="lede">Der Kern ist nicht der Leadtyp. Der Kern ist die Fähigkeit, eine passende Beratungschance sauber in Ihr Vertriebssystem zu übergeben.</p>
                </div>
                <div className="usecase-grid">
                    <article className="usecase featured">
                        <div className="eyebrow light">Kernanwendung / PKV</div>
                        <h3>Ein Selbstständiger sucht Orientierung — Sie erhalten den Kontext.</h3>
                        <p>Berufsbild, Anlass, aktueller Status und gewünschtes Zeitfenster werden strukturiert erfasst. Sie steigen nicht bei null ein, sondern dort, wo Beratung sinnvoll wird.</p>
                        <div className="tag-row"><span className="tag">Q2 qualifiziert</span><span className="tag">exklusiv geroutet</span><span className="tag">Status im Portal</span></div>
                        <a className="usecase-link" href="#kontakt">PKV-Pilot besprechen <span className="icon-inline"><ArrowUpRight /></span></a>
                    </article>
                    <article className="usecase">
                        <div className="eyebrow">Der nächste Thread</div>
                        <h3>Aus einem Gespräch wird ein relevanter Kundenpfad.</h3>
                        <p>Wenn der Anlass passt, kann aus der PKV-Beratung ein sinnvoller nächster Bedarf entstehen — nicht als Druck, sondern als strukturierte Anschlusschance.</p>
                        <div className="usecase-stack">
                            <div className="stack-item"><strong>BU</strong><span>Einkommensschutz</span></div>
                            <div className="stack-item"><strong>Vorsorge</strong><span>Altersvorsorge</span></div>
                            <div className="stack-item"><strong>bKV</strong><span>Arbeitgeber</span></div>
                            <div className="stack-item"><strong>Gewerbe</strong><span>Unternehmer</span></div>
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
                    <div className="eyebrow">Ihr Makler-Workspace</div>
                    <h2>Die Chance ist nicht im Postfach. Sie ist <span>im System.</span></h2>
                    <p className="lede">Ein Portal für die Dinge, die nach der Übergabe zählen: priorisieren, kontaktieren, terminieren, dokumentieren und aus Ergebnissen lernen.</p>
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
                    <a className="btn btn-dark" href="#kontakt">Workspace-Demo anfragen <span className="arrow">→</span></a>
                </div>

                <div className="workspace-shell" aria-label="Interaktive Vorschau des VANTARO-Maklerportals">
                    <div className="workspace-head">
                        <div className="workspace-brand"><span className="mini-mark">V</span> VANTARO / WORKSPACE</div>
                        <div className="workspace-user"><span>Max Beispiel</span><span className="avatar">ME</span></div>
                    </div>
                    <div className="workspace-layout">
                        <aside className="workspace-nav" aria-label="Portalbereiche">
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
                                        <h3>Guten Morgen, Max</h3>
                                        <p>Hier sehen Sie, was heute Bewegung braucht.</p>
                                    </div>
                                    <span className="period">Diese Woche</span>
                                </div>
                                <div className="metric-grid">
                                    <div className="metric"><span>Neue Chancen</span><strong>24</strong><small>+18 % vs. Vorwoche</small></div>
                                    <div className="metric"><span>Erstkontakt</span><strong>18m</strong><small>Median dieser Woche</small></div>
                                    <div className="metric"><span>Termine</span><strong>7</strong><small>3 in Vorbereitung</small></div>
                                    <div className="metric"><span>Guthaben</span><strong>2.840 €</strong><small>verfügbar</small></div>
                                </div>
                                <div className="workspace-panels">
                                    <div className="panel panel-leads">
                                        <div className="panel-heading"><strong>Priorisierte Chancen</strong><a href="#kontakt">Alle anzeigen</a></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>PKV / Selbstständig</strong><span>Q2 · vor 11 Minuten · PLZ 50667</span></div></div><div className="lead-price"><strong>129 €</strong><span>neu</span></div></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>PKV / Angestellter</strong><span>Q1 · vor 28 Minuten · PLZ 70173</span></div></div><div className="lead-price"><strong>129 €</strong><span>offen</span></div></div>
                                        <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>BU / Selbstständig</strong><span>Q2 · gestern · PLZ 40213</span></div></div><div className="lead-price"><strong>auf Anfrage</strong><span>Rückruf</span></div></div>
                                    </div>
                                    <div className="panel panel-chart">
                                        <div className="panel-heading"><strong>Verlauf</strong><a href="#preise">Reports</a></div>
                                        <div className="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                                        <div className="chart-legend"><span>Kontaktquote</span><b>64 %</b></div>
                                    </div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'leads' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>Ihre Chancen</h3>
                                        <p>Filtern, priorisieren und den nächsten Schritt auslösen.</p>
                                    </div>
                                    <span className="period">Alle Sparten</span>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>Aktive Chancen</strong><a href="#kontakt">Filter öffnen</a></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>PKV / Selbstständig · Q2</strong><span>Exklusiv · Zeitfenster bestätigt · PLZ 50667</span></div></div><div className="lead-price"><strong>129 €</strong><span className="pill">Jetzt kontaktieren</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>PKV / Angestellter · Q1</strong><span>Interessent erreicht · Rückruf um 16:30 Uhr</span></div></div><div className="lead-price"><strong>129 €</strong><span>Rückruf</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>BU / Selbstständig · Q2</strong><span>Termin angefragt · Donnerstag, 10:00 Uhr</span></div></div><div className="lead-price"><strong>Termin</strong><span className="pill">bestätigt</span></div></div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'team' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>Team-Überblick</h3>
                                        <p>Aktivität, Verteilung und Coaching-Bedarf.</p>
                                    </div>
                                    <span className="period">Heute</span>
                                </div>
                                <div className="metric-grid">
                                    <div className="metric"><span>Aktive Nutzer</span><strong>6</strong><small>4 online</small></div>
                                    <div className="metric"><span>Offene Aufgaben</span><strong>13</strong><small>5 dringend</small></div>
                                    <div className="metric"><span>Terminquotes</span><strong>29 %</strong><small>Trend ↑</small></div>
                                    <div className="metric"><span>QA-Score</span><strong>92 %</strong><small>letzte Stichprobe</small></div>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>Coaching-Hinweise</strong><a href="#kontakt">Academy öffnen</a></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot orange"></span><div><strong>Einwandbehandlung</strong><span>2 Gespräche zur Nachschulung markiert</span></div></div><div className="lead-price"><strong>Heute</strong><span>offen</span></div></div>
                                    <div className="lead-row"><div className="lead-title"><span className="lead-dot"></span><div><strong>Speed-to-Lead</strong><span>Team-Median verbessert sich</span></div></div><div className="lead-price"><strong>18m</strong><span>aktuell</span></div></div>
                                </div>
                              </div>
                            )}
                            {workspaceView === 'academy' && (
                              <div>
                                <div className="workspace-title">
                                    <div>
                                        <h3>Academy</h3>
                                        <p>Training direkt an der Vertriebsrealität.</p>
                                    </div>
                                    <span className="period">Mein Lernpfad</span>
                                </div>
                                <div className="panel">
                                    <div className="panel-heading"><strong>Dein nächstes Modul</strong><span className="pill">68 % Fortschritt</span></div>
                                    <h4>PKV-Erstgespräch: Bedarf erkennen, nicht beraten</h4>
                                    <p className="small">Gesprächsstruktur · Grenzen der Rolle · saubere Übergabe an den Vermittler</p>
                                    <div className="academy-progress"><div className="academy-progress-bar" /></div>
                                    <div className="workspace-tag">12 Minuten · 1 Rollenspiel</div>
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
                        <div className="eyebrow">Qualität ist ein Produktionssystem</div>
                        <h2>Vertrauen<br />entsteht, wenn<br /><span>nichts im Nebel<br />bleibt.</span></h2>
                        <p className="lede">Von der Agentenschulung bis zur Reklamationsentscheidung: VANTARO macht die relevanten Punkte sichtbar und wiederholbar.</p>
                        <div className="quality-callout">
                            <span className="icon-inline"><ArrowUpRight className="icon-lg" /></span>
                            <div><strong>Kein Beratungstheater.</strong><p>Agenten gut führen in Prozess und Kontext. Die fachliche Beratung gehört in die Hände des qualifizierten Vermittlers.</p></div>
                        </div>
                    </div>

                    <div className="quality-steps" aria-label="Operatives Qualitätssystem">
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
                    <div className="section-head"><div className="eyebrow">Proof ohne große Worte</div><h2>Wir zeigen, <span style={{ color: "var(--signal-dark)" }}>wie es funktioniert.</span></h2><p className="lede">Echte Kundenstimmen und Fallstudien gehören zu echten Partnerschaften. Bis dahin überzeugt VANTARO mit einem überprüfbaren Prozess statt mit erfundenen Logos.</p></div>
                    <div className="proof-badge">
                        <span className="icon-inline"><ShieldCheck /></span>
                        <span>Proof-Architektur statt Behauptungen — transparent von Anfang an.</span>
                    </div>
                </div>
                <div className="proof-grid">
                    <article className="proof-card"><div className="proof-mark"><Fingerprint /></div><h3>Jede Chance hat eine ID</h3><p>Zeitstempel, Qualitätsstatus, Exklusivität, Zuordnung und Statusverlauf machen nachvollziehbar, was wann passiert ist.</p></article>
                    <article className="proof-card dark"><div className="proof-mark"><CheckCircle /></div><h3>Jeder Kauf hat Regeln</h3><p>Guthaben, Reservierung, Gutschrift und Reklamationsfristen werden nicht per Zuruf verwaltet, sondern im System geführt.</p></article>
                    <article className="proof-card accent"><div className="proof-mark"><Clock /></div><h3>Jeder Pilot wird messbar</h3><p>Kontaktquote, Termine, Bearbeitungszeit und Storno werden zur Basis für die nächste Entscheidung — nicht zum Reporting-Schmuck.</p></article>
                </div>
                <p className="proof-footnote"><strong>Aktueller Status:</strong> VANTARO befindet sich im Aufbau der Pilotpartnerschaften. Partnerstimmen, Logos und Fallstudien werden nach Freigabe durch echte Finanzdienstleister ergänzt.</p>
            </div>
        </section>

        {/* REFERENCES */}
        <section className="section references" id="referenzen">
            <div className="wrap">
                <div className="references-head">
                    <div className="section-head">
                        <div className="eyebrow">Maklerstimmen &amp; Praxisbilder</div>
                        <h2>Damit andere Vermittler sehen, <span style={{ color: "var(--signal-dark)" }}>wie es funktioniert.</span></h2>
                        <p className="lede">Die folgenden Profile sind als redaktionelle Beispiel- und Pilotprofile angelegt. Namen, Logos und Aussagen werden vor dem Livegang nur mit Freigabe und belegbaren Daten veröffentlicht.</p>
                    </div>
                    <div className="reference-disclosure">
                        <div className="disclosure-pill"><ShieldCheck size={14} /> Transparenz</div>
                        <strong>Wichtig für Ihre Glaubwürdigkeit</strong>
                        <p>Beispieltexte sind bereits strukturiert. Echte Referenzen können Sie später ohne Umbau an derselben Stelle einsetzen.</p>
                    </div>
                </div>

                <div className="reference-marquee-wrapper">
                    <TestimonialMarquee testimonials={testimonials} speed={0.7} pauseOnHover={false} />
                </div>

                <div className="reference-mini-section">
                    <div className="reference-mini-head">
                        <span className="eyebrow">Sparten-Überblick</span>
                        <h3>8 Zielgruppen-Profile im Einsatz</h3>
                    </div>
                    <SectorProfileMarquee profiles={sectorProfiles} speed={0.6} pauseOnHover={false} direction="right" />
                </div>
            </div>
        </section>

        {/* ABOUT */}
        <section className="section about" id="ueber-uns">
            <div className="wrap about-grid">
                <div className="about-copy">
                    <div className="eyebrow light">Über VANTARO</div>
                    <h2>40 Menschen. <span>Ein gemeinsamer Fokus.</span></h2>
                    <p className="lede">Unser Team arbeitet daran, aus Gesprächen echte Beratungschancen zu machen — strukturiert, professionell und mit einem klaren Verständnis für die Anforderungen von Finanzdienstleistern.</p>
                    <p>Aktuell arbeiten 40 Personen im VANTARO-Team daran, potenzielle Kunden telefonisch zu erreichen, Interesse und Bedarf einzuordnen und qualifizierte Gespräche für passende Vermittler vorzubereiten. Dabei geht es nicht um Versicherungsberatung durch den Erstkontakt, sondern um saubere Qualifizierung und eine gute Übergabe.</p>
                    <div className="about-actions">
                        <a className="btn btn-primary" href="#kontakt">Mit VANTARO sprechen <span className="arrow">↗</span></a>
                        <a className="btn btn-outline-light" href="#qualitaet">Qualitätsprozess <span className="arrow">↑</span></a>
                    </div>
                </div>
                <div className="people-visual">
                    <div className="people-top">
                        <strong>VANTARO / OPERATIONS</strong>
                        <span>● im Aufbau</span>
                    </div>
                    <div className="people-count">
                        <strong>40</strong>
                        <span>Menschen, die täglich an qualifizierten Beratungschancen arbeiten.</span>
                    </div>
                    <div className="people-steps">
                        <div className="people-step">
                            <b>01</b>
                            <div>
                                <strong>Erreichen</strong>
                                <span>Potenzielle Kunden telefonisch ansprechen.</span>
                            </div>
                        </div>
                        <div className="people-step">
                            <b>02</b>
                            <div>
                                <strong>Verstehen</strong>
                                <span>Interesse, Anlass und Kontext erfassen.</span>
                            </div>
                        </div>
                        <div className="people-step">
                            <b>03</b>
                            <div>
                                <strong>Übergeben</strong>
                                <span>Passendes Gespräch für Vermittler vorbereiten.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* PRICING */}
        <section className="section pricing" id="preise">
            <div className="wrap">
                <div className="section-head"><div className="eyebrow light">Transparent starten</div><h2>Ein Preis für die Chance. <span>Ein System für den Wert.</span></h2><p className="lede">Die folgenden PKV-Preise sind Richtwerte für den Start und werden im Pilot anhand von Qualität, Exklusivität und Ergebnis validiert.</p></div>
                <div className="pricing-grid">
                    <article className="price-card featured-price">
                        <div className="price-label">PKV / deutschlandweit</div><h3>Exklusive PKV-Chancen</h3><p>Für Vermittler, die nicht möglichst viele Datensätze, sondern passende Beratungsgespräche aufbauen wollen.</p>
                        <div className="price-rows"><div className="price-row"><span>Einzelabnahme</span><strong>129 € <small>/ Chance</small></strong></div><div className="price-row"><span>ab 20 Chancen / Monat</span><strong>119 € <small>/ Chance</small></strong></div></div>
                        <div className="price-label" style={{ marginTop: 27 }}>PKV / regional</div><div className="price-rows"><div className="price-row"><span>Einzelabnahme</span><strong>159 € <small>/ Chance</small></strong></div><div className="price-row"><span>ab 20 Chancen / Monat</span><strong>149 € <small>/ Chance</small></strong></div></div>
                        <p className="small">Richtwerte, zzgl. etwaiger USt. und abhängig von Qualitätsstufe, Region und konkreter Vereinbarung. Ein Lead ist kein garantierter Abschluss.</p>
                    </article>
                    <div className="pricing-side">
                        <article className="side-card"><h3>Weitere Sparten</h3><p>BU, Altersvorsorge, Rürup, bKV, Gewerbeversicherung, Baufinanzierung und Unternehmerabsicherung folgen mit eigenen Qualitätsstandards.</p><ul><li>eigener Leadtyp je Sparte</li><li>Preis nach Beratungswert</li><li>Q2 / Q3 / Live-Transfer getrennt steuerbar</li></ul></article>
                        <article className="side-card calculator"><h3>Planbar statt Bauchgefühl</h3><p>Spielen Sie eine monatliche PKV-Abnahme als einfache Budgetgröße durch.</p><div className="range-label"><span>Chancen pro Monat</span><strong id="leadCount">20</strong></div><input id="leadRange" type="range" min="10" max="60" defaultValue="20" step="5" aria-label="Chancen pro Monat" /><div className="calc-result"><span>Richtwert bei 119 €</span><strong id="calcValue">2.380 €</strong></div></article>
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

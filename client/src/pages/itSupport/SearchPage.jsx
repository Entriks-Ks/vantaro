import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, ListChecks, Users } from 'lucide-react';
import { CONTACT_STATUS, formatEuro, label, LEAD_STATUS, PAYMENT_STATUS, ROLE } from './format';
import { L } from './i18n';
import { Card, Chip, EmptyState, ErrorBanner, Loading, Page, useApi } from './ui';

function Section({ icon: Icon, title, total, loading, error, onAll, children, empty }) {
  return (
    <Card
      title={<span className="its-search-head"><Icon size={16} aria-hidden="true" /> {title} {total ? <em>{total}</em> : null}</span>}
      actions={total > 5 ? <button type="button" className="its-link" onClick={onAll}>{L(`Alle ${total} anzeigen`, `Show all ${total}`)}</button> : null}
      flush
    >
      <ErrorBanner error={error} />
      {loading ? <Loading /> : (children || <EmptyState title={empty} />)}
    </Card>
  );
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get('q') || '').trim();
  const leads = useApi(q ? '/leads' : null, { q, limit: 5 });
  const users = useApi(q ? '/users' : null, { q, limit: 5 });
  const payments = useApi(q ? '/payments' : null, { q, limit: 5 });

  return (
    <Page
      title={L('Suche', 'Search')}
      description={q
        ? L(`Ergebnisse für „${q}“ in Leads, Nutzern und Zahlungen.`, `Results for "${q}" in leads, users and payments.`)
        : L('Suchbegriff oben eingeben.', 'Enter a search term above.')}
    >
      {q ? (
        <div className="its-stack">
          <Section
            icon={ListChecks}
            title="Leads"
            total={leads.data?.total}
            loading={leads.loading}
            error={leads.error}
            empty={L('Keine Leads gefunden', 'No leads found')}
            onAll={() => navigate(`/it-support/leads?q=${encodeURIComponent(q)}`)}
          >
            {leads.data?.leads?.length ? (
              <ul className="its-result-list">
                {leads.data.leads.map((lead) => (
                  <li key={lead.id}>
                    <button type="button" onClick={() => navigate(`/it-support/leads?id=${lead.id}`)}>
                      <strong>{lead.fullName}</strong>
                      <span>{lead.email || lead.phone || '—'}</span>
                      <Chip tone="neutral" icon={false}>{label(LEAD_STATUS, lead.status)}</Chip>
                      {lead.contactStatus ? <Chip tone="info" icon={false}>{label(CONTACT_STATUS, lead.contactStatus)}</Chip> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section
            icon={Users}
            title={L('Nutzer', 'Users')}
            total={users.data?.total}
            loading={users.loading}
            error={users.error}
            empty={L('Keine Nutzer gefunden', 'No users found')}
            onAll={() => navigate(`/it-support/users?q=${encodeURIComponent(q)}`)}
          >
            {users.data?.users?.length ? (
              <ul className="its-result-list">
                {users.data.users.map((user) => (
                  <li key={user.id}>
                    <button type="button" onClick={() => navigate(`/it-support/users?id=${user.id}`)}>
                      <strong>{user.fullName || user.email}</strong>
                      <span>{user.email}</span>
                      <Chip tone="neutral" icon={false}>{label(ROLE, user.role)}</Chip>
                      {!user.verified ? <Chip tone="warn">{L('Unbestätigt', 'Unconfirmed')}</Chip> : null}
                      {user.blocked ? <Chip tone="error">{L('Gesperrt', 'Blocked')}</Chip> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
          <Section
            icon={CreditCard}
            title={L('Zahlungen', 'Payments')}
            total={payments.data?.total}
            loading={payments.loading}
            error={payments.error}
            empty={L('Keine Zahlungen gefunden', 'No payments found')}
            onAll={() => navigate(`/it-support/payments?q=${encodeURIComponent(q)}`)}
          >
            {payments.data?.payments?.length ? (
              <ul className="its-result-list">
                {payments.data.payments.map((payment) => (
                  <li key={payment.id}>
                    <button type="button" onClick={() => navigate(`/it-support/payments?id=${payment.id}`)}>
                      <strong>{payment.invoiceNumber}</strong>
                      <span>{payment.berater?.fullName || payment.billingEmail || '—'} · {formatEuro(payment.grossCents)}</span>
                      <Chip tone="neutral" icon={false}>{label(PAYMENT_STATUS, payment.status)}</Chip>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        </div>
      ) : <EmptyState title={L('Suchbegriff eingeben', 'Enter a search term')} />}
    </Page>
  );
}

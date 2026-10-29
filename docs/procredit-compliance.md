# Vantaro – ProCredit Bank e-Commerce: security and compliance overview

Prepared for the ProCredit Bank compliance team as part of the go-live review.
Status: draft for review, 2026-10-29. Items marked **[to be provided by Entriks]** are still open.

## Scope: one-time payments only

Vantaro (operated by Entriks) sells lead packages to its business customers. Customers pay
**once per purchase** by card, using the **ProCredit Hosted Payment Page (HPP)** in the
Quipu gateway (order type *Purchase*).

- Vantaro does **not** use Card-on-File, stored credentials, tokens or recurring/merchant-initiated payments, and has no plans to.
- Card details are entered only on ProCredit's payment page. The full card number (PAN), CVC and expiry date entry never pass through Vantaro's servers.
- Vantaro **stores no cards and no card tokens**. After a payment, it keeps only the masked card number (last four digits), card brand and the other fields listed in section 2.

The flow:

1. The customer chooses a package. The Vantaro API creates a Purchase order via the ProCredit API (mutual TLS) and redirects the customer to the ProCredit HPP.
2. The customer pays on the HPP, and ProCredit redirects back to `…/api/payments/return?token=…`.
3. The Vantaro API does not rely on the redirect parameters. It confirms the result with *Get Order Details* (mutual TLS) and only then marks the payment as paid.

Code: `server/src/lib/procredit.js` (gateway client), `server/src/lib/payments.js` (payment flow), `server/src/routes/payments.js` (API routes).

Because no tokens are stored, the token-specific parts of "Requirements for implementing recurring payments" do not apply. The general security requirements are addressed below.

---

## 1. Monitoring and logging of suspicious activity

**Payment audit log.** Every payment event is written to the database table `payment_audit_log`
(`server/supabase/payment_audit_log.sql`, written by `server/src/lib/paymentAudit.js`):

| Event | When |
|---|---|
| `checkout_created` | An order was created with ProCredit |
| `payment_paid` | ProCredit confirmed the payment |
| `payment_failed` | ProCredit reported the payment as declined, cancelled or failed |
| `payment_synced` | A customer manually re-checked the status of their payment |
| `return_invalid_token` | Someone opened the bank return URL with an unknown or malformed reference |
| `suspicious_activity` | A rate limit was exceeded, or a customer was blocked after repeated failed payments |

Each entry records the user, the payment, IP address, browser user agent and the time.
Card data, ProCredit order passwords, return tokens and certificate material are **never**
logged: sensitive fields are removed before writing, and anything that looks like a full card
number is masked. Only administrators (server-side service role) can read the table, because
row-level security blocks all client access.

**Abuse protection** (`server/src/lib/paymentSecurity.js`):

- **Rate limits** on starting a payment (10 per user per 15 min), on the bank return URL (30 per IP per 15 min) and on manual status checks (30 per user per 15 min). When a limit is exceeded, the request is rejected with HTTP 429 and the event is logged as `suspicious_activity`.
- **Failed-payment lockout:** if a customer has **more than 5 failed payments within one hour**, the event is logged as `suspicious_activity`, administrators get an email alert, and that customer cannot start or check payments for **one hour** (HTTP 429). The count is based on stored payment records, so it still applies after a server restart.
- The bank return URL only accepts the random, single-purpose return reference (24 random bytes). A plain payment ID is no longer accepted there.

**Response:** administrators get an email for every lockout and review `suspicious_activity`
entries. The response process is described in section 7.

## 2. Data retention policy

Vantaro stores the following payment-related data:

| Data | Where | Purpose | Retention |
|---|---|---|---|
| Masked card number (last 4 digits), card brand | `lead_payments` | Invoice, receipt, customer support | With the invoice (see below) |
| Cardholder name and card expiry month/year, as returned by ProCredit | `lead_payments` | Shown on the receipt and in the customer dashboard | With the invoice *(under review, see open points)* |
| Amount, status, invoice number, package, billing name/e-mail/company | `lead_payments` | Invoicing and accounting | **10 years** (German commercial/tax law, § 147 AO / § 257 HGB) *(legal review pending, see note)* |
| ProCredit order ID, approval code, transaction time | `lead_payments` | Proof of payment, reconciliation with the bank, refunds | With the invoice |
| ProCredit order password (encrypted, see section 4) | `lead_payments` | Needed to query the order status from ProCredit | With the payment record |
| Return reference (random token) | `lead_payments` | Matches the bank redirect to the payment | With the payment record |
| Payment audit log (events, IP, user agent) | `payment_audit_log` | Security monitoring (section 1) | **12 months**, longer only if needed for an open incident |

**Never stored:** full card number (PAN), CVC/CVV, PIN, magnetic stripe or chip data, card tokens.

Note for legal review: since 1 Jan 2025 (Bürokratieentlastungsgesetz IV), German law may require
**8** rather than 10 years for accounting vouchers such as invoices. Entriks will confirm the exact
period. The customer privacy notice currently says 10 years.

The 12-month deletion of audit log entries runs as a scheduled database job. The statement is
provided in `server/supabase/payment_audit_log.sql`. **[Entriks to confirm the job is active in production]**

## 3. Access control to payment data

- **Database:** the payment tables have row-level security enabled, and all access for the public/anonymous and logged-in database roles is revoked. Only the Vantaro API (server-side service key) can read them (`server/supabase/lead_payments.sql`, `server/supabase/payment_audit_log.sql`).
- **API**, all routes require a logged-in, e-mail-verified user (`server/src/routes/payments.js`):
  - `GET /api/payments` (all payments): **administrators only**.
  - `GET /api/payments/mine`: only the caller's own payments.
  - `GET /api/payments/:id/invoice`: the owner of the payment or an administrator. Other users get "not found", so the API does not reveal that the payment exists.
  - `POST /api/payments/:id/sync`: only the owner of the payment.
  - These rules are covered by automated tests (`server/test/payments.test.js`, "access control").
- **Gateway credentials:** the ProCredit client certificate and private key exist only as server environment configuration on the hosting platform. They are not in the code repository or the database, and never reach the browser.
- **Administrator accounts** are set explicitly by the server configuration (`ADMIN_EMAILS`).
- **Regular review:** quarterly review of administrator accounts, hosting (Render) and database (Supabase) access, and of who holds the ProCredit certificate and encryption key, following the checklist and sign-off table in the [Access Control Policy](security/access-control-policy.md).

## 4. Encryption in transit and at rest

**In transit**

- Vantaro ↔ ProCredit: HTTPS with **mutual TLS**. Vantaro authenticates with the merchant certificate issued by ProCredit, and server certificates are always verified (`rejectUnauthorized: true`, ProCredit CA plus public roots) (`server/src/lib/procredit.js`).
- Customer ↔ Vantaro website/API: HTTPS only (managed TLS of the hosting platform).
- Customer ↔ ProCredit: card entry happens on ProCredit's HPP over HTTPS.

**At rest**

- The ProCredit **order password** (needed to query an order) is encrypted with **AES-256-GCM** before it is stored. A random IV is used per value and the authentication tag detects tampering (`server/src/lib/paymentCrypto.js`). The key (`PAYMENT_ENCRYPTION_KEY`, 256 bits, generated with `openssl rand -hex 32`) is held only in the server environment, separately from the database. **The API refuses to start in production without it.** Values stored before encryption was introduced are still readable.
- The database is hosted on Supabase, which encrypts stored data and backups on disk (AES-256, provider-managed).
- No card data is stored (section 2), so there is no cardholder data to encrypt.
- No API response or log line contains the order password, card data or certificate material. The only exception is the redirect link to the ProCredit HPP, which must contain the order ID and password as the ProCredit integration requires. It is sent only to the customer who started the payment.

## 5. Informing customers about payment data handling

The privacy policy (`client/src/pages/Datenschutz.jsx`, section 6 "Zahlungsabwicklung", public at
`https://www.vantaro.io` → Datenschutz) tells customers:

- payments are processed by ProCredit Bank on its own secure payment page;
- card details never reach Vantaro, and no cards are stored for later or recurring charges;
- which payment data Vantaro keeps (masked card number, brand, cardholder name and expiry as provided by the bank, amount, status, invoice and bank references), and why;
- the legal basis and the retention period (10 years for invoices, 12 months for security logs; legal review pending, see section 2);
- that ProCredit Bank receives the payment data (section 8 "Empfänger").

Each customer also receives a payment confirmation e-mail with the invoice after every successful payment.

## 6. Regular security assessments

- Automated tests for the payment security controls (audit logging, rate limits, failed-payment lockout, access control, encryption) run with `npm test` in `server/`. They use a mock gateway and never call the bank.
- Penetration tests, monthly dependency scanning (`npm audit` / Dependabot) with fix deadlines, monthly log reviews and the schedule of planned assessments: see the [Security Testing Plan](security/security-testing-plan.md). Provider and dates are still to be filled in there.

## 7. Incident response plan

See the [Incident Response Plan](security/incident-response-plan.md). It covers severity levels, roles, containment
(stopping payments, replacing the ProCredit certificate, rotating `PAYMENT_ENCRYPTION_KEY`), **notification of ProCredit Bank
within 24 hours**, data protection notifications within 72 hours, recovery and post-incident review. Detection sources include the
`suspicious_activity` alerts and the payment audit log (section 1). Names and contacts are still to be filled in.

---

### File references

| Topic | File |
|---|---|
| ProCredit client (mutual TLS) | `server/src/lib/procredit.js` |
| Gateway selection (mock refused in production) | `server/src/lib/paymentGateway.js` |
| Payment flow | `server/src/lib/payments.js` |
| Payment routes and access rules | `server/src/routes/payments.js` |
| Audit log | `server/src/lib/paymentAudit.js`, `server/supabase/payment_audit_log.sql` |
| Rate limits and lockout | `server/src/lib/paymentSecurity.js` |
| Encryption at rest | `server/src/lib/paymentCrypto.js` |
| Payment tables | `server/supabase/lead_payments*.sql` |
| Tests | `server/test/payments.test.js`, `server/test/paymentCrypto.test.js` |
| Privacy policy | `client/src/pages/Datenschutz.jsx` |
| Onboarding / configuration | `server/docs/procredit-onboarding.md` |

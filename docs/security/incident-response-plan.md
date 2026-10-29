# Incident Response Plan – Vantaro Payments

| | |
|---|---|
| **Title** | Incident Response Plan – Vantaro Payments |
| **Company** | Entriks LLC |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-10-29 |
| **Owner** | [Name, role] |
| **Next review date** | 2027-10-29 (and after every incident or exercise) |
| **Covers** | ProCredit requirement 7 |

## 1. Scope

This plan applies to any security incident, or suspected incident, involving Vantaro's payments:

- payment records in the database (`lead_payments`: amounts, status, masked card data, billing details, bank order references);
- the **ProCredit merchant certificate and private key** (Merchant ID [Merchant ID]);
- the **`PAYMENT_ENCRYPTION_KEY`** that encrypts stored ProCredit order passwords;
- the payment audit log (`payment_audit_log`);
- the payment flow: checkout, the bank return URL, status checks and the admin payment overview.

Vantaro processes **one-time payments only** and stores **no cards or card tokens**. Card numbers
and CVV are entered only on ProCredit's payment page and never reach Vantaro. So an incident can
expose payment metadata, credentials or keys, but not card numbers or tokens held by Vantaro.

**Systems:** API on Render (`vantaro-api`), database on Supabase, e-mail via Resend, code on GitHub (`Entriks-Ks/vantaro`).

## 2. Severity levels

| Level | Meaning | Examples | Response |
|---|---|---|---|
| **Critical** | Keys or certificates exposed, or payments can be manipulated | ProCredit certificate/private key leaked; `PAYMENT_ENCRYPTION_KEY` or Supabase service-role key leaked; database or backup leaked; payments marked paid without a real payment | Immediately. Bank informed **within 24 h** |
| **High** | Unauthorised access, no confirmed data loss yet | Unauthorised admin login; compromised Render, Supabase, GitHub or Resend account | Within 1 hour. Bank informed within 24 h if the certificate or payments may be affected |
| **Medium** | Attacks that the controls stopped | Spike in `suspicious_activity` alerts; customer locked after repeated failed payments (possible card testing); many invalid return tokens from one IP | Same business day |
| **Low** | Isolated anomaly, no impact | Single rate-limit hit; one blocked user who explains it | Next business day, recorded |

If unsure, choose the **higher** level.

## 3. Roles

| Role | Responsibility | Primary | Deputy |
|---|---|---|---|
| **Incident Lead** | Owns the incident, sets severity, keeps the incident log | [Name / Email / Phone] | [Name / Email / Phone] |
| **Technical Lead** | Investigation, containment, fix, recovery | [Name / Email / Phone] | [Name / Email / Phone] |
| **Communications** | Notifications to ProCredit, customers, authority | [Name / Email / Phone] | [Name / Email / Phone] |
| **Management sign-off** | Approves stopping payments and external notifications | [Name / Email / Phone] | [Name / Email / Phone] |

One person may hold several roles, but every role needs a deputy.

| External contact | Details |
|---|---|
| ProCredit Bank – incident notification | [Bank contact: name / email / phone] |
| Data protection authority | [Competent authority – to confirm] |
| Legal counsel | [Name / Email / Phone] |

## 4. Response steps

### Step 1 – Detect and record

Sources: `suspicious_activity` alert e-mails to the admins, the `payment_audit_log` table, Render and
Supabase alerts, GitHub security alerts, reports from customers or ProCredit Bank.

- Tell the Incident Lead **immediately**.
- The Incident Lead opens an incident log ([location]) and records with timestamps (UTC): detection time, source, severity, and every action and decision.
- The **detection time** starts the 24-hour clock for the bank and the 72-hour clock for the authority.

### Step 2 – Contain

Do what fits; for Critical incidents, all that apply:

- **Stop payments:** in Render, remove `PROCREDIT_API_BASE_URL` from the `vantaro-api` environment and redeploy. Checkout then returns "not configured" (HTTP 503) and no new orders reach the bank. Requires Management sign-off.
- **Merchant certificate leaked:** ask ProCredit to revoke it and issue a new one (new CSR, as in `server/docs/procredit-onboarding.md`); replace `PROCREDIT_CERT_PEM` / `PROCREDIT_KEY_PEM` in Render.
- **`PAYMENT_ENCRYPTION_KEY` leaked:** set a new key and re-encrypt the stored order passwords [re-encryption script – to be written]. Order passwords only matter for payments that are still pending.
- **Accounts:** reset passwords and revoke sessions of affected admins; remove them from `ADMIN_EMAILS` if needed; rotate the Supabase service-role key and the Resend API key if they may be exposed.
- **Preserve evidence** before changing anything: export `payment_audit_log`, Render logs and Supabase logs. Delete nothing.

### Step 3 – Notify ProCredit Bank within 24 hours

For every Critical incident, and every High incident that may affect the certificate or payments,
Communications notifies **[bank contact]** within **24 hours of detection**, even if the investigation
is not finished. Updates follow as facts become known.

> **Subject:** Security incident notification – Entriks LLC – Vantaro – Merchant ID [ID]
>
> Dear [Name],
>
> We are informing you of a security incident in accordance with our merchant obligations.
>
> - **What happened:** [short description]
> - **Detected:** [date, time UTC]; **started (if known):** [date, time UTC]
> - **Affected Merchant ID:** [ID]
> - **Data affected:** [merchant certificate / keys / payment records / none confirmed]. Vantaro stores no card numbers or card tokens.
> - **Number of customers / payments affected:** [number or "under investigation"]
> - **Actions taken:** [e.g. payments stopped, certificate revocation requested, keys rotated]
> - **Requests to the bank:** [e.g. revoke certificate, issue new certificate, monitor transactions]
> - **Next update:** [date/time]
> - **Contact person:** [Name, role, email, phone]
>
> Kind regards,
> [Name], Entriks LLC

### Step 4 – Notify the authority and customers

Vantaro's customers are in Germany, so the GDPR applies. Where personal data is involved,
Communications (with legal counsel) notifies:

- the **competent data protection authority within 72 hours** of becoming aware (GDPR Art. 33), unless the breach is unlikely to result in a risk to people;
- **affected customers without undue delay** if there is a high risk to them (GDPR Art. 34).

> **To the authority** – Subject: Personal data breach notification – Entriks LLC (Vantaro)
>
> - **Controller:** [legal name, address], contact: [Name, email, phone]
> - **What happened / when:** [description, dates and times]
> - **People affected (categories, approx. number):** [e.g. Vantaro business customers, ~N]
> - **Records affected (categories, approx. number):** [e.g. names, e-mails, masked card data]
> - **Likely consequences:** [assessment]
> - **Measures taken or proposed:** [containment, customer notification]
> - **Reason for any delay beyond 72 hours:** [if applicable]

> **To customers (German)** – Betreff: Wichtige Sicherheitsinformation zu Ihren Zahlungsdaten
>
> Guten Tag [Name],
>
> am [Datum] haben wir einen Sicherheitsvorfall bei VANTARO festgestellt. [Kurze Beschreibung.]
>
> **Betroffene Daten:** [z. B. Name, E-Mail, Rechnungsdaten, letzte vier Ziffern der Karte]. Ihre vollständige Kartennummer und Prüfnummer haben wir nie gespeichert.
>
> **Was wir getan haben:** [z. B. Systeme gesichert, ProCredit Bank und Aufsichtsbehörde informiert]
>
> **Was Sie tun sollten:** [z. B. Kartenabrechnungen prüfen und bei unbekannten Buchungen Ihre Bank kontaktieren]
>
> Fragen: [E-Mail / Telefon]
>
> [Name], VANTARO

### Step 5 – Fix and recover

- Fix the root cause; verify it (`npm test` in `server/`, log review).
- Re-enable payments step by step: restore `PROCREDIT_API_BASE_URL` → one internal test payment → normal traffic with daily log review for [7] days.
- Confirm with ProCredit that a new certificate is active and the old one revoked.

### Step 6 – Review within 2 weeks

A short written report ([location]): timeline, root cause, what worked and what didn't, and actions
with **owner and deadline**, tracked until done. Shared with Management and, on request, with ProCredit.

## 5. Yearly exercise

A **tabletop exercise once a year** with all roles (e.g. "the merchant certificate was pushed to GitHub").

| Date | Scenario | Participants | Findings | Actions |
|---|---|---|---|---|
| [date] | | | | |

---

## One-page checklist

**Detected (UTC): ________  Incident Lead: ________**

1. ☐ Tell the Incident Lead. Open the incident log, note the detection time.
2. ☐ Set severity. When unsure, go higher.
3. ☐ Preserve evidence: export `payment_audit_log`, Render and Supabase logs. **Delete nothing.**
4. ☐ Contain:
   - ☐ Stop payments (remove `PROCREDIT_API_BASE_URL` in Render; Management OK)
   - ☐ Certificate leaked → bank revokes, new certificate
   - ☐ Keys leaked → rotate `PAYMENT_ENCRYPTION_KEY`, Supabase and Resend keys
   - ☐ Lock compromised accounts and sessions
5. ☐ **Within 24 h: notify ProCredit Bank** – [bank contact]
6. ☐ Personal data involved? → **within 72 h: authority**; customers if high risk
7. ☐ Fix root cause, verify, re-enable payments step by step
8. ☐ Review within 2 weeks; actions with owners and deadlines

Contacts: Incident Lead [phone] · Technical Lead [phone] · ProCredit [phone] · Management [phone]

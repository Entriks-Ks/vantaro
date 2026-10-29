# Security Testing Plan – Vantaro

| | |
|---|---|
| **Title** | Security Testing Plan – Vantaro |
| **Company** | Entriks LLC |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-10-29 |
| **Owner** | [Name, role] |
| **Next review date** | 2027-10-29 |
| **Covers** | ProCredit requirement 6 |

Vantaro processes one-time payments only and stores no cards or tokens, so the testing focuses on the
payment flow, access to payment data and protection of the merchant certificate and keys.

## 1. Automated tests (every change)

`npm test` in `server/` runs the payment security tests with a mock gateway (never the real bank):
audit logging, rate limits, the failed-payment lockout, access control on payment routes, and
encryption of stored order passwords. They are run before every deployment that touches payments.

## 2. Dependency scanning (monthly)

- `npm audit` for `server/` and `client/`, plus GitHub Dependabot alerts on `Entriks-Ks/vantaro`, checked **monthly**.
- **Fix deadlines** from the date a finding is known:

| Severity | Fix deadline |
|---|---|
| Critical | 7 days |
| High | 30 days |
| Medium | 90 days |
| Low | Next planned update |

- If no fix exists, the Technical Lead records a workaround or accepted risk, approved by [approver role].

## 3. Log review (monthly)

Review of `payment_audit_log` and the Render logs for: `suspicious_activity` entries, clusters of
`payment_failed`, `return_invalid_token` from the same IP, and unusual admin activity.
Reviewer: [role]. Anything that may be an incident follows the [Incident Response Plan](incident-response-plan.md).

## 4. Penetration test

- An **external penetration test** by an independent company ([penetration testing company]) **[before go-live / within X months of go-live – to decide]**, then **[every year / every 2 years – to decide]**, and again after major changes to the payment flow.
- **Scope:** checkout and the ProCredit return URL (tampered or replayed tokens), status checks, authentication and sessions, admin areas and role separation, access to other customers' payments and invoices, exposure of secrets and configuration.

## 5. Reports and findings

- Reports and scan summaries are stored in [secure location – not in the code repository].
- Reviewed by the Technical Lead and [management role] within 2 weeks.
- Each finding becomes a ticket in [tracker] with severity, owner and deadline (section 2 deadlines apply), closed only after the fix is verified.
- Results can be shared with ProCredit Bank on request.

## 6. Planned assessments

| Type | Planned date | Done | Report link |
|---|---|---|---|
| External penetration test | [date] | ☐ | [link] |
| Dependency scan | Monthly, from [first date] | ☐ | [link] |
| Payment and audit log review | Monthly, from [first date] | ☐ | [link] |
| Incident response tabletop exercise | [date] | ☐ | [link] |

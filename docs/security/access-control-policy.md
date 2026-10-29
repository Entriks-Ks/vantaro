# Access Control Policy – Vantaro Payment Data

| | |
|---|---|
| **Title** | Access Control Policy – Vantaro Payment Data |
| **Company** | Entriks LLC |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-10-29 |
| **Owner** | [Name, role] |
| **Next review date** | 2027-10-29 (access itself is reviewed quarterly, section 5) |
| **Covers** | ProCredit requirement 3 |

## 1. Principles

- **Least privilege and need-to-know:** people get only the access their work requires.
- **Production and development are separate:** separate Supabase projects, the ProCredit test merchant and test certificate for development, and separate keys. Production data is not copied to development.
- **Personal accounts only**, no shared logins.

## 2. Who can access what

| Role | In the Vantaro app | Production database (Supabase) | Production secrets (Render) |
|---|---|---|---|
| **Admin** (listed in `ADMIN_EMAILS`) | All payments and invoices, audit alerts | [Yes / only named people] | [Yes / only named people] |
| **Customer (Berater)** | Only their own payments and invoices | No | No |
| **Developer** | Development environment only | **No by default** | No |

Temporary production access for a developer needs approval from [approver role], has a reason and an
end date (max [24 hours]), and is recorded in [access log location].

## 3. Application controls (in place)

- The list of all payments is admin-only. Customers see only their own payments; another customer's invoice returns "not found". Only the owner can re-check a payment's status. Covered by automated tests (`server/test/payments.test.js`).
- No API returns card numbers, ProCredit order passwords or certificate material. Customers see only the card brand and last four digits.
- The payment tables can be read only by the API's service key; database row-level security blocks all other access.

## 4. Infrastructure

- **MFA required** on Render, Supabase, GitHub, Resend, the company e-mail accounts and the ProCredit merchant portal (where available).
- **Secrets** (ProCredit certificate and key, `PAYMENT_ENCRYPTION_KEY`, Supabase service-role key, Resend API key) are kept only in the Render environment of `vantaro-api`, **never in Git**, chat or e-mail. A recovery copy is kept in [password manager / vault].
- Secrets are **rotated at least once a year**, and **immediately** when someone with access leaves or after a suspected leak. The ProCredit certificate is renewed before it expires.
- **Joining:** access is granted on request with approval from [approver role] and recorded in [access register].
- **Leaving or changing role:** all access removed **within 24 hours**, and secrets they could see are rotated.

## 5. Quarterly access review

Every quarter, [reviewer role] checks:

- ☐ **Render** – team members; MFA on for all
- ☐ **Supabase** – project members and API keys; no developer with standing production access
- ☐ **GitHub** (`Entriks-Ks/vantaro`) – members, outside collaborators, deploy keys; no secrets committed
- ☐ **Resend and company e-mail** – accounts and API keys
- ☐ **`ADMIN_EMAILS`** in Render – only current admins
- ☐ **ProCredit merchant portal** – users for the Vantaro Merchant ID
- ☐ **Secrets** – rotated within the last 12 months; certificate expiry date noted
- ☐ **Temporary access log** – all approved and ended

| Date | Reviewer | Findings | Actions |
|---|---|---|---|
| [date] | [name] | | |
| | | | |
| | | | |
| | | | |

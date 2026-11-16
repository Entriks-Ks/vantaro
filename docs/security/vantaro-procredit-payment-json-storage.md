# Vantaro - ProCredit Payment Integration: JSON and Data Storage Reference

**Platform:** Vantaro  
**Gateway:** Quipu E-Commerce Payment Gateway - ProCredit Bank  
**Flow:** ProCredit Hosted Payment Page (HPP), one-time Purchase  
**Database:** Supabase PostgreSQL  
**Prepared:** 2 November 2026

**Purpose:** Describe the ProCredit request fields, response fields and payment
data stored by Vantaro. This document describes the current repository
implementation; it is not a statement of bank certification or production
approval.

All JSON below is illustrative and sanitized. IDs, passwords, tokens, IP
addresses and transaction values are examples only. No certificate, private
key, encryption key, PAN or CVV is included.

## 1. Scope and payment flow

Vantaro supports one-time lead-package payments:

1. An authenticated Berater selects a package and lead count.
2. Vantaro creates a pending local payment.
3. Vantaro sends a `Purchase` order to ProCredit over mutual TLS.
4. The customer is redirected to the ProCredit HPP.
5. ProCredit redirects to Vantaro with an unguessable return token.
6. Vantaro retrieves the order from ProCredit and independently verifies the
   final status before creating the lead request.

Recurring payments, Card-on-File agreements, saved cards and merchant-managed
renewals are not implemented in this flow. Consequently, fields such as
`hppCofCapturePurposes` and recurring `aut` data must not be added to these
requests.

## 2. Client request to Vantaro

### 2.1 Endpoint

`POST /api/payments/checkout`

Authentication is required. The user must have the `Berater` role.

```json
{
  "packageId": "pkv-regional",
  "requestedCount": 10,
  "browser": {
    "javaEnabled": false,
    "jsEnabled": true,
    "acceptHeader": "application/json",
    "colorDepth": "24",
    "screenW": "1920",
    "screenH": "1080",
    "tzOffset": "-60",
    "language": "en",
    "userAgent": "Example browser user agent"
  }
}
```

Energy packages additionally require `territory` and `desiredTimeframe`:

```json
{
  "packageId": "PV_LEAD",
  "requestedCount": 10,
  "territory": "10115 Berlin",
  "desiredTimeframe": "Within 30 days",
  "browser": {
    "javaEnabled": false,
    "jsEnabled": true,
    "language": "en"
  }
}
```

Supported package IDs are:

| Package ID | Description |
|---|---|
| `pkv-deutschlandweit` | PKV leads, Germany-wide |
| `pkv-regional` | PKV leads, regional |
| `PV_LEAD` | Photovoltaik leads |
| `PV_APPOINTMENT` | Photovoltaik appointments |
| `HP_LEAD` | Heat-pump leads |
| `HP_APPOINTMENT` | Heat-pump appointments |

`requestedCount` must be at least 10 and must use increments of 5. The server
calculates the amount, currency, invoice number and return token; the client
cannot choose those gateway values.

The browser object is optional. Missing values are derived from the request
headers or safe defaults. The server determines the client IP and user agent
used for the gateway browser data.

### 2.2 Vantaro response

On successful order creation, Vantaro returns HTTP `201`:

```json
{
  "paymentId": "7d7e3b8c-5f4c-4c87-9d4c-123456789abc",
  "redirectUrl": "https://3dss2test.quipu.de/flex?id=1027&password=<bank-order-password>",
  "payment": {
    "id": "7d7e3b8c-5f4c-4c87-9d4c-123456789abc",
    "status": "pending",
    "packageId": "pkv-regional",
    "grossCents": 149000,
    "currency": "EUR"
  }
}
```

The public payment serializer does not expose the ProCredit order password,
encrypted password, return token or certificate data.

## 3. Request sent to ProCredit

### 3.1 Create Order

`POST /order`

The request is sent using the configured ProCredit client certificate and
private key. The merchant is identified by the certificate CN.

```json
{
  "order": {
    "typeRid": "1",
    "amount": "1490.00",
    "currency": "EUR",
    "description": "Lead package regional x10",
    "language": "en",
    "hppRedirectUrl": "https://api.example.com/api/payments/return?token=<48-character-return-token>",
    "initiationEnvKind": "Browser",
    "consumerDevice": {
      "browser": {
        "javaEnabled": false,
        "jsEnabled": true,
        "acceptHeader": "application/json",
        "ip": "192.0.2.10",
        "colorDepth": "24",
        "screenW": "1920",
        "screenH": "1080",
        "tzOffset": "-60",
        "language": "en",
        "userAgent": "Example browser user agent"
      }
    }
  }
}
```

Implementation notes:

- `typeRid` defaults to `"1"` through `PROCREDIT_ORDER_TYPE_RID`.
- `amount` is calculated from integer cents and formatted with two decimals.
- `currency` defaults to `EUR`.
- The description is converted to Latin characters and limited to 120
  characters.
- `hppCofCapturePurposes` is intentionally absent because this is not a
  Card-on-File enrollment.
- `consumer` is intentionally absent. Vantaro correlates the payment through
  its local return token and payment record.
- `hppRedirectUrl` contains only the Vantaro return token, not a local payment
  ID or session credential.

### 3.2 Create Order response

The gateway response is expected to contain:

```json
{
  "order": {
    "id": 1027,
    "hppUrl": "https://3dss2test.quipu.de/flex",
    "password": "<bank-order-password>",
    "status": "Preparing"
  }
}
```

Vantaro requires `id`, `password` and `hppUrl`. If any is missing, the order
creation is treated as an error and the local pending payment is marked as
failed.

The customer redirect URL is built as:

```text
https://3dss2test.quipu.de/flex?id=1027&password=<bank-order-password>
```

### 3.3 Get Order Details

After the HPP return, Vantaro retrieves the order from ProCredit:

`GET /order/{orderId}?password=<bank-order-password>&tokenDetailLevel=2&tranDetailLevel=1`

The order password is decrypted only for this server-to-server request. The
returned status, amount and transaction details are used to classify the
payment. A successful result is normally reported as `FullyPaid`.

## 4. Payment data stored in Supabase

The primary table is `public.lead_payments`. The base table is created by
[`server/supabase/lead_payments.sql`](../../server/supabase/lead_payments.sql);
ProCredit fields are added by
[`server/supabase/lead_payments_procredit.sql`](../../server/supabase/lead_payments_procredit.sql).

### 4.1 Pending payment before gateway creation

```json
{
  "id": "7d7e3b8c-5f4c-4c87-9d4c-123456789abc",
  "berater_id": "11111111-2222-3333-4444-555555555555",
  "request_id": null,
  "package_id": "pkv-regional",
  "package_label": "PKV / regional",
  "scope": "regional",
  "lead_type": "PKV",
  "lead_count": 10,
  "net_cents": 149000,
  "tax_cents": 0,
  "gross_cents": 149000,
  "invoice_number": "VAN-20261102-EXAMPLE",
  "status": "pending",
  "method": "card",
  "billing_name": "Example Berater",
  "billing_email": "berater@example.com",
  "billing_company": "Example GmbH",
  "test_mode": true,
  "return_token": "<48-character-random-token>",
  "created_at": "2026-11-02T15:20:00.000Z"
}
```

The return token is stored for internal correlation and is never returned as a
general payment field.

### 4.2 Payment after Create Order

After the gateway order is created, Vantaro adds:

```json
{
  "pg_order_id": "1027",
  "pg_order_password": "<AES-256-GCM ciphertext>",
  "pg_status": "Preparing",
  "hpp_url": "https://3dss2test.quipu.de/flex"
}
```

The ProCredit order password is encrypted at rest. The encryption key is
provided through `PAYMENT_ENCRYPTION_KEY`; production startup rejects a missing
key.

### 4.3 Paid payment

After independent Get Order verification:

```json
{
  "status": "paid",
  "pg_status": "FullyPaid",
  "card_brand": "VISA",
  "card_last4": "4242",
  "card_holder": "EXAMPLE CARDHOLDER",
  "card_exp_month": 9,
  "card_exp_year": 2028,
  "pg_approval_code": "EXAMPLE-APPROVAL",
  "pg_tran_time": "2026-11-02 15:23:45",
  "paid_at": "2026-11-02T15:23:46.000Z",
  "request_id": "66666666-7777-8888-9999-000000000000"
}
```

Card fields are optional masked hints extracted from the gateway response.
Vantaro does not store the full card number or CVV.

### 4.4 Failed payment

```json
{
  "status": "failed",
  "pg_status": "Declined",
  "paid_at": null
}
```

An uncertain or intermediate gateway status remains pending and is reconciled
using the same ProCredit order. It is not automatically converted to failed
and is not replaced with a second order.

## 5. Field mapping

| Meaning | ProCredit field | Supabase field |
|---|---|---|
| Gateway order ID | `order.id` | `pg_order_id` |
| Gateway order password | `order.password` | Encrypted `pg_order_password` |
| Hosted payment URL | `order.hppUrl` | `hpp_url` |
| Gateway order status | `order.status` | `pg_status` |
| Amount | `order.amount` | `gross_cents`, `net_cents`, `tax_cents` |
| Currency | `order.currency` | Configuration; payment amounts are stored as cents |
| Approval code | Transaction `approvalCode` | `pg_approval_code` |
| Transaction time | Transaction time | `pg_tran_time` |
| Card brand | `srcToken.card.brand` or equivalent | `card_brand` |
| Masked card number | `srcToken.displayName` or equivalent | `card_last4` |
| Cardholder | `srcToken.owner.name` or equivalent | `card_holder` |
| Return correlation | Vantaro-generated token | `return_token` |

## 6. Return and verification endpoints

### 6.1 Bank return

`GET /api/payments/return?token=<return-token>`

This route does not require a user session. It looks up the payment using the
unguessable return token, retrieves the order from ProCredit, and redirects
the customer to the frontend result page.

The token must be exactly 48 hexadecimal characters. Invalid or missing tokens
are rejected and recorded in the payment audit log.

### 6.2 Manual synchronization

`POST /api/payments/{paymentId}/sync`

This authenticated route retrieves the current ProCredit order status and
updates the local payment. A lead request is created only after a paid status
has been verified.

## 7. Audit and access controls

The audit table is `public.payment_audit_log`, created by
[`server/supabase/payment_audit_log.sql`](../../server/supabase/payment_audit_log.sql).
It records events such as:

- `checkout_created`
- `payment_paid`
- `payment_failed`
- `payment_synced`
- `return_invalid_token`
- `suspicious_activity`

Audit metadata is sanitized by the server and must not contain card data,
order passwords, certificate material or encryption keys. Supabase Row Level
Security denies access to `anon` and `authenticated`; the server uses the
service role.

## 8. Configuration reference

```env
PROCREDIT_API_BASE_URL=https://3dss2test.quipu.de:8000
PROCREDIT_MERCHANT_ID=ECOM_TEST398
PROCREDIT_ORDER_TYPE_RID=1
PROCREDIT_CERT_PATH=./certs/cert.pem
PROCREDIT_KEY_PATH=./certs/key.pem
PROCREDIT_CA_PATH=./certs/ca.pem
PROCREDIT_CURRENCY=EUR
PROCREDIT_LANGUAGE=en
PROCREDIT_TEST_MODE=1
PAYMENT_ENCRYPTION_KEY=<32-byte encryption key>
API_PUBLIC_URL=https://api.example.com
```

Private keys, certificates, encryption keys and gateway order passwords must
not be committed to Git, returned to the frontend, or written to audit logs.

## 9. Explicitly not implemented

The following fields and operations are not part of the current Vantaro
integration:

- `hppCofCapturePurposes`
- recurring `aut` orders
- `consumer` Card-on-File identifiers
- saved-card tokens or token vaults
- merchant-initiated transactions
- gateway subscriptions
- automatic renewals
- partial refunds and recurring cancellation workflows

Any future recurring-payment implementation must be documented separately and
must not be inferred from this one-time Purchase flow.

# Vantaro - ProCredit Payment JSON Reference

**Flow:** ProCredit Hosted Payment Page (HPP), one-time Purchase  
**Database:** Supabase PostgreSQL  
**Currency:** EUR

## 1. Checkout request

`POST /api/payments/checkout`

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

Energy packages additionally use:

```json
{
  "packageId": "PV_LEAD",
  "requestedCount": 10,
  "territory": "10115 Berlin",
  "desiredTimeframe": "Within 30 days"
}
```

Supported `packageId` values:

```text
pkv-deutschlandweit
pkv-regional
PV_LEAD
PV_APPOINTMENT
HP_LEAD
HP_APPOINTMENT
```

The server calculates the amount, invoice number and return token.

## 2. ProCredit Create Order request

`POST /order`

```json
{
  "order": {
    "typeRid": "1",
    "amount": "1490.00",
    "currency": "EUR",
    "description": "Lead package regional x10",
    "language": "en",
    "hppRedirectUrl": "https://api.example.com/api/payments/return?token=<return-token>",
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

Not used for this one-time flow:

```json
{
  "hppCofCapturePurposes": ["Cit", "Recurring"],
  "consumer": {},
  "aut": {}
}
```

## 3. ProCredit Create Order response

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

Customer redirect:

```text
https://3dss2test.quipu.de/flex?id=1027&password=<bank-order-password>
```

## 4. Vantaro checkout response

```json
{
  "paymentId": "7d7e3b8c-5f4c-4c87-9d4c-123456789abc",
  "redirectUrl": "https://3dss2test.quipu.de/flex?id=1027&password=<bank-order-password>",
  "payment": {
    "status": "pending",
    "packageId": "pkv-regional",
    "grossCents": 149000
  }
}
```

## 5. Stored payment record

Table: `public.lead_payments`

```json
{
  "id": "7d7e3b8c-5f4c-4c87-9d4c-123456789abc",
  "berater_id": "11111111-2222-3333-4444-555555555555",
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
  "test_mode": true,
  "return_token": "<48-character-random-token>",
  "pg_order_id": "1027",
  "pg_order_password": "<AES-256-GCM ciphertext>",
  "pg_status": "Preparing",
  "hpp_url": "https://3dss2test.quipu.de/flex"
}
```

The order password is encrypted at rest. PAN and CVV are never stored.

## 6. Paid payment fields

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

## 7. Failed payment fields

```json
{
  "status": "failed",
  "pg_status": "Declined",
  "paid_at": null
}
```

## 8. Field mapping

| ProCredit field | Stored field |
|---|---|
| `order.id` | `pg_order_id` |
| `order.password` | Encrypted `pg_order_password` |
| `order.hppUrl` | `hpp_url` |
| `order.status` | `pg_status` |
| `order.amount` | `gross_cents` |
| Transaction `approvalCode` | `pg_approval_code` |
| Transaction time | `pg_tran_time` |
| Card brand | `card_brand` |
| Masked card number | `card_last4` |
| Cardholder name | `card_holder` |
| Return correlation | `return_token` |

## 9. Return and synchronization

```text
GET  /api/payments/return?token=<return-token>
POST /api/payments/{paymentId}/sync
```

Vantaro confirms the final status through ProCredit Get Order Details before
creating the lead request.

## 10. Configuration

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
PAYMENT_ENCRYPTION_KEY=<32-byte-encryption-key>
API_PUBLIC_URL=https://api.example.com
```

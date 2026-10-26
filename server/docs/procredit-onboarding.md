# ProCredit e-Commerce onboarding (VANTARO)

Manual one-time lead package payments use the **Purchase + Hosted Payment Page (HPP)** flow only. Recurring / Card-on-File is not used.

## 1. Provide to ProCredit Bank

- Shop logo as **GIF**: `140×80` (desktop) and `70×40` (mobile)
- Shop title on the card entry page (e.g. `Vantaro`)
- Default language (`en` or `de` — confirm with your advisor; API description must be Latin letters only)

## 2. Generate TLS CSR (OpenSSL)

```bash
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out request.csr
```

- **Common Name** = merchant name from the bank (max 20 characters; must match MerchantID / CN rules)
- Send `request.csr` to Quipu / ProCredit for signing
- Keep `key.pem` private on the API server only (never commit, never ship to the client)

## 3. Receive from the bank

- **MerchantID** (terminal id)
- **API base URL** (test and production)
- Signed files: `cert.pem`, `ca.pem` (plus your `key.pem`)
- Test cards / merchant portal access after go-live

## 4. Configure the API (`server/.env`)

```env
# Test environment (Quipu) — already known for this project:
PROCREDIT_API_BASE_URL=https://3dss2test.quipu.de:8000
# Test merchant from the bank:
PROCREDIT_MERCHANT_ID=ECOM_TEST398   # informational; bank identifies us by cert CN
PROCREDIT_ORDER_TYPE_RID=1           # "ORD1" from the PDF is rejected (OrderTypeNotFound)
PROCREDIT_CERT_PATH=./certs/cert.pem
PROCREDIT_KEY_PATH=./certs/key.pem
PROCREDIT_CA_PATH=./certs/ca.pem
PROCREDIT_CURRENCY=EUR
PROCREDIT_LANGUAGE=en
PROCREDIT_TEST_MODE=1
API_PUBLIC_URL=http://localhost:3001
# Production: API_PUBLIC_URL=https://vantaro.onrender.com
```

Live checkout needs the signed `cert.pem` / `key.pem` (+ `ca.pem`). The merchant is identified by the certificate CN, not a request field.

Notes from testing against the test env (2026-10-26):

- `ca.pem` is the ProCredit root that signed **our client cert**; the API host itself uses a public DigiCert cert. The client trusts both, so TLS verification stays on (the bank samples disable it — do not copy that).
- A paid order returns `status: "FullyPaid"`; the bank appends `&ID=<orderId>&STATUS=<status>` to `hppRedirectUrl`, but we always confirm via Get Order.
- Card info: `srcToken.displayName` (masked PAN), `srcToken.card.brand`, `srcToken.owner.name`.
- Test card: see `KS TEST CARD NEW.txt` from the bank (not committed).

Alternatively set PEM contents via `PROCREDIT_CERT_PEM`, `PROCREDIT_KEY_PEM`, `PROCREDIT_CA_PEM`.

Certificates are typically valid ~3 years; renew with the same CN before expiry.

## 5. Database

Run [`server/supabase/lead_payments_procredit.sql`](../supabase/lead_payments_procredit.sql) in the Supabase SQL Editor after `lead_payments.sql`, then [`lead_payments_receipt.sql`](../supabase/lead_payments_receipt.sql) (approval code + transaction time for the customer confirmation email the bank requires).

## 6. Go-live checklist

1. Test Create Order + HPP redirect + return confirmation in the bank test environment
2. Switch to production API URL and production certificates
3. Set `PROCREDIT_TEST_MODE=0`
4. Confirm `PUBLIC_API_URL` / `API_PUBLIC_URL` points at the live API (for `/api/payments/return`)

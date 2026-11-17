import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentConfirmationEmail } from '../src/lib/mailer.js';

// Values from the bank's sample paid order (ProCredit receipt requirements).
const payment = {
  id: 'pay-1',
  status: 'paid',
  invoiceNumber: 'RE-20260427-0001',
  packageLabel: 'PKV / deutschlandweit',
  leadCount: 10,
  netCents: 119000,
  grossCents: 119000,
  listCents: 119000,
  discountCents: 0,
  testMode: false,
  pgOrderId: '24390',
  approvalCode: '014513',
  cardBrand: 'Visa',
  cardLast4: '3572',
  cardHolder: 'B H',
  transactionAt: '2026-04-27 13:13:06',
  paidAt: '2026-04-27T11:13:10.000Z',
  createdAt: '2026-04-27T11:11:32.000Z',
  billingName: 'B H',
  billingEmail: 'kunde@example.test',
};

test('payment confirmation email lists every receipt field the bank requires', () => {
  const { text, html } = paymentConfirmationEmail({ payment, dashboardUrl: 'https://app.test/dashboard/paket' });
  for (const body of [text, html]) {
    assert.match(body, /Bestell-ID \(Bank\)/);
    assert.match(body, /24390/);
    assert.match(body, /Genehmigungscode/);
    assert.match(body, /014513/);
    assert.match(body, /Visa/);
    assert.match(body, /XXXX XXXX XXXX 3572/);
    // Exact bank transaction time (regTime), to the second.
    assert.match(body, /Transaktionsdatum/);
    assert.match(body, /27\.04\.2026 13:13:06/);
  }
});

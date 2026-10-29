import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENERGY_UNIT_CENTS,
  PACKAGES,
  leadPurchaseCents,
  packageById,
  packTotalCents,
} from '../src/lib/packages.js';

describe('package pricing', () => {
  test('net price per lead', () => {
    assert.equal(packageById('pkv-deutschlandweit').packCents, 11900);
    assert.equal(packageById('pkv-regional').packCents, 14900);
    for (const id of ['PV_LEAD', 'PV_APPOINTMENT', 'HP_LEAD', 'HP_APPOINTMENT']) {
      assert.equal(packageById(id).packCents, ENERGY_UNIT_CENTS);
    }
    assert.equal(ENERGY_UNIT_CENTS, 11900);
  });

  test('total is price per lead × number of leads', () => {
    assert.equal(packTotalCents(packageById('pkv-deutschlandweit'), 10), 119000);
    assert.equal(packTotalCents(packageById('pkv-regional'), 15), 223500);
    assert.equal(packTotalCents(packageById('HP_APPOINTMENT'), 20), 238000);
    assert.equal(packTotalCents(null, 10), 0);
  });

  test('no package is priced below 100 € per lead (guards against a leftover test price)', () => {
    for (const pkg of PACKAGES) assert.ok(pkg.packCents >= 10000, `${pkg.id}: ${pkg.packCents}`);
  });

  test('single-lead value for complaints and credits', () => {
    assert.equal(leadPurchaseCents({ scope: 'deutschlandweit' }), 11900);
    assert.equal(leadPurchaseCents({ scope: 'regional' }), 14900);
    assert.equal(leadPurchaseCents({ vertical: 'energy', leadType: 'PV_LEAD' }), 11900);
    assert.equal(leadPurchaseCents({ priceCents: 9900 }), 9900);
  });
});

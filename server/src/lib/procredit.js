import fs from 'node:fs';
import https from 'node:https';
import { URL } from 'node:url';

function trim(value) {
  return String(value || '').trim();
}

function fail(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readPem(pathEnv, contentEnv) {
  const inline = trim(process.env[contentEnv]);
  if (inline) return inline.replace(/\\n/g, '\n');
  const filePath = trim(process.env[pathEnv]);
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw fail(`ProCredit Zertifikat konnte nicht gelesen werden (${pathEnv}): ${error.message}`, 503);
  }
}

export function getProcreditConfig() {
  const apiBaseUrl = trim(process.env.PROCREDIT_API_BASE_URL).replace(/\/+$/, '');
  const merchantId = trim(process.env.PROCREDIT_MERCHANT_ID);
  const currency = trim(process.env.PROCREDIT_CURRENCY) || 'EUR';
  const language = trim(process.env.PROCREDIT_LANGUAGE) || 'en';
  const testModeEnv = trim(process.env.PROCREDIT_TEST_MODE).toLowerCase();
  const testMode = testModeEnv
    ? !['0', 'false', 'no', 'off'].includes(testModeEnv)
    : /test|sandbox|3dss|quipu/i.test(apiBaseUrl) || process.env.NODE_ENV !== 'production';

  const hasCerts = Boolean(
    trim(process.env.PROCREDIT_CERT_PEM)
    || trim(process.env.PROCREDIT_CERT_PATH),
  ) && Boolean(
    trim(process.env.PROCREDIT_KEY_PEM)
    || trim(process.env.PROCREDIT_KEY_PATH),
  );

  return {
    apiBaseUrl,
    merchantId,
    currency,
    language,
    testMode,
    hasCerts,
    /** Ready for live Create Order / Get Order calls */
    configured: Boolean(apiBaseUrl && merchantId && hasCerts),
    missing: [
      !apiBaseUrl && 'PROCREDIT_API_BASE_URL',
      !merchantId && 'PROCREDIT_MERCHANT_ID',
      !hasCerts && 'PROCREDIT_CERT/KEY (PATH oder PEM)',
    ].filter(Boolean),
  };
}

function buildAgent() {
  const cert = readPem('PROCREDIT_CERT_PATH', 'PROCREDIT_CERT_PEM');
  const key = readPem('PROCREDIT_KEY_PATH', 'PROCREDIT_KEY_PEM');
  const ca = readPem('PROCREDIT_CA_PATH', 'PROCREDIT_CA_PEM');
  if (!cert || !key) {
    throw fail(
      'ProCredit TLS-Zertifikate fehlen. PROCREDIT_CERT_PATH/KEY_PATH (oder *_PEM) setzen.',
      503,
    );
  }
  return new https.Agent({
    cert,
    key,
    ca: ca || undefined,
    rejectUnauthorized: true,
  });
}

function requestJson(method, pathWithQuery, body) {
  const config = getProcreditConfig();
  if (!config.configured) {
    const missing = config.missing.length
      ? ` Fehlt noch: ${config.missing.join(', ')}.`
      : '';
    throw fail(
      `ProCredit ist noch nicht vollständig konfiguriert.${missing}`,
      503,
    );
  }

  const url = new URL(pathWithQuery.replace(/^\//, ''), `${config.apiBaseUrl}/`);
  const payload = body == null ? null : JSON.stringify(body);
  const agent = buildAgent();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        agent,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = null;
          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch {
              data = { raw };
            }
          }
          if (res.statusCode >= 400) {
            const message = data?.error
              || data?.message
              || data?.order?.status
              || `ProCredit-Anfrage fehlgeschlagen (${res.statusCode}).`;
            reject(fail(String(message), res.statusCode >= 500 ? 502 : 400));
            return;
          }
          resolve(data);
        });
      },
    );
    req.on('error', (error) => {
      reject(fail(`ProCredit-Verbindung fehlgeschlagen: ${error.message}`, 502));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/** Amount in cents → "1190.00" */
export function formatProcreditAmount(cents) {
  const value = Number(cents) || 0;
  return (value / 100).toFixed(2);
}

/** Bank requires Latin letters in description. */
export function toLatinDescription(text, fallback = 'Lead package') {
  const cleaned = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,_+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function buildHppRedirectUrl(hppUrl, orderId, password) {
  const base = trim(hppUrl);
  if (!base) throw fail('ProCredit hat keine HPP-URL geliefert.', 502);
  const url = new URL(base);
  url.searchParams.set('id', String(orderId));
  url.searchParams.set('password', String(password));
  return url.toString();
}

/**
 * Create a Purchase order, then build the customer HPP URL.
 * @param {object} input
 */
export async function createPurchaseOrder({
  amountCents,
  description,
  language,
  hppRedirectUrl,
  browser = {},
}) {
  const config = getProcreditConfig();
  const amount = formatProcreditAmount(amountCents);
  const body = {
    order: {
      typeRid: 'ORD1',
      amount,
      currency: config.currency,
      description: toLatinDescription(description),
      language: language || config.language,
      hppRedirectUrl,
      initiationEnvKind: 'Browser',
      consumerDevice: {
        browser: {
          javaEnabled: Boolean(browser.javaEnabled),
          jsEnabled: browser.jsEnabled !== false,
          acceptHeader: trim(browser.acceptHeader) || 'application/json,text/html;q=0.9,*/*;q=0.8',
          ip: trim(browser.ip) || '127.0.0.1',
          colorDepth: String(browser.colorDepth || '24'),
          screenW: String(browser.screenW || '1920'),
          screenH: String(browser.screenH || '1080'),
          tzOffset: String(browser.tzOffset ?? '0'),
          language: trim(browser.language) || 'de-DE',
          userAgent: trim(browser.userAgent) || 'Mozilla/5.0',
        },
      },
    },
  };

  const response = await requestJson('POST', '/order', body);
  const order = response?.order || response;
  const id = order?.id;
  const password = order?.password;
  const hppUrl = order?.hppUrl || order?.hpp_url;
  if (id == null || !password || !hppUrl) {
    throw fail('ProCredit Create Order Antwort ist unvollständig.', 502);
  }

  return {
    orderId: String(id),
    password: String(password),
    hppUrl: String(hppUrl),
    status: order?.status ? String(order.status) : 'Preparing',
    redirectUrl: buildHppRedirectUrl(hppUrl, id, password),
    raw: response,
  };
}

export async function getOrderDetails(orderId, password) {
  const id = encodeURIComponent(String(orderId));
  const query = new URLSearchParams({
    password: String(password),
    tokenDetailLevel: '2',
    tranDetailLevel: '1',
  });
  const response = await requestJson('GET', `/order/${id}?${query.toString()}`);
  return response?.order || response;
}

const PAID_STATUSES = new Set([
  'paid',
  'authorized',
  'captured',
  'completed',
  'finished',
  'approved',
  'success',
  'successful',
]);

const FAILED_STATUSES = new Set([
  'declined',
  'failed',
  'rejected',
  'cancelled',
  'canceled',
  'voided',
  'reversed',
  'expired',
  'refused',
]);

export function classifyOrderStatus(order) {
  const status = String(order?.status || order?.pg_status || '').trim().toLowerCase();
  if (PAID_STATUSES.has(status)) return 'paid';
  if (FAILED_STATUSES.has(status)) return 'failed';

  const approval = order?.tran?.approvalCode
    || order?.approvalCode
    || order?.lastTran?.approvalCode;
  if (approval) return 'paid';

  const amountPaid = order?.amountPaid ?? order?.paidAmount;
  if (amountPaid != null && Number(amountPaid) > 0 && status && !FAILED_STATUSES.has(status)) {
    return 'paid';
  }

  return 'pending';
}

export async function refundOrder(orderId, amountCents) {
  const id = encodeURIComponent(String(orderId));
  const body = {
    tran: {
      phase: 'Single',
      amount: formatProcreditAmount(amountCents),
      type: 'Refund',
    },
  };
  return requestJson('POST', `/order/${id}/exec-tran`, body);
}

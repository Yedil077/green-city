// google-auth.js — сервис-аккаунтная авторизация к Google Sheets API
// БЕЗ Node.js (Cloudflare Workers это не поддерживают) — всё через Web
// Crypto API (globalThis.crypto.subtle), который есть и в Workers, и в
// современном Node (для локальной проверки).
// Формат модуля — ES modules (import/export), как ожидает Cloudflare Workers.

function base64url(bytes) {
  // bytes: Uint8Array | string
  let bin;
  if (typeof bytes === 'string') {
    bin = btoa(unescape(encodeURIComponent(bytes)));
  } else {
    bin = btoa(String.fromCharCode(...bytes));
  }
  return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem) {
  const der = pemToDer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// Строит и подписывает JWT для service-account (RFC 7523, JWT bearer flow),
// обменивает его на access_token у Google. scope по умолчанию — только
// ЧТЕНИЕ ("spreadsheets.readonly"); для записи понадобится
// "https://www.googleapis.com/auth/spreadsheets" (полный доступ) — передай
// явно вторым аргументом, когда дойдёт до записи в таблицу.
export async function getGoogleAccessToken(serviceAccountJson, scope) {
  scope = scope || 'https://www.googleapis.com/auth/spreadsheets.readonly';
  const sa = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claims));
  const key = await importPrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = signingInput + '.' + base64url(new Uint8Array(sigBuf));

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error('Google OAuth2 token exchange failed: ' + resp.status + ' ' + JSON.stringify(data));
  }
  return data.access_token; // живёт ~1 час
}

export { base64url, pemToDer, importPrivateKey };

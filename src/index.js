// index.js — точка входа Cloudflare Worker.
// Сейчас: проверка связи с Google Sheets (чтение). Остальная бизнес-логика
// (разбор исключений, стикеры и т.д.) переносится следующими шагами, после
// того как эта основа подтверждённо работает.

import { getGoogleAccessToken } from './google-auth.js';

// CORS — фронтенд (пока это может быть тот же Index.html, только с другим
// адресом сервера вместо google.script.run) будет дёргать Worker с другого
// домена, без этих заголовков браузер просто заблокирует ответ.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // сузить до конкретного домена, когда фронтенд определится
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

// Читает НЕСКОЛЬКО диапазонов ОДНИМ вызовом (как batchGet в Apps Script) —
// тот же принцип, тот же самый REST-эндпоинт Sheets API, просто вызванный
// напрямую по HTTPS вместо обёртки Sheets.Spreadsheets.Values.batchGet().
async function batchGetRanges(accessToken, spreadsheetId, ranges) {
  const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values:batchGet');
  ranges.forEach((r) => url.searchParams.append('ranges', r));
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  const resp = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error('Sheets API batchGet failed: ' + resp.status + ' ' + JSON.stringify(data));
  return data;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      // Проверочный маршрут: /test-sheets — подтверждает, что связь с Google
      // Sheets работает целиком (JWT → токен → чтение реального диапазона).
      if (url.pathname === '/test-sheets') {
        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const data = await batchGetRanges(accessToken, env.SPREADSHEET_ID, [
          "'Ингредиенты'!A1:E5", // маленький кусок для проверки — 5 строк из "Ингредиенты"
        ]);
        return json({ ok: true, sample: data });
      }

      return json({ ok: true, message: 'Green City Worker жив. Доступные маршруты: /test-sheets' });
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  },
};

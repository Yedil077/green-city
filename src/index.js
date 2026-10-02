// index.js — точка входа Cloudflare Worker.
// Чтение Google Sheets подтверждено рабочим (/test-sheets). Запись (sheets.js)
// добавлена, но ЕЩЁ НИГДЕ не вызывается на реальную запись автоматически —
// /test-sheets-write делает только DRY RUN (показывает, что было бы записано,
// ничего не меняя в таблице).

import { getGoogleAccessToken } from './google-auth.js';
import { batchGetRanges } from './sheets.js';

// Для записи нужен полный доступ. Чтобы не получать два разных access token
// без необходимости, читаем и пишем одним и тем же токеном с этим scope.
const WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

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
        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, WRITE_SCOPE);
        const data = await batchGetRanges(accessToken, env.SPREADSHEET_ID, [
          "'Ингредиенты'!A1:E5", // маленький кусок для проверки — 5 строк из "Ингредиенты"
        ]);
        return json({ ok: true, sample: data });
      }

      // Безопасная проверка записи: НИЧЕГО не пишет в таблицу. Показывает,
      // какой диапазон, какое текущее значение и что БЫЛО БЫ записано, если
      // вызвать updateRange/appendRows/batchUpdateValues из sheets.js.
      // Реальная тестовая запись делается только вручную, после того как
      // диапазон/значение/изменение явно показаны и подтверждены в чате.
      if (url.pathname === '/test-sheets-write') {
        const targetRange = url.searchParams.get('range') || "'Ингредиенты'!H1";
        const proposedValue = url.searchParams.get('value') || ('TEST_' + Date.now());

        const accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, WRITE_SCOPE);
        const current = await batchGetRanges(accessToken, env.SPREADSHEET_ID, [targetRange]);
        const currentValues = (current.valueRanges && current.valueRanges[0] && current.valueRanges[0].values) || [];

        return json({
          ok: true,
          dryRun: true,
          message: 'Это ПРЕДПРОСМОТР. В таблицу ничего не записано.',
          range: targetRange,
          currentValue: currentValues,
          proposedValue: [[proposedValue]],
        });
      }

      return json({
        ok: true,
        message: 'Green City Worker жив. Доступные маршруты: /test-sheets, /test-sheets-write (dry run)',
      });
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  },
};

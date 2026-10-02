// sheets.js — обёртка над Google Sheets API v4 (REST): чтение и запись.
// Требует access token, полученный через google-auth.js. Для записи токен
// должен быть выдан со scope "https://www.googleapis.com/auth/spreadsheets"
// (полный доступ) — см. WRITE_SCOPE в index.js.

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Читает НЕСКОЛЬКО диапазонов ОДНИМ вызовом (как batchGet в Apps Script).
export async function batchGetRanges(accessToken, spreadsheetId, ranges) {
  const url = new URL(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet`);
  ranges.forEach((r) => url.searchParams.append('ranges', r));
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  const resp = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error('Sheets API batchGet failed: ' + resp.status + ' ' + JSON.stringify(data));
  return data;
}

// Перезаписывает ОДИН диапазон (аналог Range.setValues в Apps Script).
export async function updateRange(accessToken, spreadsheetId, range, values) {
  const url = new URL(`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`);
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  const resp = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error('Sheets API update failed: ' + resp.status + ' ' + JSON.stringify(data));
  return data;
}

// Перезаписывает НЕСКОЛЬКО диапазонов ОДНИМ вызовом (аналог batchWriteSheets_
// из Data.gs — одна сетевая операция вместо N отдельных записей).
export async function batchUpdateValues(accessToken, spreadsheetId, data) {
  // data: [{ range: "'Лист'!A1", values: [[...], ...] }, ...]
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });
  const respData = await resp.json();
  if (!resp.ok) throw new Error('Sheets API batchUpdate failed: ' + resp.status + ' ' + JSON.stringify(respData));
  return respData;
}

// Дописывает строки В КОНЕЦ диапазона/таблицы (аналог appendRow в Apps Script).
export async function appendRows(accessToken, spreadsheetId, range, values) {
  const url = new URL(`${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append`);
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  url.searchParams.set('insertDataOption', 'INSERT_ROWS');
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error('Sheets API append failed: ' + resp.status + ' ' + JSON.stringify(data));
  return data;
}

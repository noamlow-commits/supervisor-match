/**
 * One-time fixup — publishes ד"ר ברוך כהנא's card WITHOUT marking him available.
 *
 * Follows createBaruchKahana(), which created his row as a draft
 * (published=false, hasSpot=false). Noam's call 2026-08-02: open the card, but
 * don't send him anything — Tal will update him herself.
 *
 * ── WHAT "PUBLISHED" DOES AND DOESN'T DO HERE ─────────────────────────────
 * Since commit 75026ba (Michal's request, 2026-07-15) index.html renders only
 * cards that pass visibleToStudents() — an open spot, or a consultation card.
 * So publishing alone does NOT put him in front of students: with hasSpot=false
 * he stays hidden from the directory. That is the intent.
 *
 *   published=true   → the row is live, appears in Tal's admin dashboard,
 *                      and his personal supervisor.html link works.
 *   hasSpot=false    → students do not see him. He is not being advertised as
 *                      taking supervisees this year — his line in Tal's doc
 *                      reads "מלא תשפו", not "אישור תשפז" like everyone else.
 *
 * He becomes student-visible the moment he (from his own editor) or Tal (from
 * admin) turns the spot on. Nothing else needs to run.
 *
 * Sends no mail. Changes exactly two cells: published and updated.
 * Idempotent — a second run reports "already published" and writes nothing.
 *
 * Run from the Apps Script editor (Run ▸ publishBaruchKahana). No redeploy needed.
 */
function publishBaruchKahana() {
  var TARGET_NAME  = 'ד"ר ברוך כהנא';
  var TARGET_EMAIL = 'REDACTED@example.com';

  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  if (col.published === undefined) throw new Error('No "published" column in Supervisors sheet.');

  // Match by name OR email — the ד"ר title and gershayim get typed inconsistently,
  // so the email is the more reliable key of the two.
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    var sameName = String(data[i][col.fullName]).trim() === TARGET_NAME;
    var sameMail = col.email !== undefined &&
                   String(data[i][col.email]).trim().toLowerCase() === TARGET_EMAIL;
    if (sameName || sameMail) { rowIdx = i; break; }
  }
  if (rowIdx === -1) {
    var missing = 'NOT FOUND: ' + TARGET_NAME + ' — run createBaruchKahana() first.';
    Logger.log(missing);
    return missing;
  }

  var rowNum = rowIdx + 1;
  var already = data[rowIdx][col.published] === true ||
                String(data[rowIdx][col.published]).toUpperCase() === 'TRUE';
  if (already) {
    var noop = 'כבר מפורסם: ' + TARGET_NAME + ' (שורה ' + rowNum + ') — לא נכתב כלום.';
    Logger.log(noop);
    return noop;
  }

  sheet.getRange(rowNum, col.published + 1).setValue(true);
  if (col.updated !== undefined) {
    sheet.getRange(rowNum, col.updated + 1).setValue(new Date().toISOString());
  }

  var spot = col.hasSpot === undefined ? '(אין עמודה)' :
             ((data[rowIdx][col.hasSpot] === true ||
               String(data[rowIdx][col.hasSpot]).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE');
  var token = col.token === undefined ? '' : String(data[rowIdx][col.token] || '');

  var msg = 'פורסם: ' + TARGET_NAME + ' (שורה ' + rowNum + ')\n' +
            'hasSpot נשאר ' + spot + ' — הסטודנטים עדיין לא רואים אותו, וזו הכוונה.\n' +
            'הוא יופיע בדירקטוריון ברגע שהוא או טל ידליקו "יש מקום פנוי".\n' +
            (token ? 'קישור אישי: <appBaseUrl>/supervisor.html?token=' + token + '\n' : '') +
            'לא נשלח מייל.';
  Logger.log(msg);
  return msg;
}

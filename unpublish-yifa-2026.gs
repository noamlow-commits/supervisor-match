/**
 * One-off: REMOVE ד"ר יפעה מליק-גרינברג from the student directory by un-publishing
 * her card (published = false). Her row and all data stay in the Sheet — the admin
 * dashboard still shows her — she just stops appearing to students (getSupervisors
 * returns published rows only). Fully reversible: set published back to TRUE.
 *
 * Run ONCE from the Apps Script editor: Run ▸ unpublishYifa.
 * Redeploy is NOT required (data-only change to the Sheet).
 * Idempotent: safe to re-run. Matches by token first, then by email.
 */
function unpublishYifa() {
  var TOKEN = 'w8hp3udsj56sng';
  var EMAIL = 'yifaor@walla.com';

  var sheet = getOrCreateSupervisorsSheet();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var tokenCol = headers.indexOf('token');
  var emailCol = headers.indexOf('email');
  var pubCol   = headers.indexOf('published');
  if (pubCol < 0) { Logger.log('NO published COLUMN — aborting.'); return; }

  var rowIdx = -1;
  for (var i = 1; i < values.length; i++) {
    var tok = String(values[i][tokenCol] || '').trim();
    var eml = String(values[i][emailCol] || '').trim().toLowerCase();
    if (tok === TOKEN || (EMAIL && eml === EMAIL.toLowerCase())) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) {
    Logger.log('NOT FOUND: יפעה row (token=' + TOKEN + ', email=' + EMAIL + ')');
    return;
  }

  sheet.getRange(rowIdx, pubCol + 1).setValue(false);
  var upCol = headers.indexOf('updated');
  if (upCol >= 0) sheet.getRange(rowIdx, upCol + 1).setValue(new Date().toISOString());

  Logger.log('DONE: יפעה (row ' + rowIdx + ') → published=false. הוסרה מהדירקטוריון של התלמידים (הנתונים נשמרו).');
}

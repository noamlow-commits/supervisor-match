/**
 * One-off: mark ד"ר יפעה מליק-גרינברג's card as focused psychiatric CONSULTATION,
 * not supervision (הדרכה). Run ONCE from the Apps Script editor: Run ▸ setYifaConsultation.
 *
 * Prerequisites: paste the updated apps-script-code.js into Code.gs first (this script
 * relies on the new `cardType` column + ensureCardTypeColumn() migration), then Run.
 * Redeploy is NOT required for this data change to take effect (it only writes to the Sheet);
 * but the UI changes (index.html/admin.html) reach the live site via git push → Pages, and the
 * apps-script endpoint changes require a redeploy. See the deploy note at the bottom.
 *
 * Idempotent: safe to re-run. Matches by token first, then by email.
 */
function setYifaConsultation() {
  ensureCardTypeColumn();

  var TOKEN = 'w8hp3udsj56sng';
  var EMAIL = 'yifaor@walla.com';

  var sheet = getOrCreateSupervisorsSheet();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var tokenCol = headers.indexOf('token');
  var emailCol = headers.indexOf('email');

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

  var updates = {
    cardType:    'consultation',
    credential:  'פסיכיאטרית מתמחה',
    styleText:   'אינה משמשת כמדריכת הדרכה. ניתן לפנות אליה לייעוץ פסיכיאטרי ממוקד — למשל שאלות תרופתיות, התלבטויות אבחנתיות, או צורך בחוות דעת פסיכיאטרית במהלך טיפול.',
    hasSpot:     false,   // consultation has no supervision "spot"
    maxStudents: 0,
    published:   true,
    updated:     new Date().toISOString()
  };

  Object.keys(updates).forEach(function (k) {
    var col = headers.indexOf(k);
    if (col < 0) return;
    sheet.getRange(rowIdx, col + 1).setValue(updates[k]);
  });

  Logger.log('UPDATED יפעה (row ' + rowIdx + ') → cardType=consultation, hasSpot=false, published=true.');
}

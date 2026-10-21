/**
 * READ-ONLY, REDACTED look at one supervisor's card — built for Binyamin Goldenhirsch, who told Tal
 * on 21.10.2026 that he could not save. Writes nothing; prints no token, email or phone.
 *
 * It answers the question the server log cannot: did any save of his ever LAND?
 *   - `updated` after 18.10 (the day the mail with the personal links went out) → a save arrived
 *   - `updated` unchanged since an older date → nothing he did was written
 * and whether the card still holds data (filled fields) or was blanked, plus published/hasSpot/
 * archived/cardType, token state, students placed, and whether a second row shares the name.
 *
 * Run from the Apps Script editor (Run ▸ diagnoseGoldenhirsch2026) and read the execution log.
 */
function diagnoseGoldenhirsch2026() {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });
  var placed = placedCountsByToken();
  var truthy = function (v) { return v === true || String(v).toUpperCase() === 'TRUE'; };
  var norm = function (v) { return String(v == null ? '' : v).replace(/["'״׳`‎‏]/g, '').replace(/\s+/g, ' ').trim(); };
  var CONTENT = ['credential', 'yearsSupervising', 'orientations', 'populations', 'specialties',
                 'styleText', 'format', 'area', 'availability', 'phone', 'email', 'maxStudents'];
  var tokenCount = {};
  for (var i = 1; i < data.length; i++) {
    var t = String(data[i][col.token] || '').trim();
    if (t) tokenCount[t] = (tokenCount[t] || 0) + 1;
  }
  var out = ['=== גולדנהירש — אבחון מוסתר, קריאה בלבד ==='];
  var found = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r], nm = norm(row[col.fullName]);
    if (nm.indexOf('גולדנ') < 0) continue;
    found++;
    var token = String(row[col.token] || '').trim();
    var filled = CONTENT.filter(function (f) {
      var v = col[f] === undefined ? '' : String(row[col[f]] == null ? '' : row[col[f]]).trim();
      return v !== '' && v !== '{}';
    });
    var empty = CONTENT.filter(function (f) { return filled.indexOf(f) < 0; });
    out.push('');
    out.push('שורה ' + (r + 1) + ': שם="' + nm + '"');
    out.push('  מפורסם: ' + (truthy(row[col.published]) ? 'כן' : 'לא') +
             ' | מוסתר: ' + (col.archived !== undefined && truthy(row[col.archived]) ? 'כן' : 'לא') +
             ' | מקום פנוי: ' + (truthy(row[col.hasSpot]) ? 'כן' : 'לא') +
             ' | סוג: ' + (String(row[col.cardType] || '') || 'הדרכה') +
             ' | נשלח מייל: ' + (col.mailed !== undefined && truthy(row[col.mailed]) ? 'כן' : 'לא'));
    out.push('  טוקן: ' + (!token ? 'ריק' : (tokenCount[token] > 1 ? 'משותף' : 'ייחודי')) + (token ? ' (אורך ' + token.length + ')' : ''));
    out.push('  תלמידים משובצים: ' + (token ? (placed[token] || 0) : 0));
    out.push('  נוצר: ' + String(row[col.created] || '').slice(0, 16) + ' | עודכן לאחרונה: ' + String(row[col.updated] || '').slice(0, 16));
    out.push('  מלאים (' + filled.length + '/' + CONTENT.length + '): ' + (filled.join(', ') || '(אין)'));
    out.push('  ריקים: ' + (empty.join(', ') || '(אין)'));
  }
  if (!found) out.push('לא נמצאה שורה עם "גולדנ" — ייתכן איות אחר.');
  if (found > 1) out.push('\n⚠ יש יותר משורה אחת — אותה כפילות כמו אצל כהנא.');
  var report = out.join('\n');
  Logger.log(report);
  return report;
}

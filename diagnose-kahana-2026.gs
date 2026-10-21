/**
 * READ-ONLY, REDACTED diagnosis of the duplicate ד"ר ברוך כהנא cards (Tal, 21.10.2026:
 * "two cards, one of them cannot be edited"). Writes nothing, prints no token, email or phone.
 *
 * Why a card cannot be edited, in this app:
 *   - empty token        → admin shows no ✎ link and no buttons for the row (admin.html: `s.token ? … : '—'`)
 *   - token shared with another row → getSupervisor/saveSupervisor take the FIRST match, so the later row
 *     can never be opened or saved (it resolves to its twin)
 *   - token present and unique → the card is editable and the cause is somewhere else
 *
 * For every row whose name contains כהנא it reports: sheet row, published, archived, hasSpot,
 * cardType, token state (empty / unique / SHARED with N other rows), students placed against it,
 * and which profile fields are filled. Also reports how many tokens in the whole sheet are empty
 * or shared, because that is the same defect on other cards.
 *
 * Run from the Apps Script editor (Run ▸ diagnoseKahana2026) and read the execution log.
 */
function diagnoseKahana2026() {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });
  var placed = placedCountsByToken();
  var truthy = function (v) { return v === true || String(v).toUpperCase() === 'TRUE'; };
  var norm = function (v) { return String(v == null ? '' : v).replace(/["'״׳`‎‏]/g, '').replace(/\s+/g, ' ').trim(); };

  var tokenCount = {};
  for (var i = 1; i < data.length; i++) {
    var t = String(data[i][col.token] || '').trim();
    if (t) tokenCount[t] = (tokenCount[t] || 0) + 1;
  }

  var CONTENT = ['credential', 'yearsSupervising', 'orientations', 'populations', 'specialties',
                 'styleText', 'format', 'area', 'availability', 'phone', 'email', 'maxStudents'];
  var out = ['=== כהנא — אבחון מוסתר, קריאה בלבד ==='];
  var found = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (norm(row[col.fullName]).indexOf('כהנא') < 0) continue;
    found++;
    var token = String(row[col.token] || '').trim();
    var state = !token ? 'ריק' : (tokenCount[token] > 1 ? 'משותף עם ' + (tokenCount[token] - 1) + ' שורות אחרות' : 'ייחודי');
    var filled = CONTENT.filter(function (f) {
      var v = col[f] === undefined ? '' : row[col[f]];
      v = String(v == null ? '' : v).trim();
      return v !== '' && v !== '{}';
    });
    out.push('');
    out.push('שורה ' + (r + 1) + ': שם="' + norm(row[col.fullName]) + '"');
    out.push('  מפורסם: ' + (truthy(row[col.published]) ? 'כן' : 'לא') +
             ' | מוסתר/ארכיון: ' + (col.archived !== undefined && truthy(row[col.archived]) ? 'כן' : 'לא') +
             ' | מקום פנוי: ' + (truthy(row[col.hasSpot]) ? 'כן' : 'לא') +
             ' | סוג: ' + (String(row[col.cardType] || '') || 'הדרכה'));
    out.push('  טוקן: ' + state + (token ? ' (אורך ' + token.length + ')' : ''));
    out.push('  תלמידים משובצים: ' + (token ? (placed[token] || 0) : 0));
    out.push('  שדות מלאים (' + filled.length + '/' + CONTENT.length + '): ' + (filled.join(', ') || '(אין)'));
    out.push('  נוצר: ' + String(row[col.created] || '').slice(0, 10) + ' | עודכן: ' + String(row[col.updated] || '').slice(0, 10));
  }
  if (!found) out.push('לא נמצאה שורה עם "כהנא".');

  var empty = 0, shared = 0, seen = {};
  for (var k = 1; k < data.length; k++) {
    if (!norm(data[k][col.fullName])) continue;
    var tk = String(data[k][col.token] || '').trim();
    if (!tk) empty++; else if (tokenCount[tk] > 1) shared++;
  }
  out.push('');
  out.push('בכל הגיליון: שורות עם שם וטוקן ריק = ' + empty + ' | שורות עם טוקן משותף = ' + shared);
  var report = out.join('\n');
  Logger.log(report);
  return report;
}

/**
 * Sends ONE email — to the script owner only — listing every supervisor with their
 * direct personal link, so the secretary can check each link and forward it by hand.
 * (Noam, 18.10.2026: the staff is tired of the system; the link must open the card
 * directly, with no claim step and nothing to approve.)
 *
 * The link is supervisor.html?token=<token>, which IS the supervisor's password. So:
 *   - the list goes only to Session.getEffectiveUser() — the account the script runs
 *     as — never to an address written here (this repo is public);
 *   - the sheet is only read: nothing is marked, nothing is sent to supervisors;
 *   - each supervisor must receive ONLY their own link, never the whole list.
 *
 * Archived supervisors are listed last and marked, not dropped — the secretary decides.
 *
 * Run from the Apps Script editor (Run ▸ emailOwnerAllSupervisorLinks). No redeploy.
 */
function emailOwnerAllSupervisorLinks() {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var baseUrl = getSetting('appBaseUrl') || 'https://noamlow-commits.github.io/supervisor-match/';
  if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';
  var schoolName = getSetting('schoolName') || 'בית הספר הדיאלוגי';
  var truthy = function (v) { return v === true || v === 'TRUE' || v === 'true'; };
  var cell = function (row, key) { return col[key] === undefined ? '' : row[col[key]]; };

  var rows = [], noToken = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(cell(data[i], 'fullName') || '').trim();
    if (!name) continue;
    var token = String(cell(data[i], 'token') || '').trim();
    if (!token) { noToken.push(name); continue; }
    rows.push({
      name: name,
      url: baseUrl + 'supervisor.html?token=' + encodeURIComponent(token),
      phone: String(cell(data[i], 'phone') || '').trim(),
      email: String(cell(data[i], 'email') || '').trim(),
      archived: truthy(cell(data[i], 'archived')),
      published: truthy(cell(data[i], 'published'))
    });
  }
  rows.sort(function (a, b) {
    return (a.archived - b.archived) || a.name.localeCompare(b.name, 'he');
  });

  var td = 'style="border:1px solid #ddd;padding:6px 8px;vertical-align:top"';
  var table = rows.map(function (r, n) {
    var status = r.archived ? 'מוסתר לשנה הבאה' : (r.published ? 'מפורסם' : 'לא מפורסם');
    return '<tr><td ' + td + '>' + (n + 1) + '</td><td ' + td + '><b>' + escapeHtml(r.name) + '</b></td>' +
      '<td ' + td + '><a href="' + r.url + '">' + r.url + '</a></td>' +
      '<td ' + td + '>' + escapeHtml(r.phone) + '<br>' + escapeHtml(r.email) + '</td>' +
      '<td ' + td + '>' + status + '</td></tr>';
  }).join('');

  var template =
    'שלום [שם], זה הקישור האישי שלך לכרטיס המדריך במאגר של ' + schoolName + ':<br>[קישור]<br>' +
    'הקישור פותח את הכרטיס ישירות — בלי סיסמה ובלי אישור. אפשר לעדכן פרטים, והכול נשמר אוטומטית. ' +
    'הקישור אישי, נא לא להעביר אותו לאחרים.';

  var html =
    '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">' +
    '<p><b>קישורים אישיים למדריכים — ' + rows.length + ' מדריכים</b></p>' +
    '<p style="background:#fff4e5;padding:8px 10px;border-radius:6px">⚠ כל קישור הוא הסיסמה של המדריך. ' +
    'לשלוח לכל מדריך <b>רק את הקישור שלו</b>, לא את הרשימה, ולא להעביר את המייל הזה הלאה.</p>' +
    '<p><b>לבדיקה לפני השליחה:</b> לפתוח קישור — אמור להופיע "טוען את הפרופיל שלך…" ואז הכרטיס עם הפרטים של המדריך. ' +
    'לא לשנות שום דבר בבדיקה (כל שינוי נשמר מיד).</p>' +
    '<p><b>נוסח מוצע לשליחה:</b><br>' + template + '</p>' +
    '<table style="border-collapse:collapse;font-size:13px"><tr>' +
    '<th ' + td + '>#</th><th ' + td + '>שם</th><th ' + td + '>קישור אישי</th><th ' + td + '>טלפון / מייל</th><th ' + td + '>מצב</th></tr>' +
    table + '</table>' +
    (noToken.length ? '<p>ללא קישור (אין token): ' + noToken.map(escapeHtml).join(', ') + '</p>' : '') +
    '</div>';

  var to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: to, subject: 'קישורים אישיים למדריכים (' + rows.length + ') — לבדיקה והעברה ידנית', htmlBody: html });
  Logger.log('נשלח אל ' + to + ': ' + rows.length + ' מדריכים' + (noToken.length ? ', ' + noToken.length + ' ללא token' : ''));
}

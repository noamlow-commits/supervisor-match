/**
 * Sends EVERY supervisor a direct personal link to their own card.
 *
 * The link is supervisor.html?token=<their token> — one click opens their profile
 * editor, no claim step / no typing name+email. The token IS their password, so the
 * email tells them to keep it private.
 *
 * Behaviour:
 *   - Aborts immediately if appBaseUrl (Settings) is empty — otherwise the link
 *     would be a broken relative URL.
 *   - Sends to every row that has BOTH an email and a token. Rows missing either are
 *     skipped and reported.
 *   - Marks each emailed row mailed=true.
 *
 * ⚠ Run ONCE. Re-running re-sends to everyone (it does not check mailed first, on
 *   purpose — "send to ALL"). If you only want the not-yet-mailed ones later, use the
 *   built-in sendInvitationsToUnmailed() instead.
 *
 * Run from the Apps Script editor (Run ▸ emailAllSupervisorsTheirCardLink).
 * No redeploy needed — writes directly to the bound spreadsheet.
 */
function emailAllSupervisorsTheirCardLink() {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var baseUrl = getSetting('appBaseUrl') || '';
  if (!baseUrl) {
    throw new Error('appBaseUrl ריק ב-Settings. מלא אותו ' +
      '(https://noamlow-commits.github.io/supervisor-match/) לפני השליחה, אחרת הקישור יישבר.');
  }
  if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';

  var schoolName = getSetting('schoolName') || 'בית הספר הדיאלוגי';

  var sent = [], skipped = [];

  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][col.fullName] || '').trim();
    if (!name) continue;

    var email = String(data[i][col.email] || '').trim();
    var token = String(data[i][col.token] || '').trim();

    if (!email) { skipped.push(name + ' — אין מייל'); continue; }
    if (!token) { skipped.push(name + ' — אין token'); continue; }

    var personalUrl = baseUrl + 'supervisor.html?token=' + encodeURIComponent(token);

    MailApp.sendEmail({
      to: email,
      name: schoolName,
      subject: 'הקישור האישי לכרטיס המדריך שלך — ' + schoolName,
      htmlBody:
        '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7">' +
        '<p>שלום ' + escapeHtml(name) + ',</p>' +
        '<p>במסגרת מאגר המדריכים של ' + escapeHtml(schoolName) + ' הוקם עבורך כרטיס מדריך אישי.</p>' +
        '<p>זהו הקישור האישי שלך לצפייה ולעריכת הכרטיס בכל עת:</p>' +
        '<p><a href="' + personalUrl + '">' + personalUrl + '</a></p>' +
        '<p>בקישור תוכל/י לעבור על הפרטים, לעדכן, ולפרסם את הכרטיס כך שיופיע בפני התלמידים המחפשים מדריך.</p>' +
        '<p><b>חשוב:</b> שמור/שמרי את הקישור — הוא אישי ומשמש כסיסמה. כל מי שמחזיק בו יכול לערוך את הכרטיס.</p>' +
        '<p>בברכה,<br>צוות ' + escapeHtml(schoolName) + '</p>' +
        '</div>'
    });

    if (col.mailed !== undefined) sheet.getRange(i + 1, col.mailed + 1).setValue(true);
    sent.push(name + ' <' + email + '>');
  }

  var report = 'נשלחו ' + sent.length + ' מיילים:\n' + (sent.join('\n') || '(אין)') +
               '\n\nדולגו ' + skipped.length + ':\n' + (skipped.join('\n') || '(אין)');
  Logger.log(report);
  return report;
}

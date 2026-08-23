/**
 * Sends סלעית בן דרור the same personal card-link email the other supervisors got.
 *
 * Mirrors emailAllSupervisorsTheirCardLink() but targets her single row, so the
 * mail comes from the same account / same wording. Run AFTER createSalitBenDror().
 *
 * Run from the Apps Script editor (Run ▸ emailSalitHerLink).
 */
function emailSalitHerLink() {
  var TARGET_NAME = 'סלעית בן דרור';

  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var baseUrl = getSetting('appBaseUrl') || '';
  if (!baseUrl) {
    throw new Error('appBaseUrl ריק ב-Settings — הקישור יישבר. מלא אותו לפני שליחה.');
  }
  if (baseUrl.charAt(baseUrl.length - 1) !== '/') baseUrl += '/';

  var schoolName = getSetting('schoolName') || 'בית הספר הדיאלוגי';

  var rowNum = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col.fullName]).trim() === TARGET_NAME) { rowNum = i + 1; break; }
  }
  if (rowNum === -1) { Logger.log('NOT FOUND: ' + TARGET_NAME + ' — run createSalitBenDror first'); return 'NOT FOUND'; }

  var email = String(data[rowNum - 1][col.email] || '').trim();
  var token = String(data[rowNum - 1][col.token] || '').trim();
  var name = String(data[rowNum - 1][col.fullName] || '').trim();
  if (!email) { Logger.log('NO EMAIL'); return 'NO EMAIL'; }
  if (!token) { Logger.log('NO TOKEN'); return 'NO TOKEN'; }

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

  if (col.mailed !== undefined) sheet.getRange(rowNum, col.mailed + 1).setValue(true);

  var msg = 'SENT to ' + name + ' <' + email + '>';
  Logger.log(msg);
  return msg;
}

/**
 * One-time fixup — adds מני פולק's email to his existing DRAFT card.
 *
 * Background: applyFormUpdates2026() created מני פולק as a DRAFT (published=false)
 * with phone 0545291780 but NO email, because the form didn't include it. Noam
 * supplied it afterwards: manipollak@gmail.com.
 *
 * This writes ONLY the email field (+ updated timestamp) onto his row, matched by
 * exact fullName 'מני פולק'. It does NOT publish the card and does NOT send a mail —
 * see the optional flags below if you want to do those in the same run.
 *
 * Run from the Apps Script editor (Run ▸ setManiPolakEmail). No redeploy needed —
 * this writes directly to the bound spreadsheet.
 */
function setManiPolakEmail() {
  var TARGET_NAME = 'מני פולק';
  var EMAIL       = 'manipollak@gmail.com';

  // Optional follow-ups — flip to true if you want them done in the same run:
  var ALSO_PUBLISH    = false;  // set published=true so the card becomes student-visible
  var ALSO_SEND_CLAIM = false;  // email מני a claim link (requires ALSO_PUBLISH or at least a token)

  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  if (col.email === undefined) {
    throw new Error('No "email" column found in Supervisors sheet.');
  }

  var rowNum = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col.fullName]).trim() === TARGET_NAME) { rowNum = i + 1; break; }
  }
  if (rowNum === -1) {
    var msg = 'NOT FOUND: ' + TARGET_NAME + ' — no row to update.';
    Logger.log(msg);
    return msg;
  }

  var now = new Date().toISOString();
  sheet.getRange(rowNum, col.email + 1).setValue(EMAIL);
  if (col.updated !== undefined) sheet.getRange(rowNum, col.updated + 1).setValue(now);

  var report = ['EMAIL SET : ' + TARGET_NAME + ' -> ' + EMAIL];

  if (ALSO_PUBLISH && col.published !== undefined) {
    sheet.getRange(rowNum, col.published + 1).setValue(true);
    report.push('PUBLISHED : ' + TARGET_NAME);
  }

  if (ALSO_SEND_CLAIM) {
    var token = String(data[rowNum - 1][col.token] || '').trim();
    if (token && typeof sendInvitationsToUnmailed === 'function') {
      // mark as not-yet-mailed so the existing invitation flow picks it up
      if (col.mailed !== undefined) sheet.getRange(rowNum, col.mailed + 1).setValue(false);
      sendInvitationsToUnmailed();
      report.push('CLAIM MAIL queued via sendInvitationsToUnmailed()');
    } else {
      report.push('CLAIM MAIL skipped (no token or sender fn unavailable)');
    }
  }

  var out = report.join('\n');
  Logger.log(out);
  return out;
}

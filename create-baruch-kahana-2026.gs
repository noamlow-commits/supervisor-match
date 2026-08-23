/**
 * One-time creator — adds ד"ר ברוך כהנא as a new supervisor card (DRAFT).
 *
 * Background: he appears in Tal's roster doc (28.7.2026) with a full description,
 * phone and email, but importSupervisorPhones2026's preview reported him NOT FOUND
 * — he has no row in the Supervisors tab at all, published or draft. Confirmed by
 * Noam searching the sheet for "כהנא" by hand.
 *
 * ── WHY THIS CARD IS DELIBERATELY THIN ────────────────────────────────────
 * Every content field in his row of the doc carries a question mark:
 *
 *   שנות נסיון "מעל 30?" · תחום "דינאמי?" · אוכלוסייה "מבוגרים?" · גישה "דיאלוגית?"
 *   מספר מודרכים "3?" · פורמט "מקוון?" · זמינות "בתיאום?"
 *
 * Those are Tal's guesses, not his answers, so they are NOT written to the sheet —
 * a guess stored in a structured field stops looking like a guess the moment it
 * renders on a card. They're preserved in this comment; if he confirms any of
 * them, they can be filled in properly.
 *
 * And his status column reads "מלא תשפו" (full in תשפ"ו) while every other
 * supervisor's reads "אישור תשפז" (cleared for תשפ"ז). So there is no evidence he
 * is available this year. Hence: published=false, hasSpot=false. He decides.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 * Creates ONE row with name, credential, area, phone, email — nothing else.
 * Aborts if a row with his name OR his email already exists (no duplicates).
 * Sends no mail: mailed=true guards the row against sendInvitationsToUnmailed().
 * To give him his link afterwards, see email-all-supervisors-link-2026.gs.
 *
 * Run from the Apps Script editor (Run ▸ createBaruchKahana). No redeploy needed.
 */
function createBaruchKahana() {
  var rec = {
    fullName: 'ד"ר ברוך כהנא',
    credential: 'פסיכולוג קליני, מרצה באוניברסיטה העברית בבית הספר לעבודה סוציאלית, ' +
                'בכיר במכון רוטנברג — המרכז לפסיכולוגיה דיאלוגית, מדריך מוסמך, חבר המכון היונגיאני',
    area: 'גוש עציון / נווה דניאל',
    email: 'REDACTED@example.com',
    phone: '05XXXXXXXX'
    // yearsSupervising / orientations / populations / styleText / format / maxStudents
    // are intentionally left empty — see the header. He fills them in himself.
  };

  ensureMaxStudentsColumn();
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = headers.indexOf('fullName');
  var mailCol = headers.indexOf('email');

  // Guard: refuse to create a duplicate. Checks name AND email — his name has a
  // ד"ר title and gershayim, which are exactly the characters that get typed
  // inconsistently, so the email is the more reliable of the two.
  for (var i = 1; i < data.length; i++) {
    var sameName = String(data[i][nameCol]).trim() === rec.fullName;
    var sameMail = mailCol >= 0 && rec.email &&
                   String(data[i][mailCol]).trim().toLowerCase() === rec.email.toLowerCase();
    if (sameName || sameMail) {
      var dup = 'ALREADY EXISTS: ' + rec.fullName + ' (row ' + (i + 1) + ', matched by ' +
                (sameName ? 'name' : 'email') + ') — aborting, no duplicate created.';
      Logger.log(dup);
      return dup;
    }
  }

  var now = new Date().toISOString();
  var newRow = headers.map(function (h) {
    switch (h) {
      case 'token': return generateToken();
      case 'created': return now;
      case 'updated': return now;
      case 'published': return false;        // DRAFT — not visible to students
      case 'hasSpot': return false;          // no evidence he's taking supervisees this year
      case 'availability': return '{}';
      case 'whatsappEnabled': return false;  // he can enable it in his own profile
      case 'studentsAccepted': return 0;
      case 'mailed': return true;            // guard: never auto-bulk-mail this row
      case 'cardType': return '';            // ordinary supervision card
      default: return (rec[h] !== undefined ? rec[h] : '');
    }
  });
  sheet.appendRow(newRow);

  // Preserve the leading zero on the phone (Sheets would coerce it to a Number)
  var newRowNum = sheet.getLastRow();
  var phoneCol = headers.indexOf('phone');
  if (phoneCol >= 0 && rec.phone) {
    var pcell = sheet.getRange(newRowNum, phoneCol + 1);
    pcell.setNumberFormat('@');
    pcell.setValue(String(rec.phone));
  }

  var token = String(newRow[headers.indexOf('token')]);
  var msg = 'CREATED: ' + rec.fullName + ' (row ' + newRowNum + ', DRAFT, hasSpot=false)\n' +
            'token: ' + token + '\n' +
            'קישור אישי: <appBaseUrl>/supervisor.html?token=' + token + '\n' +
            'לא נשלח מייל. הכרטיס לא מוצג לסטודנטים עד שהוא יפרסם אותו בעצמו.';
  Logger.log(msg);
  return msg;
}

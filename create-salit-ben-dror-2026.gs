/**
 * One-time creator — adds סלעית בן דרור as a new supervisor card.
 *
 * Background: סלעית sent her details via WhatsApp (not the form), so Tal pasted
 * a messy row into the form-responses sheet (bullets, labels, free text, no
 * email/phone). The values below are the NORMALIZED version mapped onto the
 * system's structured fields + controlled vocab — the same hand-clean treatment
 * the other 7 form supervisors got. Email + phone supplied by Noam afterwards.
 *
 * Creates a DRAFT (published=false): she reviews/completes and publishes herself
 * once she opens her personal link. mailed=true guards against accidental bulk re-mail.
 *
 * Judgment calls (change here if you disagree):
 *   - orientations: mapped her long paragraph to 3 of the 6 controlled options.
 *     Music/arts/Reiki/Jewish-psychology have no controlled tag → kept in credential.
 *   - populations: she wrote "today mainly adults" (+ experience with kids/teens) → מבוגרים.
 *   - format: "פרונטלי / מקוון" → היברידי.
 *   - hasSpot: true (maxStudents 1, no indication she's full).
 *   - yearsSupervising: 11 (she wrote "17 שנות טיפול, 11 שנות הדרכה").
 *
 * Run from the Apps Script editor (Run ▸ createSalitBenDror). No redeploy needed —
 * writes directly to the bound spreadsheet.
 */
function createSalitBenDror() {
  var rec = {
    fullName: 'סלעית בן דרור',
    credential: 'פסיכותרפיסטית, מטפלת במוסיקה ויועצת מינית; בוגרת תוכנית פסיכותרפיה דינמית ממוקדת (\'יישומים קליניים\', ת"א) וטיפול במוסיקה (דוד ילין, ירושלים)',
    yearsSupervising: 11,
    orientations: 'דינאמי;טיפול ממוקד טראומה - SE/EMDR;מיניות',
    populations: 'מבוגרים',
    styleText: 'ניסיון לברר ולהמשיג את האיכויות והשאיפות המקצועיות של המודרך ולטפח אותם. כניסה לעומקים רגשיים של המודרך אך ורק ברשותו ובאופן שמתמקד ושייך לטיפולים שהביא להדרכה.',
    format: 'היברידי',
    area: 'ירושלים / כפר אלדד',
    hasSpot: true,
    maxStudents: 1,
    email: 'REDACTED@example.com',
    phone: '05XXXXXXXX'
  };

  ensureMaxStudentsColumn();
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = headers.indexOf('fullName');

  // Guard: refuse to create a duplicate
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nameCol]).trim() === rec.fullName) {
      var dup = 'ALREADY EXISTS: ' + rec.fullName + ' (row ' + (i + 1) + ') — aborting, no duplicate created.';
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
      case 'published': return false;        // DRAFT — she publishes herself
      case 'availability': return '{}';
      case 'whatsappEnabled': return false;  // she can enable in her profile
      case 'studentsAccepted': return 0;
      case 'mailed': return true;            // guard: never auto-bulk-mail this row
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

  var msg = 'CREATED: ' + rec.fullName + ' (row ' + newRowNum + ', DRAFT, email+phone set)';
  Logger.log(msg);
  return msg;
}

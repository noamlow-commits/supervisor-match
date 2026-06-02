/**
 * One-time updater — applies the extra details supervisors submitted in Tal's
 * Google Form (May 2026) onto their EXISTING cards in the Supervisors tab.
 *
 * Matching is by EXACT fullName as already stored in the sheet (verified against
 * the live roster on 2026-06-02), so spelling/title differences won't create
 * duplicates.
 *
 * Updated fields ONLY: credential, yearsSupervising, orientations, populations,
 * styleText, format, area, hasSpot, maxStudents (+ updated timestamp).
 * NEVER touched: token, email, phone, published, mailed, studentsAccepted, availability.
 *
 * maxStudents = the "how many supervisees can you take" number from the form.
 * It is ADMIN-ONLY: shown to Tal in admin.html, editable by the supervisor in
 * supervisor.html, and NEVER sent to students (absent from getSupervisors).
 *
 * Run from the Apps Script editor (Run ▸ applyFormUpdates2026). No redeploy needed —
 * this writes directly to the bound spreadsheet.
 *
 * Notes baked in (change here if you disagree):
 *   - נריה קרין: hasSpot=false  — wrote "כבר מדריכה 2, אקלוט רק אם יסיימו".
 *   - מני פולק:  create:true     — no existing card; creates a DRAFT (published=false)
 *                                  with phone 0545291780. Email still missing — add it
 *                                  before publishing / sending a claim mail.
 *   - Weekly-availability free text has NO structured field (it's a JSON grid the
 *     supervisor edits in the UI), so it is NOT written here. See the table Noam has
 *     for the values to enter manually.
 */
function applyFormUpdates2026() {
  var RECORDS = [
    {
      targetName: 'גבריאל פרץ',
      credential: 'פסיכולוג קליני מדריך',
      yearsSupervising: 25,
      orientations: 'דינאמי',
      populations: 'מבוגרים',
      styleText: `דיאלוג הדרכתי משמעו יצירת מרחב המאפשר למטפל/ת הנמצאים בהדרכה לעצב את עבודתם הטיפולים בהתאם לאישיותם, עצמיותם, מיומנתם וכישוריהם. החופש שנותן מרחב זה מאפשר ליצוק את התשתית לתהליך עיצוב זה.`,
      format: 'היברידי',
      area: 'מודיעין',
      hasSpot: true,
      maxStudents: 3
    },
    {
      targetName: 'נריה קרין',
      credential: 'עו״ס קלינית, פסיכואנליטיקאית (מכון ת״א)',
      yearsSupervising: 25,
      orientations: 'דינאמי',
      populations: 'מבוגרים',
      styleText: `הדרכה עבורי היא מרחב פסיכואנליטי בטוח ודיאלוגי המאפשר התבוננות מעמיקה ברובד המודע והלא מודע של המפגש הטיפולי והתהליכים המקבילים המתעוררים בו. מטרתה של הדרכה היא להצמיח את המטפל הייחודי תוך המשגה תיאורטית וקשב אמפתי לחוויה הרגשית לדיאלוג ולתהליך אותו עוברים המטופל והמודרך.`,
      format: 'היברידי',
      area: '',
      hasSpot: false,
      maxStudents: 2
    },
    {
      targetName: 'ד"ר נילי פויירשטיין',
      credential: 'דוקטור',
      yearsSupervising: 35,
      orientations: 'דינאמי',
      populations: 'מבוגרים',
      styleText: `גישה פסיכודינמית- דיאלוגית`,
      format: 'פרונטלי',
      area: 'משגב',
      hasSpot: true,
      maxStudents: 1
    },
    {
      targetName: 'ד"ר חגי סרי',
      credential: 'ד"ר פסיכולוג קליני',
      yearsSupervising: 4,
      orientations: 'דינאמי',
      populations: 'מבוגרים',
      styleText: `כמובן שהכל לפי הצורך, אך ע"פ רש"י בהעלותך - לשון עליה שצריך להדליק עד שתהא השלהבת עולה מאליה`,
      format: 'מקוון',
      area: 'כפר סבא',
      hasSpot: true,
      maxStudents: 2
    },
    {
      targetName: 'ד"ר קארן לרנר',
      credential: `דוקטוראט, האוניברסיטה העברית, החוג לפסיכולוגיה, 2002, אצל פרופ' מרדכי רוטנברג`,
      yearsSupervising: 30,
      orientations: 'טיפול ממוקד טראומה - SE/EMDR;טיפול זוגי',
      populations: 'מבוגרים;נוער;ילדים;זוגות;משפחות',
      styleText: `שיטות טיפול ממוקדות גוף, גישות הוליסטיות אינטגרטיביות מערכתיות`,
      format: 'מקוון',
      area: '',
      hasSpot: true,
      maxStudents: 5
    },
    {
      targetName: 'חנה יאיר בוריה',
      credential: 'עו"ס פסיכותרפיסטית מטפלת ומדריכה מוסמכת בטיפול זוגי ומשפחתי',
      yearsSupervising: 7,
      orientations: 'דינאמי;טיפול ממוקד טראומה - SE/EMDR;טיפול זוגי',
      populations: 'מבוגרים;זוגות;משפחות',
      styleText: `סגנון ההדרכה שלי נשען על מפגש דיאלוגי - מרחב שבו המודרך והמדריך פונים יחד אל הידע, מתוך סקרנות הדדית וחוסר שיפוטיות. אני מחזקת את הכוחות הקיימים ומזמינה לאתגר את המוכר, מתוך אמונה שהצמיחה המקצועית נולדת מתוך הנכונות לקחת סיכון ולפגוש את הלא-נודע. השאיפה להפוך את ההדרכה למפגש "אני אתה" שבו שני הצדדים יוצאים מעט שונים קודם למפגש.`,
      format: 'מקוון',
      area: '',
      hasSpot: true,
      maxStudents: 2
    },
    {
      targetName: 'מני פולק',
      create: true,                       // no existing card → create DRAFT
      credential: 'עו"ס קליני + פסיכותרפיסט (פסיכואנליטי)',
      yearsSupervising: '',               // left blank in form
      orientations: 'דינאמי;טיפול זוגי',
      populations: 'מבוגרים;זוגות',
      styleText: `לפתח את ההקשבה האנליטית והדיאלוגית, להבין מה קורה בחדר הטיפול ולפתח את האמנות של ההתערבות המקצועית.`,
      format: 'פרונטלי',
      area: 'קליניקה בקטמונים',
      hasSpot: false,
      maxStudents: 1,
      phone: '0545291780'   // email still missing — card stays a draft until added
    }
  ];

  var FIELDS = ['credential', 'yearsSupervising', 'orientations', 'populations',
                'styleText', 'format', 'area', 'hasSpot', 'maxStudents'];

  ensureMaxStudentsColumn();              // make sure the admin-only capacity column exists
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var nameToRow = {};
  for (var i = 1; i < data.length; i++) {
    nameToRow[String(data[i][col.fullName]).trim()] = i + 1; // 1-based sheet row
  }

  var now = new Date().toISOString();
  var report = [];

  RECORDS.forEach(function (rec) {
    var rowNum = nameToRow[rec.targetName];

    if (rowNum) {
      FIELDS.forEach(function (f) {
        if (rec[f] === undefined) return;
        if (col[f] === undefined) return;
        sheet.getRange(rowNum, col[f] + 1).setValue(rec[f]);
      });
      if (col.updated !== undefined) sheet.getRange(rowNum, col.updated + 1).setValue(now);
      report.push('UPDATED  : ' + rec.targetName);

    } else if (rec.create) {
      var newRow = headers.map(function (h) {
        switch (h) {
          case 'token': return generateToken();
          case 'created': return now;
          case 'updated': return now;
          case 'published': return false;       // DRAFT — not student-visible
          case 'fullName': return rec.targetName;
          case 'availability': return '{}';
          case 'whatsappEnabled': return false;
          case 'studentsAccepted': return 0;
          case 'mailed': return true;            // guard: never auto-mail this draft
          default: return (rec[h] !== undefined ? rec[h] : '');
        }
      });
      sheet.appendRow(newRow);

      // Preserve leading zero on the phone (Sheets would otherwise coerce to a Number)
      var newRowNum = sheet.getLastRow();
      var phoneCol = headers.indexOf('phone');
      if (phoneCol >= 0 && rec.phone) {
        var pcell = sheet.getRange(newRowNum, phoneCol + 1);
        pcell.setNumberFormat('@');
        pcell.setValue(String(rec.phone));
      }

      report.push('CREATED DRAFT (⚠ no email yet) : ' + rec.targetName);

    } else {
      report.push('NOT FOUND, skipped : ' + rec.targetName);
    }
  });

  var msg = report.join('\n');
  Logger.log(msg);
  return msg;
}

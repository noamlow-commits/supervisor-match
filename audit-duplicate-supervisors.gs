/**
 * READ-ONLY audit — finds duplicate supervisor rows. Writes nothing, ever.
 *
 * Built 2026-08-02 after ד"ר ברוך כהנא turned up twice in the live directory.
 * Before deleting anything you need to see every row, including the drafts that
 * getSupervisors hides (it returns published rows only), and you need to know
 * which row students are actually looking at and which one has students placed
 * against its token.
 *
 * Groups rows that share a normalized fullName, email, or phone — any one of the
 * three is enough to be suspicious, because a hand-added duplicate rarely matches
 * on all three (different spacing in the name, a phone with dashes vs without).
 *
 * For each row it reports: sheet row number, token, published, hasSpot, how many
 * students are placed with it, how many profile fields are actually filled, and
 * a suggested keeper — the row with the most filled fields, with placed students
 * breaking a tie (deleting a row that students point at orphans them).
 *
 * The suggestion is a suggestion. Read the output and decide.
 *
 * Run from the Apps Script editor (Run ▸ auditDuplicateSupervisors).
 */
function auditDuplicateSupervisors() {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var placed = placedCountsByToken();

  // Fields that carry real profile content — used to score "how complete is this row".
  var CONTENT = ['fullName', 'credential', 'yearsSupervising', 'orientations', 'populations',
                 'styleText', 'format', 'area', 'phone', 'email', 'maxStudents'];

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!String(r[col.fullName] || '').trim() && !String(r[col.email] || '').trim() &&
        !String(r[col.phone] || '').trim()) continue;   // wholly empty row

    var filled = 0;
    CONTENT.forEach(function (f) {
      if (col[f] !== undefined && String(r[col[f]] == null ? '' : r[col[f]]).trim() !== '') filled++;
    });

    var token = col.token === undefined ? '' : String(r[col.token] || '').trim();
    rows.push({
      rowNum: i + 1,
      name: String(r[col.fullName] || '').trim(),
      nameKey: auditNormName_(r[col.fullName]),
      email: String(r[col.email] || '').trim().toLowerCase(),
      phoneKey: auditNormPhone_(r[col.phone]),
      token: token,
      published: r[col.published] === true || String(r[col.published]).toUpperCase() === 'TRUE',
      hasSpot: r[col.hasSpot] === true || String(r[col.hasSpot]).toUpperCase() === 'TRUE',
      students: placed[token] || 0,
      filled: filled
    });
  }

  // Union-find style grouping on any shared key.
  var groups = [];
  rows.forEach(function (row) {
    var target = null;
    for (var g = 0; g < groups.length && !target; g++) {
      for (var m = 0; m < groups[g].length; m++) {
        var o = groups[g][m];
        if ((row.nameKey && row.nameKey === o.nameKey) ||
            (row.email && row.email === o.email) ||
            (row.phoneKey && row.phoneKey === o.phoneKey)) { target = groups[g]; break; }
      }
    }
    if (target) target.push(row); else groups.push([row]);
  });

  var dups = groups.filter(function (g) { return g.length > 1; });

  var out = ['=== בדיקת כפילויות — קריאה בלבד, לא נכתב כלום ==='];
  out.push('סה"כ שורות מדריכים: ' + rows.length);
  out.push('');

  if (!dups.length) {
    out.push('לא נמצאו כפילויות.');
  } else {
    out.push('נמצאו ' + dups.length + ' קבוצות חשודות:');
    dups.forEach(function (g, gi) {
      // suggested keeper: most filled fields; a row with placed students always wins
      var keeper = g.slice().sort(function (a, b) {
        if ((b.students > 0) !== (a.students > 0)) return b.students - a.students;
        if (b.filled !== a.filled) return b.filled - a.filled;
        return a.rowNum - b.rowNum;
      })[0];

      out.push('');
      out.push('── קבוצה ' + (gi + 1) + ': ' + (g[0].name || '(ללא שם)') + ' ──');
      g.forEach(function (r) {
        out.push('  שורה ' + r.rowNum + (r.rowNum === keeper.rowNum ? '  ⭐ מוצע לשמור' : '  ← מועמד להסרה'));
        out.push('     שם: ' + (r.name || '(ריק)') + '  |  מייל: ' + (r.email || '(ריק)') + '  |  טלפון: ' + (r.phoneKey || '(ריק)'));
        out.push('     מפורסם: ' + (r.published ? 'כן' : 'לא') +
                 '  |  מקום פנוי: ' + (r.hasSpot ? 'כן' : 'לא') +
                 '  |  שדות מלאים: ' + r.filled + '/' + CONTENT.length +
                 '  |  תלמידים משובצים: ' + r.students);
        out.push('     טוקן: ' + (r.token || '(ריק)'));
        if (r.students > 0) {
          out.push('     ⚠ יש תלמידים שמשובצים לשורה הזאת — מחיקה תשאיר אותם מיותמים.');
        }
        if (r.published && r.hasSpot) {
          out.push('     ← זו השורה שהסטודנטים רואים כרגע.');
        }
      });
    });
    out.push('');
    out.push('שים לב: "מוצע לשמור" = הכי הרבה שדות מלאים, ושורה עם תלמידים משובצים תמיד מנצחת.');
    out.push('זו הצעה בלבד. תקרא ותחליט.');
  }

  var report = out.join('\n');
  Logger.log(report);
  return report;
}

// Name key: drop titles, quote variants, bidi marks and extra spaces.
function auditNormName_(v) {
  return String(v == null ? '' : v)
    .replace(/[‎‏⁦-⁩]/g, '')
    .replace(/["'״׳`]/g, '')
    .replace(/^\s*(ד\s*ר|דר|פרופ|מר|גב)\s*\.?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Phone key: reduce every written form to local 05XXXXXXXX so "05XXXXXXXX",
// "⁦05XXXXXXXX⁩" and 507448901 all collapse to one value.
function auditNormPhone_(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('972') === 0) d = '0' + d.substring(3);
  else if (d.charAt(0) !== '0') d = '0' + d;
  return d;
}

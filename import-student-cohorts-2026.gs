/**
 * חד-פעמי — שיוך מחזור לתלמידי הדיאלוגי הקיימים ברשימה.
 *
 * הרקע: טל ביקשה (19.8.26) לראות אילו תלמידים נמצאים בכל שנה. הקוד מאחסן
 * את המחזור ולא את השנה — המחזור קבוע, השנה נגזרת ממנו בלשונית Cohorts —
 * ולכן מה שצריך למלא לתלמידים הקיימים הוא המחזור.
 *
 * מקור הנתונים: הגיליון "כל התוכניות 2026-2027" של טל
 * (1aOC9sxUJt_O_f6v1EoxglQI7jUF3l3mMew5czeQAkzY), שלוש לשוניות הדיאלוגי:
 *   מחזור ג = שנה א  ·  מחזור ב = שנה ב  ·  מחזור א = שנה ג
 * נסונן: שורות תבנית (טקסטים שטל שולחת למתעניינים) הוסרו — נשמרה שורה
 * רק אם יש בה טלפון או מייל. 'כח הצמצום' לא נכלל בכוונה (החלטת נועם).
 *
 * שימוש — שני שלבים, כמו ב-import-supervisor-phones-2026.gs:
 *   1. Run ▸ previewStudentCohorts2026   — רק מדפיס, לא כותב כלום
 *   2. Run ▸ importStudentCohorts2026    — כותב
 *
 * בטוח להריץ שוב: מי שכבר משויך נכון מדווח ALREADY ולא נכתב מחדש.
 * מחזור שונה מהקיים מדווח CONFLICT ו-*לעולם לא* נדרס בשקט.
 */

// ⚠ רשימת השמות הוסרה מהריפו (19.8.26). הריפו הזה ציבורי, ו-60 שמות של
// תלמידי בית ספר לפסיכותרפיה עם שנת הלימוד שלהם הם מידע אישי מזהה.
// הסקריפט כבר רץ בהצלחה (36 מתוך 36 שויכו, מאומת מול הגיליון החי),
// ומה שנשמר כאן הוא הלוגיקה — היא זו שתידרש שוב בשנה הבאה, לא הנתונים.
//
// לשחזור הרשימה כשצריך: לקרוא את שלוש לשוניות הדיאלוגי מתוך
// "כל התוכניות 2026-2027" (1aOC9sxUJt_O_f6v1EoxglQI7jUF3l3mMew5czeQAkzY),
// לסנן שורות-תבנית בדרישה שיהיה בשורה טלפון או מייל, ולמפות:
//   מחזור ג = שנה א · מחזור ב = שנה ב · מחזור א = שנה ג
// ואז למלא כאן {name:..., email:..., cohort:...} ולהריץ preview לפני import.
var DIALOGI_COHORTS_2026 = [
  // {name:'', email:'', cohort:''}
];

/** משווה שמות בסובלנות: רווחים כפולים, תארים, וסדר שם-משפחה הפוך. */
function normName_(s) {
  return String(s || '')
    .replace(/["'׳״]/g, '')
    .replace(/\b(ד"ר|דר|פרופ|מר|גב|הרב)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function nameKeySorted_(s) {
  return normName_(s).split(' ').filter(Boolean).sort().join(' ');
}

function previewStudentCohorts2026() { runStudentCohorts_(false); }
function importStudentCohorts2026() { runStudentCohorts_(true); }

function runStudentCohorts_(doWrite) {
  ensureStudentCohortColumns();
  getOrCreateCohortsSheet();            // זורע את מיפוי מחזור→שנה אם עוד לא קיים

  var sheet = getOrCreateStudentsSheet();
  var values = sheet.getDataRange().getValues();
  var h = values[0];
  var cName = h.indexOf('fullName'), cMail = h.indexOf('email');
  var cCoh = h.indexOf('cohort'), cProg = h.indexOf('program');
  if (cName < 0 || cCoh < 0 || cProg < 0) { Logger.log('ABORT: חסרות עמודות בלשונית Students'); return; }

  // אינדקסים מהמקור
  var byName = {}, bySorted = {}, byMail = {};
  DIALOGI_COHORTS_2026.forEach(function (r) {
    byName[normName_(r.name)] = r;
    bySorted[nameKeySorted_(r.name)] = r;
    if (r.email) byMail[r.email.toLowerCase()] = r;
  });

  var set = [], already = [], conflict = [], notFound = [], matchedSrc = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var nm = String(row[cName] || '').trim();
    if (!nm) continue;
    var mail = String(row[cMail] || '').trim().toLowerCase();
    var cur = String(row[cCoh] || '').trim();

    // סדר ההתאמה: שם מדויק → שם עם סדר מילים חופשי → מייל.
    // המייל אחרון בכוונה — בגיליון של טל יש כמה כתובות לא מעודכנות.
    var hit = byName[normName_(nm)] || bySorted[nameKeySorted_(nm)] || (mail ? byMail[mail] : null);
    if (!hit) { notFound.push(nm); continue; }
    matchedSrc[hit.name] = true;

    if (cur && cur !== hit.cohort) { conflict.push(nm + ': בגיליון "' + cur + '" ובמקור "' + hit.cohort + '" — לא נכתב'); continue; }
    if (cur === hit.cohort) { already.push(nm + ' (' + cur + ')'); continue; }

    set.push(nm + ' → מחזור ' + hit.cohort);
    if (doWrite) {
      sheet.getRange(i + 1, cCoh + 1).setValue(hit.cohort);
      sheet.getRange(i + 1, cProg + 1).setValue('הדיאלוגי');
    }
  }

  var srcUnused = DIALOGI_COHORTS_2026.filter(function (r) { return !matchedSrc[r.name]; }).map(function (r) { return r.name + ' (' + r.cohort + ')'; });

  Logger.log((doWrite ? '=== כתיבה ===' : '=== תצוגה מקדימה — לא נכתב כלום ==='));
  Logger.log('לשיוך: ' + set.length);           set.forEach(function (x) { Logger.log('  + ' + x); });
  Logger.log('כבר משויכים נכון: ' + already.length);
  Logger.log('סתירות: ' + conflict.length);      conflict.forEach(function (x) { Logger.log('  ! ' + x); });
  Logger.log('ברשימה אך לא במקור: ' + notFound.length); notFound.forEach(function (x) { Logger.log('  ? ' + x); });
  Logger.log('במקור אך לא ברשימה: ' + srcUnused.length + '  (לא נוצרים תלמידים חדשים — רק דיווח)');
  srcUnused.forEach(function (x) { Logger.log('  - ' + x); });
}

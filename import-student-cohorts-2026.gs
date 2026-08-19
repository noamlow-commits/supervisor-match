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

var DIALOGI_COHORTS_2026 = [
  {name:'אורנה ביטון', email:'or400949@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אליאב פרידמן', email:'', cohort:'ג'},  // שנה 1
  {name:'אלינה וויילד', email:'', cohort:'ג'},  // שנה 1
  {name:'אלינור לאונורה חסידוב', email:'linori15@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אסף ברלינר', email:'azberliner@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אסתר נעמה פרידלנד', email:'tushtush77@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אריאל אנסבכר', email:'arielansba@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אריאלה סדון', email:'6739568@gmail.com', cohort:'ג'},  // שנה 1
  {name:'אריאלה פינטו לוי', email:'', cohort:'ג'},  // שנה 1
  {name:'בתאל עידו', email:'', cohort:'ג'},  // שנה 1
  {name:'גפן מנדלסון', email:'gefen5756@gmail.com', cohort:'ג'},  // שנה 1
  {name:'דורית לוי', email:'dorit11129@gmail.com', cohort:'ג'},  // שנה 1
  {name:'חגית כהן', email:'hagitgy@gmail.com', cohort:'ג'},  // שנה 1
  {name:'יפעת', email:'', cohort:'ג'},  // שנה 1
  {name:'לוטם כהן', email:'ayelo02@gmail.com', cohort:'ג'},  // שנה 1
  {name:'מיה הוד רן', email:'', cohort:'ג'},  // שנה 1
  {name:'מיטל אלקינס', email:'', cohort:'ג'},  // שנה 1
  {name:'מירב יפרח בן שושן', email:'meravifrach39@gmail.com', cohort:'ג'},  // שנה 1
  {name:'נעמה לדאני קאופמן', email:'naamakofman@gmail.com', cohort:'ג'},  // שנה 1
  {name:'ענבר צייג', email:'inbart76@gmail.com', cohort:'ג'},  // שנה 1
  {name:'פאני וקנין', email:'fannyvak55@gmail.com', cohort:'ג'},  // שנה 1
  {name:'צביה אדרעי', email:'tzvia909@gmail.com', cohort:'ג'},  // שנה 1
  {name:'קרן מריות', email:'kmerayot@gmail.com', cohort:'ג'},  // שנה 1
  {name:'רויטל כהן', email:'revitalcohen@yahoo.com', cohort:'ג'},  // שנה 1
  {name:'רונן לוי', email:'', cohort:'ג'},  // שנה 1
  {name:'רונן לוי בינת הלב', email:'ronenlevy1118@gmail.com', cohort:'ג'},  // שנה 1
  {name:'רחל גרינוולד', email:'ragr68@gmail.com', cohort:'ג'},  // שנה 1
  {name:'רעות כהן', email:'reuti19000@gmail.com', cohort:'ג'},  // שנה 1
  {name:'שמעון', email:'', cohort:'ג'},  // שנה 1
  {name:'אביטל ביטון', email:'ambt111@gmail.com', cohort:'ב'},  // שנה 2
  {name:'אמיר ביטון', email:'ambt111@gmail.com', cohort:'ב'},  // שנה 2
  {name:'הודיה לשם', email:'leshemhi@gmail.com', cohort:'ב'},  // שנה 2
  {name:'חיה הרשקוביץ הרפז', email:'chaya.harpaz@gmail.com', cohort:'ב'},  // שנה 2
  {name:'יעל לשם', email:'ahavatim.yael@gmail.com', cohort:'ב'},  // שנה 2
  {name:'יעקב בן סימון', email:'bensimon2@gmail.com', cohort:'ב'},  // שנה 2
  {name:'כלילה קלמן', email:'klilaruthhome@gmail.com', cohort:'ב'},  // שנה 2
  {name:'לבנת וידר', email:'livnatw22@gmail.com', cohort:'ב'},  // שנה 2
  {name:'נחמה גולדברג', email:'nechgold123@gmail.com', cohort:'ב'},  // שנה 2
  {name:'נטליה זלצרמן', email:'nataliaadrian2608@gmail.com', cohort:'ב'},  // שנה 2
  {name:'עדי כרפס', email:'adikarpas@gmail.com', cohort:'ב'},  // שנה 2
  {name:'פועה פלמר קפאח', email:'puahperetz@gmail.com', cohort:'ב'},  // שנה 2
  {name:'צביאל סולומון', email:'tzviel@gmail.com', cohort:'ב'},  // שנה 2
  {name:'קטיה יוספי', email:'katya@kidumpro.co.il', cohort:'ב'},  // שנה 2
  {name:'שירה הללי', email:'shira.niazov@gmail.com', cohort:'ב'},  // שנה 2
  {name:'גבריאלה שפרנוב', email:'gabinka_art@yahoo.com', cohort:'א'},  // שנה 3
  {name:'גורביץ מאשה', email:'elimasha@gmail.com', cohort:'א'},  // שנה 3
  {name:'וינטר שושנה', email:'shoshwinter@gmail.com', cohort:'א'},  // שנה 3
  {name:'וקסלר סילבינה', email:'silvinon@hotmail.com', cohort:'א'},  // שנה 3
  {name:'חגית זליס', email:'hagitznoar@gmail.com', cohort:'א'},  // שנה 3
  {name:'טובי אייזק- רכזת בין אישית', email:'tovi12@gmail.com', cohort:'א'},  // שנה 3
  {name:'יפעת יהל אזולאי', email:'hoelhashem@gmail.com', cohort:'א'},  // שנה 3
  {name:'לינדה ביתן כהן', email:'lindacohen241@gmail.com', cohort:'א'},  // שנה 3
  {name:'מיכל בירנדורף', email:'michalbirndorf@gmail.com', cohort:'א'},  // שנה 3
  {name:'מיכל שיינברגר', email:'mscheinbergr@gmail.com', cohort:'א'},  // שנה 3
  {name:'מיכל שלמה בר', email:'michalbodcker@gmail.com', cohort:'א'},  // שנה 3
  {name:'נועה פורת', email:'noaporat6@gmail.com', cohort:'א'},  // שנה 3
  {name:'נעמי שחטר', email:'neomishe@gmail.com', cohort:'א'},  // שנה 3
  {name:'עטרת ווזנר', email:'atifach@gmail.com', cohort:'א'},  // שנה 3
  {name:'עפרה שופר סימון', email:'ofrashofar@gmail.com', cohort:'א'},  // שנה 3
  {name:'שלומית אדלר', email:'shlomitadler@gmail.com', cohort:'א'},  // שנה 3
];

/** משווה שמות בסובלנות: רווחים כפולים, תארים, וסדר שם-משפחה הפוך. */
function normName_(s) {
  return String(s || '')
    .replace(/["'׳״]/g, '')
    .replace(/(ד"ר|דר|פרופ|מר|גב|הרב).?/g, '')
    .replace(/s+/g, ' ')
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

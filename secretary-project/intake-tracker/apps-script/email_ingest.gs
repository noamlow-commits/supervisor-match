/**
 * email_ingest.gs — קליטת פניות-הרשמה מ-Gmail → App DB. חלק מפרויקט האפליקציה.
 *
 * רץ תחת חשבון האפליקציה (merkazrotenbergkh) וקורא את ה-Gmail של עצמו. טריגר מתוזמן
 * בענן — אין תלות במחשב דלוק. מיילי "הודעה על רישום" (Amax/ג'אפא) מועברים (forward)
 * אל תיבת האפליקציה; כאן מפענחים את גוף ההודעה ויוצרים "פנייה חדשה".
 *
 * דה-דופ לפי **קוד לקוח / טלפון** (ללא תלות בתוכנית — Amax לא יודע תוכנית; התוכנית
 * נשארת ריקה לשיוך ע"י טל). משתמש בעוזרי האפליקציה (lineForSheet_ וכו') — אפס כפילות קוד.
 *
 * הקמה (פעם אחת):
 *   1. הדבק קובץ זה לפרויקט האפליקציה → שמור. (אין צורך ב-redeploy — אינו קוד web.)
 *   2. הרץ testIngestOnce → אישור הרשאת Gmail → בדוק שורה ב-App DB + שהמייל קיבל תווית.
 *   3. הרץ installEmailIngestTrigger (טריגר שעתי).
 *   4. הגדר forward של מיילי ההרשמה → merkazrotenbergkh@gmail.com (חשבון האפליקציה).
 */

var INGEST_LABEL = 'נקלט-לאפליקציה';
// אופציונלי: אם מגדירים בתיבת האפליקציה פילטר Gmail שמתייג מיילי-הרשמה בתווית ייעודית
// (מומלץ — התיבה מקבלת סוגי מייל רבים), שימו כאן את שם התווית והקליטה תוגבל אליה בלבד.
// משאירים ריק → זיהוי לפי תוכן ("הודעה על רישום") בלבד.
var INGEST_SOURCE_LABEL = '';   // למשל 'הרשמות-amax'

// זיהוי דו-שכבתי: (1) חיפוש לפי תוכן/תווית-מקור; (2) הפענוח עצמו מאמת שזו באמת
// הודעת-רישום (יש "הודעה על רישום" + קוד לקוח/טלפון/מייל), אז מיילים אחרים נדחים.
function ingestQuery_(){
  var base = INGEST_SOURCE_LABEL
    ? 'label:"' + INGEST_SOURCE_LABEL + '"'
    : '"הודעה על רישום"';        // ביטוי ייחודי להודעות הרישום של Amax (גם בהעברה)
  return base + ' -label:"' + INGEST_LABEL + '"';
}

function ingestRegistrationEmails(){ return doIngest_(false); }
// חד-פעמי לתיקון: מעבד גם מיילים מתויגים (יוצר רשומות שלא נוצרו, למשל בגלל כוכביות בהעברה).
// הדה-דופ לפי קוד/טלפון מונע כפילות של רשומות שכבר קיימות.
function reingestRegistrations(){ return doIngest_(true); }

function doIngest_(includeProcessed){
  var label = GmailApp.getUserLabelByName(INGEST_LABEL) || GmailApp.createLabel(INGEST_LABEL);
  var q = INGEST_SOURCE_LABEL ? 'label:"' + INGEST_SOURCE_LABEL + '"' : '"הודעה על רישום"';
  if (!includeProcessed) q += ' -label:"' + INGEST_LABEL + '"';
  var threads = GmailApp.search(q, 0, 50);
  if (!threads.length){ Logger.log('אין מיילים לקליטה.'); return {added:0, dup:0}; }

  ensureColumns_();
  var sh = inquiriesSheet_();
  // אינדקס דה-דופ: קוד לקוח + טלפון מכל הרשומות הקיימות
  var seenCrm = {}, seenPhone = {};
  readInquiries_().forEach(function(o){
    var c = String(o.crmCode || '').trim(); if (c) seenCrm[c] = 1;
    var p = cleanPhone_(o.phone); if (p) seenPhone[p] = 1;
  });

  var added = 0, dup = 0;
  threads.forEach(function(t){
    t.getMessages().forEach(function(m){
      var text = msgText_(m);
      // התוכנית מקודדת בכותרת המייל (נושא ה-Amax). מנסים גם את כותרת ה-Gmail וגם
      // את שורת "Subject:" שבגוף (במייל מועבר). אם לא זוהתה → ריק (לשיוך ע"י טל).
      var subj = String(m.getSubject() || '') + ' ' + ((text.match(/Subject:\s*([^\n\r]+)/) || [])[1] || '');
      var prog = programFromSubject_(subj);
      // תאריך הפנייה המקורי (שורת Date של Amax, YYYY-MM-DD) — לדיוק דוח-פרסום; אחרת תאריך המייל.
      var origDate = (text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || fmtDate_(m.getDate());
      parseRegistrations_(text).forEach(function(rec){
        // שכבת-אימות 2: רשומה אמיתית רק אם יש מזהה-קשר (קוד לקוח / טלפון / מייל) — דוחה מיילים אחרים
        if (!rec.crmCode && !rec.phone && !rec.email) return;
        var isDup = (rec.crmCode && seenCrm[rec.crmCode]) || (rec.phone && seenPhone[cleanPhone_(rec.phone)]);
        if (isDup){ dup++; return; }
        var o = {
          id: 'E' + Utilities.getUuid().slice(0, 8),
          recordType: 'פנייה',
          program: prog,                     // מזוהה מכותרת המייל (ריק אם לא זוהה → לשיוך ע"י טל)
          cycle: rec.cycle || '',
          inquiryDate: origDate,
          stageSince: origDate,
          channel: 'אתר',
          crmCode: rec.crmCode || '',
          name: rec.name || '',
          phone: rec.phone || '',
          email: rec.email || '',
          status: 'פנייה חדשה',
          source: 'amax',
          updatedAt: todayStr_()
        };
        computeRow_(o);
        sh.appendRow(lineForSheet_(sh, o));
        // אפס מוביל בטלפון
        var ph = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].indexOf('טלפון');
        if (ph >= 0 && o.phone){ var cell = sh.getRange(sh.getLastRow(), ph+1); cell.setNumberFormat('@'); cell.setValue(String(o.phone)); }
        if (rec.crmCode) seenCrm[rec.crmCode] = 1;
        if (rec.phone) seenPhone[cleanPhone_(rec.phone)] = 1;
        added++;
      });
    });
    t.addLabel(label);   // מסומן כנקלט — לא ייקלט שוב
  });

  Logger.log('נקלטו ' + added + ' פניות חדשות, דולגו ' + dup + ' כפילויות.');
  return {added:added, dup:dup};
}

// פענוח גוף המייל → רשומות. תומך בכמה "הודעה על רישום" באותו מייל.
function parseRegistrations_(body){
  if (!body) return [];
  // מסירים כוכביות (bold של Gmail בהעברה) שמפרקות את התוויות, למשל "*קוד לקוח* :206816".
  var segments = String(body).replace(/\*/g, ' ').split(/הודעה על רישום/);
  var out = [];
  for (var i = 1; i < segments.length; i++){      // [0] = לפני ההודעה הראשונה
    var seg = segments[i];
    var rec = {
      crmCode: ingestGrab_(seg, /קוד\s*לקוח\s*:?\s*(\d{3,})/),
      email:   ingestGrab_(seg, /דואר\s*אלקטרוני\s*:?\s*([^\s]+@[^\s]+)/),
      phone:   ingestGrab_(seg, /טלפון\s*:?\s*([0-9\-\+]{7,})/),
      cycle:   ingestGrab_(seg, /(תשפ.?[א-ת])/),
      name: ''
    };
    var lines = seg.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(String);
    for (var j = 0; j < lines.length; j++){
      var l = lines[j];
      if (l.indexOf(':') >= 0) continue;                                  // תווית
      if (/^(Subject|Date|From|To|Links|----|\[|https?:)/i.test(l)) continue;  // כותרות-העברה
      rec.name = l; break;
    }
    out.push(rec);
  }
  return out;
}
function ingestGrab_(s, re){ var m = String(s || '').match(re); return m ? m[1].trim() : ''; }

// מיפוי כותרת-המייל (נושא ה-Amax) → תוכנית קנונית. ⚠️ לעדכן לפי הכותרות האמיתיות של כל טופס Amax.
// נצפו: "מתענייני פסיכותרפיה" (= הדיאלוגי, להערכתי). מחזיר '' אם לא זוהה → טל משייכת.
function programFromSubject_(s){
  s = String(s || '');
  if (/פסיכותרפי|דיאלוג|הדיאלוגי/.test(s))            return 'הדיאלוגי';
  if (/צמצום|תעוד|תהוד|מתעניינים\s*תשפ/.test(s))      return 'תעודה';   // טופס כוח הצמצום: "מתעניינים תשפ״ד"
  if (/אח["׳׳']?ד|תוכנית אח/.test(s))                 return 'אח"ד';
  return '';
}

// טקסט המייל: גוף רגיל; אם ריק (מייל HTML בלבד) → המרת ה-HTML לטקסט.
function msgText_(m){
  var t = m.getPlainBody() || '';
  if (t.trim()) return t;
  var html = m.getBody() || '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ');
}

// חד-פעמי: משייך תוכנית (מהכותרת) לפניות שכבר נקלטו עם תוכנית ריקה (אריאל/צביה וכו').
// קורא גם מיילים מתויגים; מעדכן רק רשומות שתוכניתן ריקה. בטוח להריץ שוב.
function backfillProgramFromSubject(){
  ensureColumns_();
  var sh = inquiriesSheet_();
  var rows = readInquiries_();
  var byCrm = {}, byPhone = {};
  rows.forEach(function(o){ var c=String(o.crmCode||'').trim(); if(c) byCrm[c]=o; var p=cleanPhone_(o.phone); if(p) byPhone[p]=o; });
  var threads = GmailApp.search('"הודעה על רישום" OR from:amax.co.il', 0, 50);
  var updated = 0;
  threads.forEach(function(t){
    t.getMessages().forEach(function(m){
      var text = msgText_(m);
      var subj = String(m.getSubject() || '') + ' ' + ((text.match(/Subject:\s*([^\n\r]+)/) || [])[1] || '');
      var prog = programFromSubject_(subj);
      if (!prog) return;
      parseRegistrations_(text).forEach(function(rec){
        var o = (rec.crmCode && byCrm[rec.crmCode]) || (rec.phone && byPhone[cleanPhone_(rec.phone)]);
        if (o && !String(o.program || '').trim()){ o.program = prog; writeRow_(sh, o._row, o); updated++; }
      });
    });
  });
  Logger.log('עודכנו ' + updated + ' פניות עם תוכנית מהכותרת.');
  return {updated:updated};
}

// אבחון: מדפיס ביומן את רשומות ה-amax הקיימות + מה שחולץ מכל מייל הרשמה.
function diagBackfill(){
  var rows = readInquiries_();
  var amax = rows.filter(function(o){ return String(o.source) === 'amax'; });
  Logger.log('סהכ רשומות: ' + rows.length + ' | מתוכן amax: ' + amax.length);
  amax.forEach(function(o){ Logger.log('  רשומה: ' + o.name + ' | crm=' + o.crmCode + ' | phone=' + o.phone + ' | program="' + o.program + '"'); });
  var threads = GmailApp.search('"הודעה על רישום" OR from:amax.co.il', 0, 50);
  Logger.log('מיילי הרשמה: ' + threads.length + ' threads');
  threads.forEach(function(t){ t.getMessages().forEach(function(m){
    var text = msgText_(m);
    var subj = String(m.getSubject() || '') + ' ' + ((text.match(/Subject:\s*([^\n\r]+)/) || [])[1] || '');
    var prog = programFromSubject_(subj);
    var recs = parseRegistrations_(text);
    Logger.log('  מייל: "' + m.getSubject() + '" → prog="' + prog + '" | חולצו ' + recs.length + ': ' + recs.map(function(r){ return r.name + '/' + r.crmCode + '/' + r.phone; }).join(' ; '));
  }); });
}

// ── לוח-זמנים מתוזמן (פניות + תשלומים) ─────────────────────────
// כל 10 דק' ב-8:00–12:00 וב-18:00–20:30 (שעות העומס של טל); אחרת ~שעתי.
function scheduledIngest(){
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var h = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  var m = parseInt(Utilities.formatDate(now, tz, 'm'), 10);
  var morning = (h >= 8 && h < 12);
  var evening = (h === 18 || h === 19 || (h === 20 && m <= 30));
  if (!(morning || evening || m < 10)) return;   // מחוץ לחלונות → רק בראש השעה
  try { ingestRegistrationEmails(); } catch (e) { Logger.log('שגיאת קליטת פניות: ' + e); }
  try { if (typeof ingestCardcomReceipts === 'function') ingestCardcomReceipts(); } catch (e) { Logger.log('שגיאת קליטת תשלומים: ' + e); }
}

// מתקין את לוח-הזמנים (מחליף טריגרים קודמים). הריצו פעם אחת.
function installSchedule(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (['scheduledIngest','ingestRegistrationEmails','ingestCardcomReceipts'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scheduledIngest').timeBased().everyMinutes(10).create();
  Logger.log('✅ לוח-זמנים הותקן: כל 10 דק׳ ב-8:00–12:00 וב-18:00–20:30, אחרת שעתי (פניות + תשלומים).');
}

// ── הרצה ידנית ─────────────────────────────────────────────────
function testIngestOnce(){ return ingestRegistrationEmails(); }

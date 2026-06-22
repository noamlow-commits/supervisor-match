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

function ingestRegistrationEmails(){
  var label = GmailApp.getUserLabelByName(INGEST_LABEL) || GmailApp.createLabel(INGEST_LABEL);
  var threads = GmailApp.search(ingestQuery_(), 0, 50);
  if (!threads.length){ Logger.log('אין מיילים חדשים לקליטה.'); return {added:0, dup:0}; }

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
      parseRegistrations_(m.getPlainBody()).forEach(function(rec){
        // שכבת-אימות 2: רשומה אמיתית רק אם יש מזהה-קשר (קוד לקוח / טלפון / מייל) — דוחה מיילים אחרים
        if (!rec.crmCode && !rec.phone && !rec.email) return;
        var isDup = (rec.crmCode && seenCrm[rec.crmCode]) || (rec.phone && seenPhone[cleanPhone_(rec.phone)]);
        if (isDup){ dup++; return; }
        var o = {
          id: 'E' + Utilities.getUuid().slice(0, 8),
          recordType: 'פנייה',
          program: '',                       // ללא תוכנית — לשיוך ע"י טל
          cycle: rec.cycle || '',
          inquiryDate: fmtDate_(m.getDate()),
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
  var segments = String(body).split(/הודעה על רישום/);
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

// ── הרצה/התקנה ידנית ───────────────────────────────────────────
function testIngestOnce(){ return ingestRegistrationEmails(); }
function installEmailIngestTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'ingestRegistrationEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ingestRegistrationEmails').timeBased().everyHours(1).create();
  Logger.log('✅ טריגר קליטה הותקן — כל שעה.');
}

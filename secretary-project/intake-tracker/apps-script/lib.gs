/**
 * lib.gs — שירותי ליבה: גישה ל-App DB, נרמול, חישוב שלב/פעולה/תזכורת.
 * משותף לכל שאר הקבצים.
 */

// מזהה ה-App DB (מסד-האב). מקור-אמת = Script Properties, כדי שהדבקת config מחדש
// לא תאבד את המצביע. נפילה-לאחור ל-APP_DB_ID שב-config (תאימות).
function getAppDbId_(){
  var p = PropertiesService.getScriptProperties().getProperty('APP_DB_ID');
  return p || APP_DB_ID || '';
}
function setAppDbId_(id){
  if (id) PropertiesService.getScriptProperties().setProperty('APP_DB_ID', id);
}
// חד-פעמי: מעתיק את APP_DB_ID מ-config.gs ל-Script Properties (הריצו פעם אחת מהעורך).
function saveAppDbIdToProperties(){
  if (!APP_DB_ID) { Logger.log('APP_DB_ID ריק ב-config — אין מה לשמור'); return; }
  setAppDbId_(APP_DB_ID);
  Logger.log('✅ APP_DB_ID נשמר ב-Script Properties: ' + APP_DB_ID);
}

function getAppDb_(){
  var id = getAppDbId_();
  if (!id) throw new Error('APP_DB_ID ריק — הריצו setup() (או saveAppDbIdToProperties) תחילה');
  return SpreadsheetApp.openById(id);
}

function inquiriesSheet_(){
  var sh = getAppDb_().getSheetByName(SHEET_INQUIRIES);
  if (!sh) throw new Error('לשונית "' + SHEET_INQUIRIES + '" לא נמצאה. הריצו setup().');
  return sh;
}

// קריאת כל הפניות כמערך אובייקטים (key→value), כולל מספר שורה.
function readInquiries_(){
  var sh = inquiriesSheet_();
  var n = sh.getLastRow();
  if (n < 2) return [];
  var hdr = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var idx = {}; SCHEMA.forEach(function(c){ idx[c.key] = hdr.indexOf(c.header); });
  var data = sh.getRange(2,1,n-1,sh.getLastColumn()).getValues();
  return data.map(function(row, i){
    var o = {_row: i+2};
    SCHEMA.forEach(function(c){ if (idx[c.key] >= 0) o[c.key] = row[idx[c.key]]; });
    return o;
  });
}

// מוסיף עמודות-סכמה חסרות לגיליון הפניות (מיגרציה בטוחה — לא נוגע בנתונים קיימים).
// נקרא מ-apiBoard / runImport כדי שעמודות חדשות (למשל צ'ק-ליסט מסמכים) ייווצרו לבד.
function ensureColumns_(){
  var sh = inquiriesSheet_();
  var lastCol = sh.getLastColumn();
  var hdr = sh.getRange(1,1,1,lastCol).getValues()[0];
  var have = {}; hdr.forEach(function(h){ have[String(h)] = true; });
  var missing = SCHEMA.map(function(c){return c.header;}).filter(function(h){ return !have[h]; });
  if (!missing.length) return 0;
  sh.getRange(1, lastCol+1, 1, missing.length).setValues([missing])
    .setFontWeight('bold').setBackground('#1f3a4d').setFontColor('#ffffff');
  return missing.length;
}

// כתיבת אובייקט פנייה לשורה (מחושב מחדש לפני כתיבה).
function writeRow_(sh, rowNum, obj){
  if (!rowNum){ throw new Error('writeRow_ ללא מספר שורה עבור ' + (obj && obj.name)); }
  computeRow_(obj);
  var hdr = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var line = hdr.map(function(h){
    var c = SCHEMA.filter(function(x){return x.header===h;})[0];
    if (!c) return '';
    var v = obj[c.key];
    return (v === undefined || v === null) ? '' : v;
  });
  sh.getRange(rowNum,1,1,line.length).setValues([line]);
}

// ── נרמול ──────────────────────────────────────────────────────
function normHeader_(s){
  return String(s||'').replace(/["':‏‎]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
function cleanPhone_(s){
  return String(s||'').replace(/[^0-9]/g,'').replace(/^972/,'0');
}
// פירוש ערך תא לבוליאני (V / כן / יש / ✓ / תאריך כלשהו → true)
function toBool_(v){
  if (v === true) return true;
  var s = String(v||'').trim().toLowerCase();
  if (!s) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s) > 0;   // ערך מספרי (סכום תשלום וכו') = כן
  return ['v','✓','✔','כן','יש','שולם','בוצע','x','+','true'].indexOf(s) >= 0 || /\d{1,2}[./]\d/.test(s);
}
function toNum_(v){ var n = parseFloat(String(v||'').replace(/[^0-9.]/g,'')); return isNaN(n)?'':n; }

// מפתח זהות יציב — לפי תוכנית (אדם בשתי תוכניות = שתי רשומות):
// program | (קוד לקוח / טלפון / שם)
// מנרמלים את התוכנית כדי שרשומה ישנה (שם-לשונית ארוך) ורשומה חדשה (תווית נקייה) יתלכדו.
function recordKey_(o){
  var pk = normHeader_(canonicalProgram_(o.program||''));
  var base;
  if (o.crmCode) base = 'c:'+String(o.crmCode).replace(/\D/g,'');
  else { var p = cleanPhone_(o.phone); base = p ? 'p:'+p : 'n:'+normHeader_(o.name); }
  return pk + '|' + base;
}

// ── חישוב שלב / פעולה / תזכורת (תלוי-תוכנית) ──────────────────
function computeRow_(o){
  if (isClosed_(o)){
    o.stage = '✗ סגור';
    o.nextAction = '—';
  } else {
    var f = funnelFor_(o.program);
    var si = 0;
    for (var i = f.length - 1; i >= 0; i--){ if (f[i].reached(o)){ si = i; break; } }
    o.stage = f[si].stage;
    o.nextAction = f[si].next;
  }
  // דגלים נגזרים (לא נשמרים בגיליון — אינם בסכמה — אך נשלחים ללקוח)
  o.registered = regAnchorPaid_(o);   // האם שולם עוגן-ההרשמה של התוכנית = "נרשם"
  o.gateWarn   = gateWarn_(o);        // אזהרת שער (הדיאלוגי: ריאיון ללא דמי הרשמה)
  // ימים מאז עדכון
  var u = o.updatedAt ? new Date(o.updatedAt) : null;
  o.daysSince = (u && !isNaN(u)) ? Math.floor((new Date() - u)/86400000) : '';
  return o;
}

// האם שולם עוגן-ההרשמה של התוכנית (מקדמה / דמי הרשמה / תשלום מלא).
function regAnchorPaid_(o){
  var a = PROGRAM_REG_ANCHOR[canonicalProgram_(o.program)] || 'payReg';
  if (a === 'payFull') return !!(o.payTuition || o.payDeposit || o.payReg);
  return !!o[a];
}

// אזהרה רכה (לא חוסמת): בהדיאלוגי, ריאיון מחייב תשלום דמי הרשמה (300) תחילה.
function gateWarn_(o){
  if (canonicalProgram_(o.program) !== 'הדיאלוגי') return '';
  var atInterview = o.interviewDate || ['נקבע','בוצע','התקבל'].indexOf(o.interview) >= 0;
  if (atInterview && !o.payReg) return 'טרם שולמו דמי הרשמה (300) — נדרש לפני ריאיון';
  return '';
}

function isClosed_(o){
  if (['לא מעוניין','נדחה'].indexOf(o.status) >= 0) return true;
  var s = String(o.noInterest||'').trim();
  return s.length > 0 && !o.payReg && !o.payTuition;
}

function needsReminder_(o){
  if (isClosed_(o)) return false;
  if (o.daysSince === '' || o.daysSince < REMINDER_DAYS) return false;
  if (o.snoozeUntil){ var d = new Date(o.snoozeUntil); if (!isNaN(d) && d > new Date()) return false; }
  return true;
}

function todayStr_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// המרת תאריכים לטקסט yyyy-MM-dd — כדי שהחזרה ללקוח תהיה JSON-בטוחה.
function fmtDate_(v){
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}
function sanitizeOut_(o){
  SCHEMA.forEach(function(c){ if (c.type==='date' && o[c.key] !== undefined) o[c.key] = fmtDate_(o[c.key]); });
  return o;
}

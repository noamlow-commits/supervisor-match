/**
 * lib.gs — שירותי ליבה: גישה ל-App DB, נרמול, חישוב שלב/פעולה/תזכורת.
 * משותף לכל שאר הקבצים.
 */

function getAppDb_(){
  if (!APP_DB_ID) throw new Error('APP_DB_ID ריק — הריצו setup() תחילה והדביקו את ה-id ב-config.gs');
  return SpreadsheetApp.openById(APP_DB_ID);
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
function recordKey_(o){
  var pk = normHeader_(o.program||'');
  var base;
  if (o.crmCode) base = 'c:'+String(o.crmCode).replace(/\D/g,'');
  else { var p = cleanPhone_(o.phone); base = p ? 'p:'+p : 'n:'+normHeader_(o.name); }
  return pk + '|' + base;
}

// ── חישוב שלב / פעולה / תזכורת ────────────────────────────────
function computeRow_(o){
  var closed = isClosed_(o);
  var si;
  if (closed) si = 9;
  else if (o.payTuition) si = 8;
  else if (o.payDeposit) si = 7;
  else if (o.payReg) si = 6;
  else if (o.interview === 'התקבל') si = 5;
  else if (o.interview === 'נקבע' || o.interview === 'בוצע' || o.interviewDate) si = 4;
  else if (o.certDocs && o.regForm && (o.recommend)) si = 3;
  else if (o.spoke) si = 2;
  else if (o.materialSent) si = 1;
  else si = 0;
  o.stage = FUNNEL[si].stage;
  o.nextAction = FUNNEL[si].next;
  // ימים מאז עדכון
  var u = o.updatedAt ? new Date(o.updatedAt) : null;
  o.daysSince = (u && !isNaN(u)) ? Math.floor((new Date() - u)/86400000) : '';
  return o;
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

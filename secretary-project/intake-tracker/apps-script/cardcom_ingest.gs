/**
 * cardcom_ingest.gs — שלד: סימון תשלומים אוטומטי מחשבוניות CardCom. חלק מפרויקט האפליקציה.
 *
 * רץ תחת merkazrotenbergkh (טריגר מתוזמן). חשבוניות CardCom (purchase@out.cardcom.co.il)
 * מועברות לתיבת האפליקציה; כאן מפענחים, מתאימים לפנייה, ומסמנים את אבן-הדרך של התשלום.
 *
 * ⚠️ שלד לבדיקה — מבוסס על מבנה חשבונית אמיתית. צריך כיול מול עוד דוגמאות.
 *
 * זרימה: חשבונית → פענוח (סכום / תיאור / משלם / מס' עסקה) → התאמה לפנייה (מייל→טלפון→שם)
 *        → סימון התשלום הנכון (לפי תיאור/סכום) + סכום + תאריך + מס' עסקה → תיוג המייל.
 * דה-דופ לפי מספר עסקה. ללא התאמה → רישום ביומן ודילוג (לא ממציא רשומה).
 *
 * הקמה: הדבק → שמור → הרץ testCardcomOnce (אישור Gmail) → installCardcomTrigger.
 *       + הגדר forward של חשבוניות CardCom → merkazrotenbergkh.
 */

var CARDCOM_LABEL = 'נקלט-תשלום';
var CARDCOM_QUERY = '(from:cardcom.co.il OR CardCom OR "אישורית זהב") -label:"' + CARDCOM_LABEL + '"';

// תיאור המוצר (מתוך שורת "פריט" בחשבונית) → אבן-הדרך של התשלום.
// ⚠️ הטרמינל מוכר מוצרים רבים (קורסים, ספרים…). ממפים רק את דמי-המסלול; אחרת מתעלמים.
function cardcomKind_(desc, amount){
  var d = String(desc || '');
  if (!d) return null;
  if (/קורס|סדנ|כנס|הרצא|מפגש|ספר|כרטיס|תרומ|שיעור/.test(d)) return null;   // מוצר אחר — לא תשלום מסלול
  if (/מקדמה/.test(d))                      return {bool:'payDeposit',  sum:'payDepositSum',  date:'payDepositDate', rcpt:null,         label:'מקדמה'};
  if (/דמי\s*ראיון|תשלום\s*ראיון/.test(d))  return {bool:'payInterview',sum:null,             date:null,            rcpt:null,         label:'דמי ראיון'};
  if (/שכר\s*לימוד/.test(d))                return {bool:'payTuition',  sum:'payTuitionSum',  date:null,            rcpt:null,         label:'שכר לימוד'};
  if (/דמי\s*הרשמה|הרשמה/.test(d))          return {bool:'payReg',      sum:'payRegSum',      date:'payRegDate',    rcpt:'payRegRcpt', label:'דמי הרשמה'};
  return null;
}

// פענוח גוף חשבונית CardCom → שדות. מחזיר null אם לא נראית כחשבונית.
function parseCardcom_(text){
  var t = String(text || '');
  if (!/CardCom|קארדקום|אישורית זהב/.test(t)) return null;
  return {
    amount:  toNum_(ingestGrab_(t, /סה.?כ\s*חיוב\s*([\d,]+)/)),
    success: /בוצע[ה]?\s*בהצלחה|רכישה מוצלחת/.test(t),
    // תיאור המוצר מתוך שורת "פריט <קוד> <מס'> <תיאור> <כמות> <סכום>".
    desc:    ingestGrab_(t, /פריט\s+\S+\s+\d+\s+([^\n\r]+?)\s+\d+\s+[\d,]+/) || ingestGrab_(t, /תיאור\s+([^\n\r]+)/),
    name:    ingestGrab_(t, /שם בעל הכרטיס\s*([^\n\r]+)/),
    email:   ingestGrab_(t, /דוא?["׳']?ר\s+([^\s]+@[^\s]+)/),
    phone:   ingestGrab_(t, /טלפון\s*נייד\s*([0-9]{7,})/),
    txn:     ingestGrab_(t, /מספר\s*עסקה\s*פנימי\s*(\d+)/)
  };
}

// התאמה לפנייה: מייל → טלפון → שם.
function matchInquiry_(idx, rec){
  if (rec.email && idx.byEmail[String(rec.email).toLowerCase()]) return idx.byEmail[String(rec.email).toLowerCase()];
  if (rec.phone && idx.byPhone[cleanPhone_(rec.phone)])          return idx.byPhone[cleanPhone_(rec.phone)];
  if (rec.name  && idx.byName[normHeader_(rec.name)])            return idx.byName[normHeader_(rec.name)];
  return null;
}

function applyCardcomPayment_(sh, o, kind, rec){
  o[kind.bool] = true;
  if (kind.sum && rec.amount !== '' && rec.amount != null) o[kind.sum] = rec.amount;
  if (kind.date) o[kind.date] = todayStr_();
  if (kind.rcpt && rec.txn) o[kind.rcpt] = rec.txn;
  o.payNote = (o.payNote ? o.payNote + ' | ' : '') + kind.label + ' ' + (rec.amount || '') + '₪ (CardCom ' + (rec.txn || '') + ')';
  o.updatedAt = todayStr_();
  writeRow_(sh, o._row, o);
}

function ingestCardcomReceipts(){
  var label = GmailApp.getUserLabelByName(CARDCOM_LABEL) || GmailApp.createLabel(CARDCOM_LABEL);
  var threads = GmailApp.search(CARDCOM_QUERY, 0, 50);
  if (!threads.length){ Logger.log('אין חשבוניות חדשות.'); return {applied:0, nomatch:0}; }

  ensureColumns_();
  var sh = inquiriesSheet_();
  var rows = readInquiries_();
  var idx = {byEmail:{}, byPhone:{}, byName:{}};
  rows.forEach(function(o){
    var e = String(o.email || '').trim().toLowerCase(); if (e) idx.byEmail[e] = o;
    var p = cleanPhone_(o.phone); if (p) idx.byPhone[p] = o;
    var n = normHeader_(o.name);  if (n) idx.byName[n] = o;
  });

  var applied = 0, nomatch = 0;
  threads.forEach(function(t){
    t.getMessages().forEach(function(m){
      var rec = parseCardcom_(msgText_(m));
      if (!rec || !rec.success) return;
      var kind = cardcomKind_(rec.desc, rec.amount);
      if (!kind) { Logger.log('סוג תשלום לא זוהה: desc="' + rec.desc + '" amount=' + rec.amount); return; }
      var o = matchInquiry_(idx, rec);
      if (!o) { nomatch++; Logger.log('אין התאמה לפנייה: ' + rec.name + ' / ' + rec.email + ' / ' + rec.phone + ' (' + kind.label + ' ' + rec.amount + ')'); return; }
      if (rec.txn && String(o.payNote || '').indexOf(rec.txn) >= 0) return;   // כבר טופל
      applyCardcomPayment_(sh, o, kind, rec);
      applied++;
    });
    t.addLabel(label);
  });

  Logger.log('סומנו ' + applied + ' תשלומים; ללא התאמה: ' + nomatch + '.');
  return {applied:applied, nomatch:nomatch};
}

// אבחון: מדפיס מה נפענח מכל חשבונית ואם נמצאה התאמה (בלי לשנות דבר).
function diagCardcom(){
  var rows = readInquiries_();
  var idx = {byEmail:{}, byPhone:{}, byName:{}};
  rows.forEach(function(o){ var e=String(o.email||'').trim().toLowerCase(); if(e) idx.byEmail[e]=o; var p=cleanPhone_(o.phone); if(p) idx.byPhone[p]=o; var n=normHeader_(o.name); if(n) idx.byName[n]=o; });
  var threads = GmailApp.search('(from:cardcom.co.il OR CardCom OR "אישורית זהב")', 0, 30);
  Logger.log('חשבוניות: ' + threads.length + ' threads');
  threads.forEach(function(t){ t.getMessages().forEach(function(m){
    var rec = parseCardcom_(msgText_(m));
    if (!rec) { Logger.log('  לא-חשבונית: ' + m.getSubject()); return; }
    var kind = cardcomKind_(rec.desc, rec.amount);
    var o = matchInquiry_(idx, rec);
    Logger.log('  ' + (rec.name||'') + ' | ' + (rec.email||'') + ' | ' + (rec.phone||'') + ' | סכום=' + rec.amount + ' | תיאור="' + rec.desc + '" → ' + (kind?kind.label:'?') + ' | התאמה: ' + (o?('✓ '+o.name):'✗'));
  }); });
}

// ── הרצה/התקנה ידנית ───────────────────────────────────────────
function testCardcomOnce(){ return ingestCardcomReceipts(); }
function installCardcomTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'ingestCardcomReceipts') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('ingestCardcomReceipts').timeBased().everyHours(1).create();
  Logger.log('✅ טריגר קארדקום הותקן — כל שעה.');
}

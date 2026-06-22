/**
 * Code.gs — שרת ה-Web App (Apps Script). קורא/כותב ל-App DB בלבד.
 * פרוס כ-Web App: Deploy → New deployment → Web app.
 *   Execute as: Me (חשבון רוטנברג)   |   Access: בעלי גישה מהמכון בלבד.
 */
function doGet(){
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('מעקב פניות — מכון רוטנברג')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** נתוני הלוח: כל הפניות (מחושבות) + רשימות עזר. מוחזר כ-JSON-string (בטוח לסריאליזציה). */
function apiBoard(){
  ensureColumns_();   // עמודות-סכמה חדשות (צ'ק-ליסט מסמכים) — מיגרציה בטוחה
  var rows = readInquiries_().map(function(o){
    computeRow_(o);
    o.reminder = needsReminder_(o);
    delete o._row;
    return sanitizeOut_(o);
  });
  var programs = uniq_(rows.map(function(r){return r.program;}).filter(String));
  // משפך (רשימת שלבים) לכל תוכנית פעילה — הלוח בונה עמודות לפי התוכנית שנבחרה.
  var funnels = {
    'הדיאלוגי': DIALOGI_FUNNEL.map(function(f){return f.stage;}),
    'תעודה':    TEUDA_FUNNEL.map(function(f){return f.stage;}),
    'אח"ד':     AHAD_FUNNEL.map(function(f){return f.stage;})
  };
  return JSON.stringify({
    rows: rows,
    programs: programs,
    activePrograms: ACTIVE_PROGRAMS,
    programColors: PROGRAM_COLORS,
    regAnchors: PROGRAM_REG_ANCHOR,
    funnels: funnels,
    stages: DIALOGI_FUNNEL.map(function(f){return f.stage;}),   // ברירת-מחדל (תאימות)
    schema: SCHEMA,
    templates: readTemplates_()
  });
}

/** מחיקת פנייה לפי id. */
function apiDelete(id){
  var sh = inquiriesSheet_();
  var rows = readInquiries_();
  for (var i=0;i<rows.length;i++){
    if (rows[i].id === id){ sh.deleteRow(rows[i]._row); return JSON.stringify({ok:true}); }
  }
  throw new Error('פנייה לא נמצאה: ' + id);
}

/** עדכון פנייה. patch = {id, field:value, ...}. מחזיר את הרשומה המעודכנת. */
function apiUpdate(patch){
  var sh = inquiriesSheet_();
  var rows = readInquiries_();
  var target = null;
  for (var i=0;i<rows.length;i++){ if (rows[i].id === patch.id){ target = rows[i]; break; } }
  if (!target) throw new Error('פנייה לא נמצאה: ' + patch.id);
  Object.keys(patch).forEach(function(k){
    if (k === 'id') return;
    var c = schemaByKey()[k];
    if (!c || c.computed) return;
    target[k] = patch[k];
  });
  target.updatedAt = todayStr_();
  writeRow_(sh, target._row, target);
  computeRow_(target);
  target.reminder = needsReminder_(target);
  delete target._row;
  return JSON.stringify(sanitizeOut_(target));
}

/** יצירת פנייה חדשה ידנית מהאפליקציה. */
function apiCreate(rec){
  // ולידציה בסיסית — האפליקציה היא מקור-האמת, לא יוצרים רשומות ריקות.
  if (!String(rec.name||'').trim() && !String(rec.phone||'').trim())
    throw new Error('נדרש לפחות שם או טלפון');
  ensureColumns_();
  var sh = inquiriesSheet_();
  // דה-דופ: אם כבר קיימת פנייה עם אותו מפתח-זהות (תוכנית+קוד/טלפון/שם) — לא ליצור כפיל.
  var key = recordKey_(rec);
  if (readInquiries_().some(function(o){ return recordKey_(o) === key; }))
    throw new Error('כבר קיימת פנייה דומה (אותו אדם באותה תוכנית). פתח/י ועדכן/י אותה במקום ליצור חדשה.');
  rec.id = 'A' + Utilities.getUuid().slice(0,8);
  rec.source = 'app';
  rec.inquiryDate = todayStr_();
  rec.updatedAt = todayStr_();
  if (!rec.status) rec.status = 'פנייה חדשה';
  computeRow_(rec);
  sh.appendRow(lineForSheet_(sh, rec));   // לפי סדר העמודות בגיליון (מונע אי-התאמה)
  return JSON.stringify(sanitizeOut_(rec));
}

/** דשבורד: משפך לכל תוכנית + תשלומים פתוחים + תזכורות. */
function apiDashboard(){
  var rows = readInquiries_();
  rows.forEach(computeRow_);
  var byProgram = {};
  var reminders = [], outstanding = [];
  rows.forEach(function(o){
    if (o.recordType === 'איש-קשר') return;   // אנשי קשר אינם חלק מהמשפך
    var p = o.program || '(ללא תוכנית)';
    byProgram[p] = byProgram[p] || {};
    byProgram[p][o.stage] = (byProgram[p][o.stage]||0) + 1;
    o.reminder = needsReminder_(o);
    if (o.reminder) reminders.push({id:o.id, name:o.name, program:p, stage:o.stage, days:o.daysSince, next:o.nextAction});
    if (o.interview === 'התקבל' && !o.payReg && !isClosed_(o))
      outstanding.push({id:o.id, name:o.name, program:p, owe:'דמי הרשמה'});
  });
  return JSON.stringify({byProgram:byProgram, reminders:reminders, outstanding:outstanding,
          stages:DIALOGI_FUNNEL.map(function(f){return f.stage;}), total:rows.length});
}

/** הרצת ייבוא מתוך האפליקציה. */
function apiImport(){ return JSON.stringify(runImport()); }

/** שליחת חומר במייל + סימון. */
function apiSendMaterial(id){
  var rows = readInquiries_(), sh = inquiriesSheet_();
  var o = null; for (var i=0;i<rows.length;i++){ if (rows[i].id===id){ o=rows[i]; break; } }
  if (!o) throw new Error('פנייה לא נמצאה');
  if (!o.email) throw new Error('אין כתובת מייל לפנייה זו');
  var t = getTemplateForProgram_(o.program);
  if (!t || !t.body) throw new Error('אין תבנית הודעה לתוכנית "' + (o.program||'') + '" — הריצו seedTemplatesFromLiveFile או מלאו ידנית בלשונית תבניות');
  var body = t.body.replace(/\{\{שם\}\}/g, o.name || '');
  MailApp.sendEmail(o.email, t.subject || ('פנייה — ' + (o.program||'')), body);
  o.materialSent = true; o.materialDate = todayStr_(); o.updatedAt = todayStr_();
  writeRow_(sh, o._row, o);
  return JSON.stringify({ok:true, to:o.email});
}

// כל התבניות (לפי תוכנית) — נשלח ללקוח עם הלוח.
function readTemplates_(){
  var sh = getAppDb_().getSheetByName(SHEET_TEMPLATES);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i=1;i<data.length;i++){
    // מנרמלים את שם התוכנית של התבנית כדי שתתאים לתוכנית המנורמלת של הפנייה.
    if (data[i][0]) out.push({ program:canonicalProgram_(String(data[i][0])), subject:String(data[i][1]||''), body:String(data[i][2]||'') });
  }
  return out;
}

function getTemplateForProgram_(program){
  return readTemplates_().filter(function(t){ return t.program === program; })[0] || null;
}

function uniq_(a){ var s={},o=[]; a.forEach(function(x){ if(!s[x]){s[x]=1;o.push(x);} }); return o; }

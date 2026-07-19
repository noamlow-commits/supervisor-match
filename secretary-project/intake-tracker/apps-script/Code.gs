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
    genericFunnel: GENERIC_FUNNEL.map(function(f){return f.stage;}),
    stageRequires: STAGE_REQUIRES,
    stageApply: STAGE_APPLY,
    autoDatePairs: AUTO_DATE_PAIRS,
    programCardHide: PROGRAM_CARD_HIDE,
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
  computeRow_(target);
  var oldEff = effectiveStage_(target);   // השלב לפני העדכון — לזיהוי תזוזה
  Object.keys(patch).forEach(function(k){
    if (k === 'id') return;
    var c = schemaByKey()[k];
    if (!c || c.computed) return;
    target[k] = patch[k];
  });
  // מתי מנקים את המיקום-הידני (boardStage)?
  //  • סימון עובדת-משפך אמיתית בכרטיס (בלי boardStage מפורש) → מנקים, כדי שהשלב המחושב
  //    יחזור לשלוט (תיקון "לא מגיב" — סימון וי מזיז את הכרטיס).
  //  • גרירה: הלקוח שולח boardStage מפורש *יחד* עם אבן-הדרך → לא מנקים, כדי שהכרטיס
  //    יישאר בעמודה שאליה נגרר גם אם אבן-הדרך לבדה גוזרת שלב נמוך יותר (תיקון "קופץ חזרה").
  //  • שדות-הרחבה (aug: stageSince/snooze/הערות/התלבטות) אינם עובדות-משפך → אינם מנקים.
  var changedFacts = Object.keys(patch).some(function(k){
    var c = schemaByKey()[k];
    return k !== 'id' && k !== 'boardStage' && c && !c.computed && !c.aug;
  });
  if (changedFacts && patch.boardStage === undefined) target.boardStage = '';
  applyAutoDates_(target);   // ✓ שסומן + תאריך צמוד ריק → תאריך היום (גם בגרירה; לא דורס ידני)
  target.updatedAt = todayStr_();
  computeRow_(target);
  // אם השלב האפקטיבי השתנה (גרירה / סימון / שינוי-שלב) — מאפסים את מונה ההתיישנות.
  if (patch.stageSince === undefined && effectiveStage_(target) !== oldEff) target.stageSince = todayStr_();
  writeRow_(sh, target._row, target);
  computeRow_(target);
  target.reminder = needsReminder_(target);
  delete target._row;
  return JSON.stringify(sanitizeOut_(target));
}

/** יצירת פנייה חדשה ידנית מהאפליקציה. */
function apiCreate(rec){
  // ולידציה — יצירה ידנית מחייבת שם ותוכנית (כדי שפנייה לא "תיאבד" ללא שיוך).
  // (קליטת Amax מוסיפה שורות ישירות, לא דרך apiCreate, אז לידים ממתינים-לשיוך אינם נחסמים.)
  if (!String(rec.name||'').trim()) throw new Error('נדרש שם');
  if (String(rec.recordType||'פנייה') === 'פנייה' && !String(rec.program||'').trim())
    throw new Error('יש לבחור תוכנית');
  ensureColumns_();
  var sh = inquiriesSheet_();
  // דה-דופ: אם כבר קיימת רשומה של אותו אדם באותה תוכנית — לא ליצור כפיל.
  // sameRecord_ תופס גם כשברשומה הקיימת יש טלפון ובחדשה רק שם (או להיפך) — הפער
  // שאיפשר את כפילות "גינת סבח" (2026-07-19). recordKey_ היחיד היה מפספס זאת.
  if (readInquiries_().some(function(o){ return sameRecord_(o, rec); }))
    throw new Error('כבר קיימת רשומה דומה (אותו אדם באותה תוכנית). פתח/י ועדכן/י אותה במקום ליצור חדשה.');
  rec.id = 'A' + Utilities.getUuid().slice(0,8);
  rec.source = 'app';
  rec.inquiryDate = todayStr_();
  rec.updatedAt = todayStr_();
  rec.stageSince = todayStr_();
  if (!rec.status) rec.status = 'פנייה חדשה';
  applyAutoDates_(rec);
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
    if (o.recordType !== 'פנייה') return;   // אנשי קשר / קורסים אינם חלק מהמשפך
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

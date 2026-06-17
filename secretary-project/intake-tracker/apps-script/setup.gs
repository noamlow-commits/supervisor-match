/**
 * setup.gs — הקמה חד-פעמית של ה-App DB.
 *
 * הרצה ראשונה:
 *   1. הדביקו את כל קבצי ה-.gs לפרויקט Apps Script אחד (תחת חשבון רוטנברג).
 *   2. הריצו setup(). אם APP_DB_ID ריק — ייווצר גיליון חדש וה-id יודפס ב-Logs.
 *   3. העתיקו את ה-id ל-APP_DB_ID ב-config.gs.
 *   4. הריצו runImport() (importer.gs) לאכלוס ראשון מהקובץ החי.
 */
function setup(){
  var ss;
  if (APP_DB_ID){
    ss = SpreadsheetApp.openById(APP_DB_ID);
  } else {
    ss = SpreadsheetApp.create('מעקב פניות — App DB (מכון רוטנברג)');
    Logger.log('✅ נוצר App DB חדש. הדביקו ב-config.gs:\nvar APP_DB_ID = \'' + ss.getId() + '\';');
  }
  buildInquiries_(ss);
  buildLookups_(ss);
  buildTemplates_(ss);
  // מסירים את "גיליון1" הדיפולטי אם קיים וריק
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log('✅ setup הושלם. App DB: ' + ss.getUrl());
  return ss.getId();
}

function buildInquiries_(ss){
  var sh = ss.getSheetByName(SHEET_INQUIRIES) || ss.insertSheet(SHEET_INQUIRIES, 0);
  sh.clear();
  var hdr = headers();
  sh.getRange(1,1,1,hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#1f3a4d').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setRightToLeft(true);
  // ולידציה לרשימות
  SCHEMA.forEach(function(c, i){
    if (c.options && c.options.length){
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(c.options, true).setAllowInvalid(true).build();
      sh.getRange(2, i+1, 1000, 1).setDataValidation(rule);
    }
  });
  // עיצוב מותנה: שלב סגור → אפור; צריך תזכורת → צהוב (נעשה ע"י עמודת daysSince)
  var stageCol = headers().indexOf('שלב במשפך') + 1;
  if (stageCol > 0){
    var range = sh.getRange(2, stageCol, 1000, 1);
    var ruleClosed = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('✗').setBackground('#e0e0e0').setRanges([range]).build();
    var ruleDone = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('8 · נרשם').setBackground('#c8e6c9').setRanges([range]).build();
    sh.setConditionalFormatRules([ruleClosed, ruleDone]);
  }
  return sh;
}

function buildLookups_(ss){
  var sh = ss.getSheetByName(SHEET_LOOKUPS) || ss.insertSheet(SHEET_LOOKUPS);
  sh.clear(); sh.setRightToLeft(true);
  sh.getRange(1,1,1,3).setValues([['סטטוסים','ערוצי פנייה','שלבי משפך']]).setFontWeight('bold');
  var statuses = SCHEMA.filter(function(c){return c.key==='status';})[0].options;
  var channels = SCHEMA.filter(function(c){return c.key==='channel';})[0].options;
  var stages   = FUNNEL.map(function(f){return f.stage;});
  var max = Math.max(statuses.length, channels.length, stages.length);
  for (var i=0;i<max;i++){
    sh.getRange(i+2,1).setValue(statuses[i]||'');
    sh.getRange(i+2,2).setValue(channels[i]||'');
    sh.getRange(i+2,3).setValue(stages[i]||'');
  }
}

function buildTemplates_(ss){
  var sh = ss.getSheetByName(SHEET_TEMPLATES) || ss.insertSheet(SHEET_TEMPLATES);
  sh.clear(); sh.setRightToLeft(true);
  sh.getRange(1,1,1,3).setValues([['מזהה תבנית','נושא','גוף']]).setFontWeight('bold');
  sh.getRange(2,1,1,3).setValues([[
    'material_tzimtzum',
    'תוכנית "כח הצמצום" — מכון רוטנברג',
    'שלום {{שם}},\n\nתודה שהתעניינת בתוכנית החד-שנתית ללימודי תעודה "כח הצמצום" מבית מכון רוטנברג.\n' +
    'הסבר מפורט ופרטים נוספים: https://www.jewishpsychology.org/courses_h.php\n\n' +
    'ההרשמה פתוחה. לרישום יש להעביר קו"ח לרכז התוכנית הרב ד"ר רונן בן-דוד ולתאם ראיון קצר.\n' +
    'מייל: ronenbd@walla.co.il  |  טלפון (בתיאום בוואטסאפ): 050-591-2596\n\n' +
    'בברכה,\nמכון רוטנברג'
  ]]);
}

// תפריט נוח בתוך ה-App DB
function onOpen(){
  SpreadsheetApp.getUi().createMenu('מעקב פניות')
    .addItem('ייבוא מהקובץ החי', 'runImport')
    .addItem('רענון חישובים', 'recomputeAll')
    .addToUi();
}

function recomputeAll(){
  var sh = inquiriesSheet_();
  var rows = readInquiries_();
  rows.forEach(function(o){ writeRow_(sh, o._row, o); });
  Logger.log('רוענן ' + rows.length + ' שורות');
}

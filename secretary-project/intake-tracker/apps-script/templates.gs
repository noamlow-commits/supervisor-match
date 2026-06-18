/**
 * templates.gs — חילוץ תבניות-ההודעה שטל כתבה בתוך הקובץ החי, לכל תוכנית.
 *
 * הרצה: בחרו seedTemplatesFromLiveFile → Run. קוראת מהקובץ החי (בלבד),
 * מזהה בכל לשונית את שורות-הטקסט שאינן רשומות פנייה (= תבנית/הוראות),
 * וכותבת אותן ללשונית "תבניות" ב-App DB, שורה לכל תוכנית. אפשר להריץ שוב בכל עת.
 * אחרי ההרצה: התבניות זמינות בכרטיס באפליקציה (כפתור "📋 העתק טקסט" / "✉ שלח חומר").
 * טל יכולה לערוך אותן ישירות בלשונית "תבניות".
 */
function seedTemplatesFromLiveFile(){
  var live = SpreadsheetApp.openById(LIVE_FILE_ID);   // קריאה בלבד
  var db = getAppDb_();
  var sh = db.getSheetByName(SHEET_TEMPLATES) || db.insertSheet(SHEET_TEMPLATES);
  sh.clear(); sh.setRightToLeft(true);
  sh.getRange(1,1,1,3).setValues([['תוכנית','נושא','גוף']])
    .setFontWeight('bold').setBackground('#1f3a4d').setFontColor('#ffffff');

  var out = [];
  live.getSheets().forEach(function(tab){
    var name = tab.getName().trim();
    if (SKIP_TABS.some(function(s){ return name.indexOf(s) >= 0; })) return;
    var lines = extractTemplateLines_(tab);
    if (lines.length) out.push([name, '', lines.join('\n')]);
  });
  if (out.length) sh.getRange(2,1,out.length,3).setValues(out);

  Logger.log('✅ נכתבו תבניות ל-' + out.length + ' תוכניות:\n' +
    out.map(function(o){ return '• ' + o[0] + '  (' + o[2].split('\n').length + ' שורות, ' + o[2].length + ' תווים)'; }).join('\n'));
  return out.length;
}

/** שורות-טקסט בלשונית שאינן רשומת-פנייה (אין טלפון/מייל/קוד) — מועמדות לתבנית. */
function extractTemplateLines_(tab){
  var n = tab.getLastRow(), m = tab.getLastColumn();
  if (n < 1 || m < 1) return [];
  var vals = tab.getRange(1,1,n,m).getValues();

  // שורת הכותרת (כדי לדעת אילו עמודות הן מזהי-קשר)
  var headerRow = -1, bestScore = 1, bestMap = null;
  for (var r=0; r<Math.min(vals.length,12); r++){
    var mm = mapColumns_(vals[r]);
    if (Object.keys(mm).length > bestScore){ bestScore = Object.keys(mm).length; headerRow = r; bestMap = mm; }
  }

  var lines = [];
  for (var i=0; i<vals.length; i++){
    if (i === headerRow) continue;
    var row = vals[i];
    // האם זו רשומת פנייה? (יש טלפון/מייל/קוד) → לדלג
    var rec = {};
    if (bestMap) Object.keys(bestMap).forEach(function(k){ rec[k] = coerce_(k, row[bestMap[k]]); });
    if (rec.phone || rec.email || rec.crmCode) continue;
    // לאסוף תאים עם משפט עברי משמעותי (לא תוויות/שמות קצרים)
    row.forEach(function(cell){
      var s = String(cell || '').replace(/\s+/g,' ').trim();
      if (s.length >= 10 && /[א-ת]/.test(s) && s !== 'שם') lines.push(s);
    });
  }
  // הסרת כפילויות עוקבות
  return lines.filter(function(s, i){ return s !== lines[i-1]; });
}

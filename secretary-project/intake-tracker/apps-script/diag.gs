/**
 * diag.gs — אבחון מבנה הקובץ החי (קריאה בלבד). חד-פעמי, לצורך תכנון.
 * הרצה: בחרו את הפונקציה diagnose → Run → פתחו את יומן הביצוע → העתיקו את כל הטקסט ושלחו לי.
 */
function diagnose(){
  var live = SpreadsheetApp.openById(LIVE_FILE_ID);
  var out = ['===== אבחון קובץ חי =====', 'מס\' לשוניות: ' + live.getSheets().length, ''];
  live.getSheets().forEach(function(tab, i){
    var name = tab.getName();
    var lr = tab.getLastRow(), lc = tab.getLastColumn();
    var skip = SKIP_TABS.some(function(s){ return name.indexOf(s) >= 0; });
    out.push('[' + i + '] "' + name + '"  שורות=' + lr + ' עמודות=' + lc + (skip ? '  ← מדולג' : ''));
    if (lr < 1 || lc < 1){ out.push(''); return; }
    var vals = tab.getRange(1,1,Math.min(lr,15),lc).getValues();
    // זיהוי שורת כותרת
    var best = -1, bestScore = 1, bestMap = null;
    for (var r = 0; r < vals.length; r++){
      var m = mapColumns_(vals[r]);
      if (Object.keys(m).length > bestScore){ bestScore = Object.keys(m).length; best = r; bestMap = m; }
    }
    var hdrRow = best >= 0 ? vals[best] : vals[0];
    out.push('   כותרת (שורה ' + (best+1) + '): ' + compact_(hdrRow));
    out.push('   שדות שמופו: ' + (bestMap ? Object.keys(bestMap).join(', ') : '— אין —'));
    if (best >= 0 && vals[best+1]) out.push('   דוגמת-שורה: ' + compact_(vals[best+1]));
    if (best >= 0 && vals[best+2]) out.push('   דוגמה נוספת: ' + compact_(vals[best+2]));
    out.push('');
  });
  Logger.log(out.join('\n'));
}

function compact_(arr){
  return arr.map(function(v){ var s = String(v||'').replace(/\s+/g,' ').trim(); return s.length>28 ? s.slice(0,28)+'…' : s; })
            .filter(function(s){ return s !== ''; }).join(' | ');
}

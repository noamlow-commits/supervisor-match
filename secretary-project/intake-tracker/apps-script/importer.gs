/**
 * importer.gs — סנכרון חד-כיווני: קובץ חי → App DB.
 * קריאה בלבד מהקובץ החי. כל לשונית = תוכנית. גמיש לשינויי מבנה (זיהוי כותרות לפי נרדפות).
 *
 * upsert לפי מפתח זהות (קוד לקוח / טלפון / שם). שדות-הרחבה של האפליקציה (aug) נשמרים.
 */
function runImport(){
  var live = SpreadsheetApp.openById(LIVE_FILE_ID);   // קריאה בלבד
  var sh = inquiriesSheet_();

  // אינדקס קיים לפי מפתח
  var existing = readInquiries_();
  var byKey = {};
  existing.forEach(function(o){ byKey[recordKey_(o)] = o; });

  var incoming = [];
  live.getSheets().forEach(function(tab){
    var name = tab.getName().trim();
    if (SKIP_TABS.some(function(s){ return name.indexOf(s) >= 0; })) return;
    var isContact = CONTACT_TABS.some(function(s){ return name.indexOf(s) >= 0; });
    var recs = parseTab_(tab, name);
    recs.forEach(function(r){ r.recordType = isContact ? 'איש-קשר' : 'פנייה'; });
    incoming = incoming.concat(recs);
  });

  var added = 0, updated = 0, skipped = 0;
  incoming.forEach(function(rec){
    if (!rec.name && !rec.crmCode && !rec.phone){ skipped++; return; }
    var key = recordKey_(rec);
    var cur = byKey[key];
    if (cur){
      // עדכון: מעדכנים שדות לא-aug ולא-computed; שומרים aug + מזהה + תאריך פנייה מקורי
      SCHEMA.forEach(function(c){
        if (c.aug || c.computed || c.key==='id' || c.key==='inquiryDate') return;
        if (rec[c.key] !== undefined && rec[c.key] !== '') cur[c.key] = rec[c.key];
      });
      cur.source = 'import';
      if (!cur.updatedAt) cur.updatedAt = rec.updatedAt || todayStr_();
      writeRow_(sh, cur._row, cur);
      updated++;
    } else {
      rec.id = 'I' + Utilities.getUuid().slice(0,8);
      rec.source = 'import';
      rec.inquiryDate = rec.inquiryDate || rec.updatedAt || todayStr_();
      rec.updatedAt = rec.updatedAt || todayStr_();
      computeRow_(rec);
      var line = headers().map(function(h){
        var c = SCHEMA.filter(function(x){return x.header===h;})[0];
        var v = c ? rec[c.key] : '';
        return (v===undefined||v===null)?'':v;
      });
      sh.appendRow(line);
      rec._row = sh.getLastRow();   // שמירת מספר השורה — כדי שכפילות מאוחרת תוכל לעדכן אותה
      byKey[key] = rec;
      added++;
    }
  });

  var msg = 'ייבוא הושלם — נוספו ' + added + ', עודכנו ' + updated + ', דולגו ' + skipped + '.';
  Logger.log(msg);
  return {added:added, updated:updated, skipped:skipped, message:msg};
}

/** פירוש לשונית בודדת → מערך רשומות מנורמלות. */
function parseTab_(tab, program){
  var n = tab.getLastRow(), m = tab.getLastColumn();
  if (n < 2) return [];
  var values = tab.getRange(1,1,Math.min(n,500),m).getValues();

  // איתור שורת כותרת: השורה עם הכי הרבה התאמות נרדפות (לפחות 2)
  var headerRow = -1, bestMap = null, bestScore = 1;
  for (var r=0; r<Math.min(values.length, 12); r++){
    var map = mapColumns_(values[r]);
    var score = Object.keys(map).length;
    if (score > bestScore){ bestScore = score; bestMap = map; headerRow = r; }
  }
  if (headerRow < 0 || !bestMap || bestMap.name === undefined) return [];

  var cycle = guessCycle_(program);
  var PAYSUM = {payReg:'payRegSum', payDeposit:'payDepositSum', payTuition:'payTuitionSum'};
  var out = [];
  for (var i=headerRow+1; i<values.length; i++){
    var row = values[i];
    var rec = {program: program, cycle: cycle};
    Object.keys(bestMap).forEach(function(key){
      if (key === 'stageRaw') return; // עמודת "תהליך" טקסטואלית — לא ממופה ישירות
      rec[key] = coerce_(key, row[bestMap[key]]);
    });
    // תשלומים: ערך מספרי בעמודת תשלום → שולם + שמירת הסכום
    Object.keys(PAYSUM).forEach(function(bk){
      if (bestMap[bk] === undefined) return;
      var num = toNum_(row[bestMap[bk]]);
      if (num !== '' && num > 0){ rec[bk] = true; rec[PAYSUM[bk]] = num; }
    });
    // חילוץ קוד לקוח שדחוס בעמודה אחרת (נפוץ בלשונית הדיאלוגי)
    if (!rec.crmCode){
      for (var k=0; k<row.length; k++){
        var s = String(row[k]||'');
        var mm = s.match(/קוד לקוח\D*(\d{5,6})/) || s.match(/\b(2\d{5})\b/);
        if (mm){ rec.crmCode = mm[1]; break; }
      }
    }
    // סינון: רשומה אמיתית רק אם יש מזהה קשר — מסנן שורות-תבנית/הוראות
    if (!rec.phone && !rec.email && !rec.crmCode) continue;
    if (String(rec.name).trim() === 'שם') continue;
    out.push(rec);
  }
  return out;
}

/** ממפה שורת-כותרת אפשרית → {fieldKey: colIndex} לפי SOURCE_SYNONYMS. */
function mapColumns_(rowVals){
  var map = {};
  rowVals.forEach(function(cell, idx){
    var h = normHeader_(cell);
    if (!h) return;
    for (var key in SOURCE_SYNONYMS){
      // 'status' מופיע פעמיים בלשונית התעודה — לוקחים את המופע האחרון (הסטטוס האמיתי)
      if (map[key] !== undefined && key !== 'status') continue;
      var hit = SOURCE_SYNONYMS[key].some(function(syn){ return normHeader_(syn) === h; });
      if (hit){ map[key] = idx; break; }
    }
  });
  return map;
}

/** המרת ערך גולמי לטיפוס היעד לפי schema. */
function coerce_(key, raw){
  var c = schemaByKey()[key];
  if (!c) {
    // שדות מקור שאין להם עמודה ישירה (channel וכו') — מחזירים טקסט גולמי
    return typeof raw === 'string' ? raw.trim() : raw;
  }
  if (c.type === 'bool') return toBool_(raw);
  if (c.type === 'number') return toNum_(raw);
  if (c.type === 'date'){ var d = new Date(raw); return isNaN(d) ? (raw||'') : raw; }
  // ניקוי דואל/טלפון מהקידומות שבקובץ ("דואר אלקטרוני :", "טלפון :")
  var s = String(raw||'').replace(/^(דואר אלקטרוני|מייל|טלפון|קוד לקוח)\s*:?\s*/,'').trim();
  return s;
}

function guessCycle_(program){
  var m = String(program).match(/תשפ"?[א-ת]/);
  return m ? m[0] : '';
}

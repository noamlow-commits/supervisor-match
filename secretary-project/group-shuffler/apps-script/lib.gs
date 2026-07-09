/**
 * lib.gs — גישה לנתונים + אלגוריתם השיבוץ החכם (מגוון, מצמצם חזרות).
 */
function gsDb_(){ var id = getDbId_(); if (!id) throw new Error('הריצו setup() תחילה'); return SpreadsheetApp.openById(id); }
function todayStr_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
// תאריך + N חודשים (yyyy-MM-dd) — לחישוב מועד ההחלפה של סבב.
function addMonths_(dateStr, m){
  var d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d)) d = new Date();
  d.setMonth(d.getMonth() + (Number(m) || 0));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ── רשימת שמות גנרית (משמשת גם למשתתפים וגם לקבוצה הקבועה) ─────
function readNames_(sheetName){
  var sh = gsDb_().getSheetByName(sheetName); var n = sh ? sh.getLastRow() : 0;
  if (n < 2) return [];
  return sh.getRange(2,1,n-1,1).getValues().map(function(r){ return String(r[0]||'').trim(); }).filter(String);
}
// מחליף את כל הרשימה (מסיר כפילויות, שומר סדר).
function writeNames_(sheetName, names){
  var sh = gsDb_().getSheetByName(sheetName);
  var seen = {}, out = [];
  (names||[]).forEach(function(x){ x = String(x||'').trim(); var k = x.toLowerCase(); if (x && !seen[k]){ seen[k]=1; out.push(x); } });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2,1,last-1,1).clearContent();
  if (out.length) sh.getRange(2,1,out.length,1).setValues(out.map(function(x){ return [x]; }));
  return out;
}
function readStudents_(){ return readNames_(SHEET_STUDENTS); }
function writeStudents_(names){ return writeNames_(SHEET_STUDENTS, names); }
function readFixed_(){ return readNames_(SHEET_FIXED); }
function writeFixed_(names){ return writeNames_(SHEET_FIXED, names); }

// ── סבבים (היסטוריה) ───────────────────────────────────────────
// עמודות: מזהה | תאריך התחלה | תאריך החלפה | זוגות(JSON) | קבוצה קבועה(JSON)
function readRounds_(){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS); var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2,1,n-1,5).getValues().filter(function(r){ return r[0]; }).map(function(r){
    var pairs = [], fixed = [];
    try { pairs = JSON.parse(r[3]); } catch(e){}
    try { fixed = JSON.parse(r[4]); } catch(e){}
    return { roundId:String(r[0]), start:String(r[1]), end:String(r[2]), groups:pairs, fixed:fixed };
  });
}
// שומר סבב חדש: תאריך התחלה = היום, תאריך החלפה = היום + ROTATION_MONTHS.
// הקבוצה הקבועה נשמרת כצילום-מצב (מי היה בה באותו זמן).
function saveRound_(pairs, fixed){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS);
  var id = 'R' + Utilities.getUuid().slice(0,8);
  var start = todayStr_();
  var end = addMonths_(start, ROTATION_MONTHS);
  sh.appendRow([id, start, end, JSON.stringify(pairs||[]), JSON.stringify(fixed||[])]);
  return id;
}
function deleteRound_(id){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS); var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++){ if (String(data[i][0])===id){ sh.deleteRow(i+1); return true; } }
  return false;
}
// עדכון ידני של הזוגות בסבב קיים (החלפת חברים בין זוגות), בלי לשנות את תאריכי הנעילה.
// עמודה 4 = זוגות(JSON). התאריכים (התחלה/החלפה) והקבוצה הקבועה נשארים כמות שהם.
function updateRound_(id, pairs){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS); var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++){ if (String(data[i][0])===id){ sh.getRange(i+1,4).setValue(JSON.stringify(pairs||[])); return true; } }
  return false;
}

// ── אלגוריתם השיבוץ ────────────────────────────────────────────
function pairKey_(a,b){ return a < b ? a+'|'+b : b+'|'+a; }
// כמה פעמים כל זוג היה יחד בעבר (רק בזוגות המתחלפים — הקבוצה הקבועה אינה נספרת).
function pairCounts_(rounds){
  var pc = {};
  (rounds||[]).forEach(function(rd){ (rd.groups||[]).forEach(function(g){
    for (var i=0;i<g.length;i++) for (var j=i+1;j<g.length;j++){ var k = pairKey_(g[i],g[j]); pc[k] = (pc[k]||0)+1; }
  }); });
  return pc;
}
function shuffle_(a){ for (var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
// כמה פעמים כל אדם כבר היה בשלישייה (קבוצה מוגדלת) — להוגנות בבחירת איש-השלישייה.
function trioCounts_(rounds){
  var tc = {};
  (rounds||[]).forEach(function(rd){ (rd.groups||[]).forEach(function(g){
    if (g.length > 2) g.forEach(function(n){ tc[n] = (tc[n]||0)+1; });
  }); });
  return tc;
}

// שיבוץ חכם לזוגות: מזעור חזרות (מעדיף לצרף את מי שהכי פחות היה עם בן-הזוג בעבר,
// שובר-שוויון אקראי). מספר אי-זוגי → שלישייה אחת, ואיש-השלישייה מתחלף בהוגנות
// (מי שהיה הכי פחות בשלישייה בעבר) כדי שאותו אדם לא ייתקע בשלישייה כל פעם.
function generatePairs_(names, rounds){
  var pc = pairCounts_(rounds);
  var pool = shuffle_((names||[]).slice());
  // אי-זוגי → מפרישים מראש את איש-השלישייה: זה שהיה הכי פחות בשלישייה (pool כבר מעורבב = שובר-שוויון).
  var extra = null;
  if (pool.length % 2 === 1){
    var tc = trioCounts_(rounds);
    var idx = 0, bestT = Infinity;
    for (var i=0;i<pool.length;i++){ var t = (tc[pool[i]]||0) + Math.random()*0.001; if (t < bestT){ bestT = t; idx = i; } }
    extra = pool.splice(idx,1)[0];
  }
  // בונים זוגות טהורים מהנותרים.
  var groups = [];
  while (pool.length){
    var a = pool.shift();
    var best = 0, bestScore = Infinity;
    for (var i=0;i<pool.length;i++){
      var s = (pc[pairKey_(pool[i], a)] || 0) + Math.random()*0.001;
      if (s < bestScore){ bestScore = s; best = i; }
    }
    groups.push([a, pool.splice(best,1)[0]]);
  }
  // משבצים את איש-השלישייה לזוג שאיתו היה הכי פחות (הופך אותו לשלישייה אחת).
  if (extra !== null){
    if (!groups.length){ groups.push([extra]); }
    else {
      var bi = 0, bscore = Infinity;
      for (var i=0;i<groups.length;i++){
        var s2 = 0; for (var j=0;j<groups[i].length;j++){ s2 += pc[pairKey_(extra, groups[i][j])] || 0; }
        s2 += Math.random()*0.001;
        if (s2 < bscore){ bscore = s2; bi = i; }
      }
      groups[bi].push(extra);
    }
  }
  return groups;
}

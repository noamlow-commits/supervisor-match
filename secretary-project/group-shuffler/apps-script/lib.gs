/**
 * lib.gs — גישה לנתונים + אלגוריתם השיבוץ החכם (מגוון, מצמצם חזרות).
 */
function gsDb_(){ var id = getDbId_(); if (!id) throw new Error('הריצו setup() תחילה'); return SpreadsheetApp.openById(id); }
function todayStr_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ── תלמידות ────────────────────────────────────────────────────
function readStudents_(){
  var sh = gsDb_().getSheetByName(SHEET_STUDENTS); var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2,1,n-1,1).getValues().map(function(r){ return String(r[0]||'').trim(); }).filter(String);
}
// מחליף את כל הרשימה (מסיר כפילויות, שומר סדר).
function writeStudents_(names){
  var sh = gsDb_().getSheetByName(SHEET_STUDENTS);
  var seen = {}, out = [];
  (names||[]).forEach(function(x){ x = String(x||'').trim(); var k = x.toLowerCase(); if (x && !seen[k]){ seen[k]=1; out.push(x); } });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2,1,last-1,1).clearContent();
  if (out.length) sh.getRange(2,1,out.length,1).setValues(out.map(function(x){ return [x]; }));
  return out;
}

// ── סבבים (היסטוריה) ───────────────────────────────────────────
function readRounds_(){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS); var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2,1,n-1,4).getValues().filter(function(r){ return r[0]; }).map(function(r){
    var g = []; try { g = JSON.parse(r[3]); } catch(e){}
    return { roundId:String(r[0]), date:String(r[1]), size:Number(r[2])||0, groups:g };
  });
}
function saveRound_(size, groups){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS);
  var id = 'R' + Utilities.getUuid().slice(0,8);
  sh.appendRow([id, todayStr_(), size, JSON.stringify(groups)]);
  return id;
}
function deleteRound_(id){
  var sh = gsDb_().getSheetByName(SHEET_ROUNDS); var data = sh.getDataRange().getValues();
  for (var i=1;i<data.length;i++){ if (String(data[i][0])===id){ sh.deleteRow(i+1); return true; } }
  return false;
}

// ── אלגוריתם השיבוץ ────────────────────────────────────────────
function pairKey_(a,b){ return a < b ? a+'|'+b : b+'|'+a; }
// כמה פעמים כל זוג היה יחד בעבר.
function pairCounts_(rounds){
  var pc = {};
  (rounds||[]).forEach(function(rd){ (rd.groups||[]).forEach(function(g){
    for (var i=0;i<g.length;i++) for (var j=i+1;j<g.length;j++){ var k = pairKey_(g[i],g[j]); pc[k] = (pc[k]||0)+1; }
  }); });
  return pc;
}
function shuffle_(a){ for (var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

// שיבוץ חכם: גרידי שמעדיף לצרף לכל קבוצה את מי שהכי פחות היה עם חבריה בעבר.
function generateGroups_(names, size, rounds){
  size = (Number(size) === 4) ? 4 : 2;
  var pc = pairCounts_(rounds);
  var pool = shuffle_((names||[]).slice());
  var groups = [];
  while (pool.length){
    var gsize = Math.min(size, pool.length);
    var group = [pool.shift()];
    while (group.length < gsize && pool.length){
      var best = 0, bestScore = Infinity;
      for (var i=0;i<pool.length;i++){
        var s = 0; for (var j=0;j<group.length;j++){ s += pc[pairKey_(pool[i], group[j])] || 0; }
        s += Math.random() * 0.001;   // שובר-שוויון אקראי
        if (s < bestScore){ bestScore = s; best = i; }
      }
      group.push(pool.splice(best,1)[0]);
    }
    groups.push(group);
  }
  // אם נותרה קבוצת-יחיד — ממזגים אותה לקבוצה הקודמת (קבוצה אחת בגודל שונה).
  if (groups.length > 1 && groups[groups.length-1].length === 1){
    var solo = groups.pop()[0];
    groups[groups.length-1].push(solo);
  }
  return groups;
}

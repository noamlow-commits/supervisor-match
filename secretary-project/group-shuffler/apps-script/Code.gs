/**
 * Code.gs — שרת ה-Web App (Apps Script). פרוס: Deploy → New deployment → Web app.
 */
function doGet(){
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('שיבוץ ללימוד בזוגות')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiData(){
  return JSON.stringify({
    students: readStudents_(),
    fixed: readFixed_(),
    rounds: readRounds_(),
    rotationMonths: ROTATION_MONTHS
  });
}
function apiSaveStudents(json){ return JSON.stringify({ students: writeStudents_(JSON.parse(json)) }); }
function apiSaveFixed(json){ return JSON.stringify({ fixed: writeFixed_(JSON.parse(json)) }); }

// שיבוץ זוגות: בריכת המשתתפים בלי מי שנמצא בקבוצה הקבועה (הגנה מפני שיבוץ כפול).
function apiGenerate(){
  var fixed = {}; readFixed_().forEach(function(x){ fixed[String(x).trim().toLowerCase()] = 1; });
  var pool = readStudents_().filter(function(x){ return !fixed[String(x).trim().toLowerCase()]; });
  return JSON.stringify({ groups: generatePairs_(pool, readRounds_()) });
}
// שמירת סבב: הזוגות שנוצרו + צילום-מצב של הקבוצה הקבועה כרגע.
function apiSaveRound(pairsJson){
  saveRound_(JSON.parse(pairsJson), readFixed_());
  return JSON.stringify({ ok:true, rounds: readRounds_() });
}
function apiDeleteRound(id){ deleteRound_(id); return JSON.stringify({ ok:true, rounds: readRounds_() }); }
// עדכון ידני של הזוגות בסבב קיים (החלפה ידנית אחרי העירבוב/הנעילה) — התאריכים נשמרים.
function apiUpdateRound(id, pairsJson){ updateRound_(id, JSON.parse(pairsJson)); return JSON.stringify({ ok:true, rounds: readRounds_() }); }

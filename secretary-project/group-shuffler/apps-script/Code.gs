/**
 * Code.gs — שרת ה-Web App (Apps Script). פרוס: Deploy → New deployment → Web app.
 */
function doGet(){
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('שיבוץ תלמידות לקבוצות')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiData(){ return JSON.stringify({ students: readStudents_(), rounds: readRounds_() }); }
function apiSaveStudents(json){ return JSON.stringify({ students: writeStudents_(JSON.parse(json)) }); }
function apiGenerate(size){ return JSON.stringify({ groups: generateGroups_(readStudents_(), size, readRounds_()) }); }
function apiSaveRound(size, groupsJson){
  saveRound_(Number(size), JSON.parse(groupsJson));
  return JSON.stringify({ ok:true, rounds: readRounds_() });
}
function apiDeleteRound(id){ deleteRound_(id); return JSON.stringify({ ok:true, rounds: readRounds_() }); }

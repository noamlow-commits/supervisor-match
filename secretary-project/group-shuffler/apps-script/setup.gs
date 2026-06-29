/**
 * setup.gs — הקמה חד-פעמית של ה-App DB. הריצו setup() פעם אחת.
 * נוצר גיליון חדש (אם אין), והמזהה נשמר ב-Script Properties.
 */
function setup(){
  var ss = getDbId_() ? SpreadsheetApp.openById(getDbId_())
                      : SpreadsheetApp.create('שיבוץ תלמידות — App DB');
  setDbId_(ss.getId());

  var st = ss.getSheetByName(SHEET_STUDENTS) || ss.insertSheet(SHEET_STUDENTS, 0);
  if (st.getLastRow() < 1){ st.getRange(1,1).setValue('שם').setFontWeight('bold'); st.setFrozenRows(1); st.setRightToLeft(true); }

  var rd = ss.getSheetByName(SHEET_ROUNDS) || ss.insertSheet(SHEET_ROUNDS);
  if (rd.getLastRow() < 1){ rd.getRange(1,1,1,4).setValues([['מזהה','תאריך','גודל','קבוצות']]).setFontWeight('bold'); rd.setFrozenRows(1); rd.setRightToLeft(true); }

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  Logger.log('✅ App DB מוכן: ' + ss.getUrl() + '\n(ה-id נשמר ב-Script Properties)');
  return ss.getId();
}

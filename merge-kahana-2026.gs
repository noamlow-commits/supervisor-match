/**
 * Merges the two ד"ר ברוך כהנא cards into the most recently updated one (Noam, 21.10.2026:
 * "all the data on the current card only").
 *
 * What it does, in this order:
 *   1. Finds the rows whose name contains כהנא. Refuses unless there are exactly two.
 *   2. KEEPER = the row with the later `updated` date; the other row is the DUPLICATE.
 *   3. Fills a field of the keeper ONLY when the keeper's cell is empty and the duplicate's is not.
 *      A field filled in both with different values is never touched — it is only reported by name.
 *   4. Points every student placed with the duplicate's token at the keeper's token
 *      (Students.placedWith; placedDate is left as it was).
 *   5. Deletes the duplicate row — only if no student still points at it afterwards.
 *
 * Safe to run twice: the second run finds one row and stops. The log names no student, token,
 * email or phone — only counts and field names.
 *
 *   previewMergeKahana2026()  — prints what WOULD happen, writes nothing. Run this first.
 *   applyMergeKahana2026()    — does it.
 */
function previewMergeKahana2026() { return mergeKahana2026_(false); }
function applyMergeKahana2026()   { return mergeKahana2026_(true); }

function mergeKahana2026_(apply) {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });
  var norm = function (v) { return String(v == null ? '' : v).replace(/["'״׳`‎‏]/g, '').replace(/\s+/g, ' ').trim(); };
  var blank = function (v) { var s = String(v == null ? '' : v).trim(); return s === '' || s === '{}'; };
  var out = [apply ? '=== איחוד כרטיסי כהנא — ביצוע ===' : '=== איחוד כרטיסי כהנא — תצוגה מקדימה, לא נכתב כלום ==='];

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (norm(data[i][col.fullName]).indexOf('כהנא') >= 0) rows.push({ rowNum: i + 1, vals: data[i] });
  }
  if (rows.length !== 2) {
    out.push('נמצאו ' + rows.length + ' שורות עם "כהנא" (צריך בדיוק 2) — לא עושים כלום.');
    Logger.log(out.join('\n')); return out.join('\n');
  }

  var when = function (r) { var t = Date.parse(String(r.vals[col.updated] || '')); return isNaN(t) ? 0 : t; };
  rows.sort(function (a, b) { return when(b) - when(a); });
  var keeper = rows[0], dup = rows[1];
  var tok = function (r) { return String(r.vals[col.token] || '').trim(); };
  if (!tok(keeper) || !tok(dup) || tok(keeper) === tok(dup)) {
    out.push('טוקן ריק או משותף — עצירה.');
    Logger.log(out.join('\n')); return out.join('\n');
  }
  out.push('הכרטיס העדכני (נשמר): שורה ' + keeper.rowNum + ' · הכרטיס הישן (יימחק): שורה ' + dup.rowNum);

  // 3. fill gaps only; report conflicts
  var SKIP = { token: 1, created: 1, updated: 1, published: 1, hasSpot: 1, mailed: 1, archived: 1, cardType: 1, studentsAccepted: 1 };
  var fills = [], conflicts = [];
  headers.forEach(function (h) {
    if (SKIP[h]) return;
    var k = keeper.vals[col[h]], d = dup.vals[col[h]];
    if (blank(d)) return;
    if (blank(k)) fills.push(h);
    else if (String(k).trim() !== String(d).trim()) conflicts.push(h);
  });
  out.push('שדות שימולאו בכרטיס העדכני מהישן (היו ריקים): ' + (fills.join(', ') || '(אין)'));
  out.push('שדות שמולאו בשניהם בערך שונה (נשארים כמו בעדכני, לא נוגעים): ' + (conflicts.join(', ') || '(אין)'));

  // 4. students
  var stu = sheet.getParent().getSheetByName(TAB_STUDENTS);
  var sdata = stu.getDataRange().getValues();
  var pcol = sdata[0].indexOf('placedWith');
  if (pcol < 0) { out.push('אין עמודת placedWith — עצירה.'); Logger.log(out.join('\n')); return out.join('\n'); }
  var toMove = [];
  for (var s = 1; s < sdata.length; s++) if (String(sdata[s][pcol] || '').trim() === tok(dup)) toMove.push(s + 1);
  var alreadyOnKeeper = 0;
  for (var s2 = 1; s2 < sdata.length; s2++) if (String(sdata[s2][pcol] || '').trim() === tok(keeper)) alreadyOnKeeper++;
  out.push('תלמידים משובצים לישן (יועברו): ' + toMove.length + ' · כבר משובצים לעדכני: ' + alreadyOnKeeper +
           ' · סה"כ אחרי האיחוד: ' + (toMove.length + alreadyOnKeeper));
  var cap = keeper.vals[col.maxStudents];
  out.push('קיבולת בכרטיס העדכני (maxStudents): ' + (blank(cap) ? '(ריקה — בלי הגבלה)' : cap) +
           (!blank(cap) && toMove.length + alreadyOnKeeper >= Number(cap) ? ' ← שים לב: מלא, התלמידים לא יראו אותו גם עם מתג פתוח' : ''));

  if (!apply) {
    out.push('');
    out.push('לא נכתב כלום. כדי לבצע: Run ▸ applyMergeKahana2026');
    Logger.log(out.join('\n')); return out.join('\n');
  }

  fills.forEach(function (h) {
    var cell = sheet.getRange(keeper.rowNum, col[h] + 1);
    if (h === 'phone') { cell.setNumberFormat('@'); cell.setValue(String(dup.vals[col[h]])); }
    else cell.setValue(dup.vals[col[h]]);
  });
  toMove.forEach(function (rn) { stu.getRange(rn, pcol + 1).setValue(tok(keeper)); });
  SpreadsheetApp.flush();

  var left = 0, sd2 = stu.getDataRange().getValues();
  for (var q = 1; q < sd2.length; q++) if (String(sd2[q][pcol] || '').trim() === tok(dup)) left++;
  if (left > 0) {
    out.push('נשארו ' + left + ' תלמידים משובצים לישן — לא מוחקים את הכרטיס הישן.');
  } else {
    sheet.deleteRow(dup.rowNum);
    out.push('הועברו ' + toMove.length + ' תלמידים, מולאו ' + fills.length + ' שדות, והכרטיס הישן נמחק.');
  }
  Logger.log(out.join('\n')); return out.join('\n');
}

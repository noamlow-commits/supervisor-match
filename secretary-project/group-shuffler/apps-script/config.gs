/**
 * config.gs — שיבוץ תלמידות לקבוצות (תת-פרויקט של secretary-project).
 * מזהה ה-App DB נשמר ב-Script Properties (עמיד בהדבקת config מחדש).
 */
var SHEET_STUDENTS = 'תלמידות';
var SHEET_ROUNDS   = 'סבבים';

function getDbId_(){ return PropertiesService.getScriptProperties().getProperty('GS_DB_ID') || ''; }
function setDbId_(id){ if (id) PropertiesService.getScriptProperties().setProperty('GS_DB_ID', id); }

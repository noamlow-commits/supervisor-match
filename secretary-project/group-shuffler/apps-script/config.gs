/**
 * config.gs — שיבוץ ללימוד בזוגות (תת-פרויקט של secretary-project).
 * מזהה ה-App DB נשמר ב-Script Properties (עמיד בהדבקת config מחדש).
 *
 * מודל: הלימוד בזוגות. יש "קבוצה קבועה" (הגברים) שאינה מתחלפת ומוצגת בכל סבב
 * כקבוצה אחת. שאר המשתתפים משובצים לזוגות רנדומליים, עם מזעור חזרות, ומתחלפים
 * אחת ל-ROTATION_MONTHS חודשים.
 */
var SHEET_STUDENTS = 'תלמידות';       // בריכת המשתתפים שמשובצים בזוגות (מתחלפים)
var SHEET_FIXED    = 'קבוצה קבועה';   // הגברים — קבוצה שאינה מתחלפת
var SHEET_ROUNDS   = 'סבבים';         // היסטוריית סבבים

var PAIR_SIZE       = 2;   // הלימוד בזוגות
var ROTATION_MONTHS = 2;   // כל זוג (מלבד הקבוצה הקבועה) מתחלף אחת לחודשיים

function getDbId_(){ return PropertiesService.getScriptProperties().getProperty('GS_DB_ID') || ''; }
function setDbId_(id){ if (id) PropertiesService.getScriptProperties().setProperty('GS_DB_ID', id); }

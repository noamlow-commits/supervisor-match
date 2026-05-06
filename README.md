# מאגר מדריכי הדרכה — בית הספר הדיאלוגי

אפליקציית web לשידוך בין מדריכים לתלמידים. דירקטוריון של ~16 מדריכים, ~10-30 תלמידים, פעם-פעמיים בשנה.

**🔗 אתר חי:** https://noamlow-commits.github.io/supervisor-match/

## חמשת המסכים

| מסך | למי | URL |
|---|---|---|
| `index.html` | תלמידים — דירקטוריון + סינון | `/` |
| `supervisor.html` | מדריך — עריכת פרופיל אישי | `/supervisor.html?token=...` |
| `register.html` | מדריך חדש — הרשמה עצמית | `/register.html` |
| `claim.html` | מדריך עם פרופיל מוכן (לרוב מבוגרים) — כניסה ע״י שם+מייל | `/claim.html` |
| `admin.html` | מזכירה אקדמית + צוות הניהול — דשבורד | `/admin.html` |

## שלוש דרכי כניסה למדריכים

### דרך A — הרשמה עצמית (`register.html`)
מדריך חדש מקבל קוד הזמנה (`CFGUSH26`), נרשם לבד, מקבל מייל עם קישור אישי.

### דרך B — כניסה לפרופיל מוכן (`claim.html`)
**מותאם למדריכים מבוגרים שמתקשים למלא טופס.** הצוות יוצר פרופיל מראש, המדריך נכנס עם שם+מייל בלבד.

### דרך C — קישור אישי במייל
המדריך פותח את הקישור האישי שקיבל ועורך ישירות.

## הקמה — צעד-צעד

### 1. צור Google Sheet חדש
פתח https://sheets.google.com → גיליון חדש בשם "מאגר מדריכים".

### 2. הדבק את קוד ה-Apps Script
Extensions → Apps Script → מחק הקוד הקיים → הדבק `apps-script-code.js` → שמור.

### 3. הרץ setupSheets פעם אחת
תפריט הפונקציות → `setupSheets` → Run → אשר הרשאות.
נוצרים 4 טאבים: `Supervisors`, `Parameters`, `Settings`, `BulkImport`.

### 4. פרסם כ-Web App
Deploy → New deployment → ⚙ → Web app → Execute as: **Me**, Who has access: **Anyone** → Deploy → העתק URL (גומר ב-`/exec`).

### 5. הגדר את appBaseUrl ב-Sheet
Settings → `appBaseUrl` → `https://noamlow-commits.github.io/supervisor-match/`

### 6. חבר את האפליקציה ל-Backend
פתח כל אחד מהדפים → ⚙ בפינה השמאלית → הדבק URL.

## ייבוא בכמות (Bulk Import) — שני שלבים

### Phase 1: יצירה שקטה
1. ב-Sheet → טאב **BulkImport** — מלא/י שורה לכל מדריך (או הרץ/י `seedHadialogyDirectory` שמכין את 16 המדריכים מאתר בית הספר)
2. הרץ/י `bulkImportSilent()` ב-Apps Script
3. נוצרים פרופילים ב-Supervisors עם `mailed=FALSE`. **לא נשלחים מיילים עדיין**

### Phase 2: השלמה ידנית (אופציונלית)
לפני שמודיעים למדריכים, אפשר למלא ידנית את הפרופיל של המדריכים המבוגרים בטאב Supervisors. כך הם נכנסים לפרופיל מוכן ולא לטופס ריק.

### Phase 3: שליחת הזמנות
הרץ/י `sendInvitationsToUnmailed()` — שולח מייל רק לאלה ש-`mailed=FALSE`, ומסמן TRUE.
**אפשר להריץ פעמים רבות**: רק שורות עם `mailed=FALSE` יקבלו מייל.

### עמודות BulkImport
| עמודה | חובה | דוגמה |
|---|---|---|
| imported | אוטומטי | (FALSE/empty) |
| fullName | ✓ | ד״ר ישראל ישראלי |
| email | ✓ | israel@example.com |
| credential | מומלץ | פסיכולוג קליני, MA |
| yearsSupervising | מומלץ | 15 |
| orientations | מומלץ | דינאמי;CBT |
| populations | מומלץ | מבוגרים;נוער |
| specialties | מומלץ | טראומה;חרדה ודיכאון |
| styleText | מומלץ | תיאור הסגנון (50-400 תווים) |
| format | מומלץ | היברידי |
| area | מומלץ | ירושלים |
| phone | מומלץ | 0501234567 |
| whatsappEnabled | אופציונלי | TRUE/FALSE |
| hasSpot | אופציונלי | TRUE (ברירת מחדל) |
| autoPublish | אופציונלי | TRUE = פרסם מיד / FALSE = השאר טיוטה |

## שדרוג מ-v1 / v2

`migrateToV2()` עושה:
- מעדכן רשימת `orientations` ל-6 הסוגים החדשים
- ממפה אוריינטציות ישנות (פסיכודינמי → דינאמי וכו׳)
- מוסיף `adminPin`, `expectedStudents` ל-Settings
- מוסיף עמודות `studentsAccepted`, `mailed` ל-Supervisors (רשומות קיימות מקבלות `mailed=TRUE` אוטומטית כדי למנוע ספאם חוזר)
- יוצר טאב `BulkImport`

**⚠ אחרי כל שינוי קוד** — חובה לפרוס מחדש: Deploy → Manage deployments → ✏ → New version → Deploy.

## הגדרות (טאב Settings)

| מפתח | ברירת מחדל | תפקיד |
|---|---|---|
| classPin | 2026 | קוד גישה לתלמידים |
| registrationCode | CFGUSH26 | קוד הזמנה למדריכים חדשים |
| **adminPin** | **cfgush26admin** | **סיסמת המזכירה** ⚠ שנה/י לפני שיתוף |
| **expectedStudents** | **25** | סך התלמידים הצפויים השנה |
| schoolName | בית הספר הדיאלוגי | שם בית הספר במייל |
| season | 2026 | עונה נוכחית |
| appBaseUrl | _ריק_ | URL בסיסי של האתר |

## דשבורד הנהלה (admin.html)

מסך **רק** למזכירה אקדמית. מוגן ב-`adminPin`.
- כרטיסי סיכום: סך מדריכים, תלמידים שובצו, ממתינים, מקומות פנויים
- סרגל התקדמות שיבוץ באחוזים
- טבלת מדריכים עם מספר תלמידים אצל כל אחד

**מי רואה מה:**
- תלמיד: רק "יש מקום / אין מקום"
- מדריך: רק את המספר של עצמו
- מזכירה: הכל

## עריכת פרמטרים בלי קוד
טאב Parameters ב-Sheet — `שדה | אפשרות`. שינויים נכנסים בריענון.
פרמטרים: orientations, populations, specialties, formats, areas

## שדות בפרופיל מדריך

### חובה (11)
1. שם מלא  2. תואר/הסמכה  3. שנות הדרכה
4. **סוגי טיפול:** דינאמי / CBT / טיפול ממוקד טראומה - SE/EMDR / טיפול זוגי / מיניות / התמכרויות
5. אוכלוסיות  6. תחומי התמחות (עד 5)
7. על הסגנון (50-400 תווים)
8. פורמט  9. אזור (אם רלוונטי)  10. זמינות שבועית
11. סטטוס מקומות

### דרכי קשר
טלפון נייד + checkbox WhatsApp / מייל

### שדה ניהול (פרטי, רק למזכירה)
כמה תלמידים אישרת לקבל השנה

## באגים ידועים

**Google Sheets ממיר טלפון למספר ומאבד אפס מוביל** — פתרון: `setNumberFormat('@')` לפני שמירה. **חובה לפרוס מחדש לאחר שינוי קוד.**

**"Could not establish connection"** — שגיאות מהרחבות דפדפן, לא קשורות.

## Stack
HTML/CSS/JS סטטי + Google Apps Script + Google Sheets + GitHub Pages.
פונט: Assistant. אין build, אין npm. API: GET + fetch() עם 12s timeout.

## עקרונות עיצוב
- דירקטוריון, לא מנוע שידוך
- מינימום התערבות צוות
- אין פופולריות (תלמידים לא רואים מונים, מדריכים לא רואים אחד את השני)
- מובייל-first
- שלוש דרכי כניסה למדריכים, מותאמות לרמות נוחות שונות
- ייבוא דו-שלבי (יצירה → השלמה → הזמנה) לבקרה מלאה של הצוות

## דמו vs חי
- דמו (אין URL): localStorage + מדריכי דמו, תווית "דמו"
- חי (URL מוגדר): Google Sheet, מיילים אמיתיים, ללא תווית

## גרסאות
- **v1** — דירקטוריון בסיסי + הרשמה עצמית
- **v2** — דשבורד הנהלה, סוגי טיפול מפושטים, studentsAccepted, מיגרציה
- **v2.1** — claim.html + bulk import
- **v2.2** — seedHadialogyDirectory + ייבוא דו-שלבי שקט (mailed column)

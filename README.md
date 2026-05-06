# מאגר מדריכי הדרכה — בית הספר הדיאלוגי

אפליקציית web לשידוך בין מדריכים לתלמידים. דירקטוריון של ~10 מדריכים, ~10-30 תלמידים, פעם-פעמיים בשנה. תלמיד מסנן, צופה, יוצר קשר ישיר עם המדריך.

**🔗 אתר חי:** https://noamlow-commits.github.io/supervisor-match/

## ארבעת המסכים

| מסך | למי | URL |
|---|---|---|
| `index.html` | תלמידים — דירקטוריון + סינון | `/` |
| `supervisor.html` | מדריכים — עריכת פרופיל אישי | `/supervisor.html?token=...` |
| `register.html` | מדריכים חדשים — הרשמה עצמית | `/register.html` |
| `admin.html` | מזכירה אקדמית + צוות הניהול — דשבורד | `/admin.html` |

## הקמה — צעד-צעד

### 1. צור Google Sheet חדש
פתח https://sheets.google.com → גיליון חדש בשם "מאגר מדריכים".

### 2. הדבק את קוד ה-Apps Script
- Extensions → Apps Script
- מחק את הקוד שמופיע ב-Code.gs
- העתק את apps-script-code.js והדבק
- שמור (Ctrl+S)

### 3. הרץ setupSheets פעם אחת
- בחר setupSheets בתפריט הפונקציות → Run
- אשר הרשאות (Review permissions → Advanced → Allow)
- ב-Sheet נוצרו 3 טאבים: Supervisors, Parameters, Settings

### 4. פרסם כ-Web App
- Deploy → New deployment → ⚙ → Web app
- Execute as: **Me**
- Who has access: **Anyone** (חשוב!)
- Deploy → העתק את ה-URL (גומר ב-`/exec`)

### 5. הגדר את appBaseUrl ב-Sheet
בטאב Settings, שורת appBaseUrl → שים את ה-URL של האתר:
`https://noamlow-commits.github.io/supervisor-match/`

### 6. חבר את האפליקציה ל-Backend
פתח כל אחד מהדפים, לחץ ⚙ בפינה השמאלית, הדבק את ה-URL:
- index.html
- supervisor.html
- register.html
- admin.html

### 7. בדיקה מקצה לקצה
1. תלמיד: index.html → קוד `2026` → גלריה ריקה
2. רישום: register.html → קוד `CFGUSH26` → שם+מייל → מייל אוטומטי
3. עריכה: פתח קישור אישי → מלא הכל → "פרסם"
4. דשבורד: admin.html → סיסמה `cfgush26admin` → רואים סטטיסטיקות

## שדרוג מ-v1 (אם יש מדריכים קיימים)

אם הקמת קודם והגיליון כבר מלא:
1. החלף את `apps-script-code.js` ב-Apps Script editor (Code.gs)
2. הרץ ידנית את `migrateToV2()` (במקום `setupSheets`)
3. **חובה לפרסם מחדש:** Deploy → Manage deployments → ✏ → New version → Deploy
4. הפעולה תעדכן:
   - Parameters: רשימת orientations החדשה (6 סוגי טיפול)
   - מיפוי אוטומטי של אוריינטציות ישנות (פסיכודינמי → דינאמי וכו׳)
   - הוספת `adminPin` ו-`expectedStudents` ל-Settings
   - הוספת עמודה `studentsAccepted` ל-Supervisors

## הגדרות (טאב Settings)

| מפתח | ברירת מחדל | תפקיד |
|---|---|---|
| classPin | 2026 | קוד גישה לתלמידים (index.html) |
| registrationCode | CFGUSH26 | קוד הזמנה למדריכים (register.html) |
| **adminPin** | **cfgush26admin** | **סיסמה למזכירה אקדמית (admin.html)** ⚠ שנה/י לפני שיתוף |
| **expectedStudents** | **25** | **סך התלמידים הצפויים השנה (לחישוב התקדמות)** |
| schoolName | בית הספר הדיאלוגי | שם בית הספר במייל |
| season | 2026 | עונה נוכחית |
| appBaseUrl | _ריק_ | URL בסיסי של האתר |

## דשבורד הנהלה (admin.html)

מסך **רק** למזכירה אקדמית ולצוות הניהול. מוגן בסיסמה (`adminPin`).

### מה רואים בדשבורד
- **כרטיסי סיכום:**
  - סך מדריכים + כמה מהם מפורסמים
  - תלמידים שובצו / מתוך הצפויים
  - תלמידים ממתינים לשיבוץ
  - מקומות פנויים (מדריכים עם "יש מקום")
- **סרגל התקדמות:** אחוז שיבוץ
- **טבלה מפורטת:** שם המדריך, מספר תלמידים, מקום פנוי, סטטוס פרסום, פרטי קשר

### איך זה עובד
- כל מדריך מעדכן בעצמו ב-supervisor.html שדה "כמה תלמידים אישרת לקבל השנה"
- המספר הזה **לא נראה** לתלמידים או למדריכים אחרים — רק במסך הניהול
- המזכירה מגדירה את `expectedStudents` ב-Settings (סך התלמידים הצפויים)

### חשוב: מי רואה מה
- **תלמיד:** לא רואה כמה תלמידים יש לכל מדריך, רק "יש מקום / אין מקום"
- **מדריך:** רואה רק את המספר של עצמו
- **מזכירה:** רואה הכל

## עריכת פרמטרים בלי קוד
- טאב Parameters ב-Sheet — כל שורה: `שדה | אפשרות`
- להוספה: שורה חדשה (`specialties | OCD`)
- להסרה: מחק את השורה
- שינויים נכנסים לתוקף בריענון
- פרמטרים נתמכים: orientations, populations, specialties, formats, areas

## שדות בפרופיל מדריך

### חובה (11 שדות)
1. שם מלא  2. תואר/הסמכה  3. שנות הדרכה
4. **סוגי טיפול** (רב-בחירה): דינאמי, CBT, טיפול ממוקד טראומה - SE/EMDR, טיפול זוגי, מיניות, התמכרויות
5. אוכלוסיות (רב-בחירה)  6. תחומי התמחות (עד 5)
7. על הסגנון שלי (50-400 תווים)
8. פורמט  9. אזור (אם רלוונטי)  10. זמינות שבועית
11. סטטוס מקומות (יש/אין)

### דרכי קשר (לפחות אחת)
- טלפון נייד + checkbox "אני זמין/ה גם ב-WhatsApp"
- מייל

### שדה ניהול (פרטי, רק למזכירה)
- כמה תלמידים אישרת לקבל השנה (מספר)

## באגים ידועים ופתרונות

### Google Sheets ממיר טלפון למספר ומאבד אפס מוביל
**פתרון בקוד:** `cell.setNumberFormat('@')` לפני שמירת טלפון.
**חשוב:** אחרי שינוי הקוד צריך Deploy → Manage deployments → ✏ → New version → Deploy.

### "Could not establish connection" בקונסול
שגיאות מהרחבות דפדפן — לא קשורות.

## Stack
- HTML/CSS/JS סטטי, אין build, אין npm
- פונט: Assistant (Google Fonts)
- Backend: Google Apps Script + Sheets
- API: GET + fetch() עם 12s timeout

## עקרונות עיצוב
- דירקטוריון, לא מנוע שידוך
- מינימום התערבות צוות (הוסף דשבורד צפייה — הצוות לא צריך לעשות פעולות)
- אין פופולריות (תלמידים לא רואים מונים)
- פלטה רגועה, מובייל-first

## דמו vs חי
- **דמו** (אין URL): localStorage + נתוני דמו, תווית "דמו" בכותרת
- **חי** (URL מוגדר): Google Sheet, מיילים אמיתיים, ללא תווית

## לוגואים
מקור: https://www.jewishpsychology.org/hadialogy/
- `logo-school.webp` — בית הספר הדיאלוגי
- `logo-rotenberg.webp` — מכון רוטנברג

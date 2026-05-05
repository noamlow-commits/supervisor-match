# מאגר מדריכי הדרכה — בית הספר הדיאלוגי

אפליקציית web לשידוך בין מדריכים לתלמידים בבית ספר לפסיכותרפיה. דירקטוריון של ~10 מדריכים, ~10-30 תלמידים, פעם-פעמיים בשנה. תלמיד מסנן, צופה, יוצר קשר ישיר עם המדריך.

**🔗 אתר חי:** https://noamlow-commits.github.io/supervisor-match/

## קבצים
- `index.html` — מסך תלמיד (דירקטוריון + סינון)
- `supervisor.html` — מסך מדריך (עריכת פרופיל)
- `register.html` — הרשמת מדריך חדש
- `apps-script-code.js` — קוד Apps Script ל-Google Sheets
- `logo-school.webp` / `logo-rotenberg.webp` — לוגואים

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
- פתח index.html בדפדפן
- לחץ ⚙ בפינה השמאלית התחתונה
- הדבק את ה-URL מ-שלב 4
- חזור על אותו תהליך ב-supervisor.html וב-register.html

### 7. בדיקה מקצה לקצה
1. תלמיד: index.html → קוד 2026 → גלריה ריקה
2. רישום: register.html → קוד CFGUSH26 → שם+מייל → קישור אישי + מייל אוטומטי
3. עריכה: פתח קישור אישי → מלא הכל → "פרסם"
4. חזור לתלמיד: רענן → המדריך מופיע

## בדיקה ידנית של ה-Apps Script

הזן בדפדפן (תחליף את ה-URL הבסיסי):
```
https://script.google.com/macros/s/AKfycb.../exec?action=verifyClassPin&pin=2026
```
תוצאה תקינה: `{"valid":true}` כ-JSON.

## הגדרות (טאב Settings)
| מפתח | ברירת מחדל | למה |
|---|---|---|
| classPin | 2026 | קוד גישה לתלמידים |
| registrationCode | CFGUSH26 | קוד הזמנה למדריכים |
| schoolName | בית הספר הדיאלוגי | שם בית הספר במייל |
| season | 2026 | עונה נוכחית |
| appBaseUrl | _ריק_ | URL בסיסי של האתר |

## עריכת פרמטרים בלי קוד
- טאב Parameters ב-Sheet — כל שורה: `שדה | אפשרות`
- להוספה: שורה חדשה (`specialties | OCD`)
- להסרה: מחק את השורה
- שינויים נכנסים לתוקף בריענון
- פרמטרים נתמכים: orientations, populations, specialties, formats, areas

## שדות בפרופיל מדריך (11 חובה)
1. שם מלא  2. תואר/הסמכה  3. שנות הדרכה
4. אוריינטציה (רב-בחירה)  5. אוכלוסיות  6. התמחויות (עד 5)
7. על הסגנון שלי (50-400 תווים)
8. פורמט  9. אזור (אם רלוונטי)  10. זמינות שבועית
11. סטטוס מקומות (יש/אין)

**דרכי קשר (לפחות אחת):** טלפון נייד + checkbox WhatsApp / מייל

## באגים ידועים ופתרונות

### Google Sheets ממיר טלפון למספר ומאבד אפס מוביל
**סימפטום:** מדריך הזין `0548317031`, ב-Sheet מופיע `548317031`, קליק על הכרטיס נכשל.

**פתרון מובנה בקוד:** `apps-script-code.js` מכיל `cell.setNumberFormat('@')` לפני שמירת טלפון. **חשוב:** אחרי שמשנים את הקוד צריך Deploy → Manage deployments → ✏ → New version → Deploy.

**תיקון מדריכים שכבר נרשמו לפני התיקון:** ב-Sheet → Supervisors → תאי טלפון → הקלד מחדש עם גרש בהתחלה: `'0548317031`

### "Could not establish connection" בקונסול
שגיאות מהרחבות דפדפן (UUID-named files, VM_injected.js). לא קשורות לאפליקציה.

## Stack
- HTML/CSS/JS סטטי, אין build, אין npm
- פונט: Assistant (Google Fonts)
- Backend: Google Apps Script + Sheets
- API: GET + fetch() עם 12s timeout
- אחסון URL של Apps Script: localStorage של הדפדפן

## עקרונות עיצוב
- דירקטוריון, לא מנוע שידוך
- מינימום התערבות צוות
- אין פופולריות (מונים/דירוגים)
- פלטה רגועה, מובייל-first
- פרמטרים דינמיים מ-Sheet

## דמו vs חי
- **דמו** (אין URL): localStorage + 8 מדריכי דמו, תווית "דמו" בכותרת
- **חי** (URL מוגדר): Google Sheet, מיילים אמיתיים, ללא תווית

## לוגואים
מקור: https://www.jewishpsychology.org/hadialogy/
- `logo-school.webp` (149×149) — בית הספר הדיאלוגי, מופיע בכותרת
- `logo-rotenberg.webp` (284×52) — מכון רוטנברג, מופיע ב"מבית" footer

## פריסה ל-GitHub Pages
```bash
git push origin main
```
GitHub Pages מוגדר לטעון מ-`main / root`. כל push מפעיל build תוך ~1-2 דקות.

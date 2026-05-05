# מאגר מדריכי הדרכה — בית הספר לפסיכותרפיה

אפליקציית web לשידוך בין מדריכים לתלמידים. דירקטוריון של ~10 מדריכים, ~10-30 תלמידים, פעם-פעמיים בשנה.

## קבצים
- index.html — מסך תלמיד (דירקטוריון + סינון)
- supervisor.html — מסך מדריך (עריכת פרופיל)
- register.html — הרשמת מדריך חדש
- apps-script-code.js — קוד Apps Script ל-Google Sheets

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
- Execute as: Me
- Who has access: Anyone (חשוב!)
- Deploy → העתק את ה-URL

### 5. הגדר את appBaseUrl ב-Sheet
בטאב Settings, שורת appBaseUrl → שים את ה-URL של האתר:
https://noamlow-commits.github.io/supervisor-match/

### 6. חבר את האפליקציה ל-Backend
- פתח index.html בדפדפן
- לחץ ⚙ בפינה השמאלית התחתונה
- הדבק את ה-URL מ-שלב 4
- חזור על אותו תהליך ב-supervisor.html וב-register.html

### 7. בדיקה מקצה לקצה
1. תלמיד: index.html → קוד 2026 → גלריה ריקה
2. רישום: register.html → קוד CFGUSH26 → שם+מייל → קישור אישי + מייל
3. עריכה: פתח קישור אישי → מלא הכל → "פרסם"
4. חזור לתלמיד: רענן index.html → המדריך מופיע

## הגדרות (טאב Settings)
| מפתח | ברירת מחדל | למה |
|---|---|---|
| classPin | 2026 | קוד גישה לתלמידים |
| registrationCode | CFGUSH26 | קוד הזמנה למדריכים |
| schoolName | בית הספר לפסיכותרפיה | שם בית הספר במייל |
| season | 2026 | עונה נוכחית |
| appBaseUrl | _ריק_ | URL בסיסי של האתר |

## עריכת פרמטרים בלי קוד
- טאב Parameters ב-Sheet
- כל שורה: שדה | אפשרות
- להוספה: שורה חדשה (specialties | OCD)
- להסרה: מחק את השורה
- שינויים נכנסים לתוקף בריענון
- פרמטרים נתמכים: orientations, populations, specialties, formats, areas

## שדות בפרופיל מדריך
**חובה (11):** שם / תואר / שנות הדרכה / אוריינטציה / אוכלוסיות / התמחויות / על הסגנון / פורמט / אזור / זמינות / סטטוס מקומות.

**דרכי קשר (לפחות אחת):** טלפון נייד + checkbox WhatsApp / מייל.

## Stack
- HTML/CSS/JS סטטי, אין build
- פונט: Assistant
- Backend: Google Apps Script + Sheets
- API: GET + fetch()

## דמו vs חי
- **דמו** (אין URL): localStorage + 8 מדריכי דמו, תווית "דמו" בכותרת
- **חי** (URL מוגדר): Google Sheet, מיילים אמיתיים

## URL חי
- אפליקציה: https://noamlow-commits.github.io/supervisor-match/
- ריפו: https://github.com/noamlow-commits/supervisor-match

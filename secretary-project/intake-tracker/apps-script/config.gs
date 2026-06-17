/**
 * config.gs — מקור-אמת יחיד לקונפיגורציה ולסכמה.
 * משותף ל-setup.gs / importer.gs / Code.gs.
 *
 * אופציה ב' (מסירה): מדביקים את כל קבצי ה-.gs לפרויקט Apps Script אחד
 * תחת חשבון מכון רוטנברג, ממלאים את שני המזהים למטה, ומריצים setup() פעם אחת.
 */

// ── מזהי גיליונות ─────────────────────────────────────────────
// הקובץ החי של המזכירה — קריאה בלבד. לעולם לא כותבים אליו.
var LIVE_FILE_ID = '1aOC9sxUJt_O_f6v1EoxglQI7jUF3l3mMew5czeQAkzY';

// ה-App DB החדש — נוצר ע"י setup() ואז מדביקים כאן את ה-id שהוא מדפיס.
// (אפשר להשאיר ריק בהרצה ראשונה; setup() יזהה ויצור.)
var APP_DB_ID = '';

// ── פרמטרים ───────────────────────────────────────────────────
var SHEET_INQUIRIES = 'פניות';
var SHEET_LOOKUPS    = 'רשימות';
var SHEET_TEMPLATES  = 'תבניות';
var REMINDER_DAYS    = 14;   // ליד ללא עדכון מעבר לזה → "צריך תזכורת"

// לשוניות בקובץ החי שלא לייבא כלל
var SKIP_TABS = ['מרצים', 'קישורים', 'תבניות', 'הוראות', 'כללי'];
// לשוניות שמיובאות כ"רשימת אנשי-קשר" (לא משפך) — recordType=איש-קשר
var CONTACT_TABS = ['אנשי חינוך', 'אנשי קשר'];

// סכומי ברירת מחדל (מתוך קישורי Cardcom בקובץ)
var FEE_REGISTRATION = 300;
var FEE_DEPOSIT      = 1200;

// ── סכמת טבלת "פניות" ─────────────────────────────────────────
// key  = שם פנימי (לקוד)            header = כותרת בעברית בגיליון
// type = string|bool|date|number    group  = לקיבוץ בממשק
// computed=true → לא להקלדה (מחושב). aug=true → שדה-הרחבה של האפליקציה (לא נדרס בייבוא).
var SCHEMA = [
  // זיהוי
  {key:'id',            header:'מזהה',            type:'string', group:'זיהוי'},
  {key:'recordType',    header:'סוג רשומה',       type:'string', group:'זיהוי', options:['פנייה','איש-קשר']},
  {key:'program',       header:'תוכנית',          type:'string', group:'זיהוי'},
  {key:'cycle',         header:'מחזור',           type:'string', group:'זיהוי'},
  {key:'inquiryDate',   header:'תאריך פנייה',     type:'date',   group:'זיהוי'},
  {key:'channel',       header:'ערוץ פנייה',      type:'string', group:'זיהוי', options:['אתר','טלפון','וואטסאפ','המלצה','אחר']},
  {key:'crmCode',       header:'קוד לקוח',        type:'string', group:'זיהוי'},
  // קשר
  {key:'name',          header:'שם',              type:'string', group:'קשר'},
  {key:'phone',         header:'טלפון',           type:'string', group:'קשר'},
  {key:'email',         header:'דואל',            type:'string', group:'קשר'},
  {key:'city',          header:'מגורים',          type:'string', group:'קשר'},
  {key:'occupation',    header:'עיסוק',           type:'string', group:'קשר'},
  // סף קבלה
  {key:'hasMA',         header:'תואר שני',        type:'bool',   group:'סף קבלה'},
  {key:'has2yrs',       header:'ניסיון שנתיים',   type:'bool',   group:'סף קבלה'},
  {key:'pastStudent',   header:'עבר במכון',       type:'bool',   group:'סף קבלה'},
  // תהליך
  {key:'materialSent',  header:'נשלח חומר',       type:'bool',   group:'תהליך'},
  {key:'materialDate',  header:'תאריך חומר',      type:'date',   group:'תהליך'},
  {key:'spoke',         header:'שוחחנו',          type:'bool',   group:'תהליך'},
  {key:'regForm',       header:'טופס הרשמה',      type:'bool',   group:'תהליך'},
  {key:'certDocs',      header:'מסמכי תעודות',    type:'bool',   group:'תהליך'},
  {key:'recommend',     header:'המלצות',          type:'string', group:'תהליך'},
  {key:'missingForms',  header:'טפסים חסרים',     type:'string', group:'תהליך'},
  {key:'interview',     header:'מצב ראיון',       type:'string', group:'תהליך', options:['לא נקבע','נקבע','בוצע','התקבל','נדחה']},
  {key:'interviewDate', header:'תאריך ראיון',     type:'date',   group:'תהליך'},
  // תשלומים
  {key:'payInterview',  header:'דמי ראיון שולם',  type:'bool',   group:'תשלומים'},
  {key:'payReg',        header:'דמי הרשמה שולם',  type:'bool',   group:'תשלומים'},
  {key:'payRegSum',     header:'דמי הרשמה סכום',  type:'number', group:'תשלומים'},
  {key:'payRegDate',    header:'דמי הרשמה תאריך', type:'date',   group:'תשלומים'},
  {key:'payRegRcpt',    header:'דמי הרשמה קבלה',  type:'string', group:'תשלומים'},
  {key:'payDeposit',    header:'מקדמה שולם',      type:'bool',   group:'תשלומים'},
  {key:'payDepositSum', header:'מקדמה סכום',      type:'number', group:'תשלומים'},
  {key:'payDepositDate',header:'מקדמה תאריך',     type:'date',   group:'תשלומים'},
  {key:'payTuition',    header:'שכ"ל שולם',       type:'bool',   group:'תשלומים'},
  {key:'payTuitionSum', header:'שכ"ל סכום',       type:'number', group:'תשלומים'},
  {key:'discountForm',  header:'טופס הנחה',       type:'bool',   group:'תשלומים'},
  {key:'discountPct',   header:'אחוז הנחה',       type:'number', group:'תשלומים'},
  {key:'payNote',       header:'הערה על התשלום',  type:'string', group:'תשלומים'},
  // תוצאה
  {key:'resultLetter',  header:'מכתב תוצאה',      type:'string', group:'תוצאה', options:['','נשלח']},
  {key:'status',        header:'סטטוס',           type:'string', group:'תוצאה', options:['פנייה חדשה','בטיפול','ממתין לראיון','התקבל','נרשם','לא מעוניין','נדחה']},
  {key:'noInterest',    header:'סיבה שאין עניין', type:'string', group:'תוצאה'},
  {key:'inCRM',         header:'נרשם בCRM',       type:'bool',   group:'תוצאה'},
  {key:'crmNote',       header:'הערות בCRM',      type:'string', group:'תוצאה'},
  // מחושב
  {key:'stage',         header:'שלב במשפך',       type:'string', group:'מחושב', computed:true},
  {key:'nextAction',    header:'פעולה הבאה',      type:'string', group:'מחושב', computed:true},
  {key:'daysSince',     header:'ימים מאז עדכון',  type:'number', group:'מחושב', computed:true},
  {key:'updatedAt',     header:'תאריך עדכון',     type:'date',   group:'מחושב', computed:true},
  // מטא / הרחבות אפליקציה (לא נדרסות בייבוא)
  {key:'source',        header:'מקור',            type:'string', group:'מטא',   aug:true},
  {key:'snoozeUntil',   header:'דחיית תזכורת עד', type:'date',   group:'מטא',   aug:true},
  {key:'actionNote',    header:'הערת פעולה',      type:'string', group:'מטא',   aug:true}
];

// מילון נרדפות: לכל field key — כותרות אפשריות בקובץ החי (לזיהוי עמודות גמיש).
var SOURCE_SYNONYMS = {
  name:        ['שם'],
  occupation:  ['עיסוק','התמחות'],
  email:       ['דואל','מייל','דוא"ל','דואר אלקטרוני','אימייל','מייל נוסף'],
  phone:       ['טלפון','נייד','טלפון נוסף','טלפון בבית'],
  channel:     ['אמצעי תקשורת','ערוץ','ערוץ פנייה'],
  city:        ['מגורים','אזור','ישוב','יישוב'],
  pastStudent: ['עבר במכון'],
  hasMA:       ['תואר שני'],
  has2yrs:     ['נסיון שנתיים','ניסיון שנתיים'],
  materialSent:['נשלחה הודעה','נשלח חומר'],
  spoke:       ['האם שוחחנו','שוחחנו'],
  certDocs:    ['מסמכי תעודות'],
  recommend:   ['המלצות'],
  regForm:     ['טופס הרשמה'],
  missingForms:['טפסים חסרים'],
  interview:   ['מצב ראיון','ראיון'],
  payInterview:['תשלום ראיון','דמי ראיון'],
  payReg:      ['דמי הרשמה'],
  payNote:     ['הערה על התשלום'],
  payDeposit:  ['תשלום מקדמה','מקדמה'],
  discountForm:['טופס הנחה'],
  discountPct: ['אחוז הנחה'],
  resultLetter:['מכתב תוצאה'],
  payTuition:  ['תשלום שכ"ל','שכ"ל','תשלום'],
  crmNote:     ['הערות בCRM','הערות בcrm'],
  status:      ['סטטוס'],
  stageRaw:    ['תהליך'],
  updatedAt:   ['תאריך עידכון','תאריך עדכון'],
  noInterest:  ['סיבה שאין עניין'],
  crmCode:     ['קוד לקוח','קוד'],
  cycle:       ['מחזור','מחזור כח הצמצום']
};

// ── שלבי משפך ופעולות ─────────────────────────────────────────
var FUNNEL = [
  {stage:'0 · פנייה חדשה',     next:'לשלוח חומר'},
  {stage:'1 · נשלח חומר',      next:'ליצור קשר / לשוחח'},
  {stage:'2 · שוחחנו',         next:'לאסוף מסמכים והמלצות'},
  {stage:'3 · מסמכים מלאים',   next:'לקבוע ראיון'},
  {stage:'4 · ראיון נקבע',     next:'לקיים ראיון'},
  {stage:'5 · התקבל',          next:'לגבות דמי הרשמה (300)'},
  {stage:'6 · שילם הרשמה',     next:'לגבות מקדמה (1200)'},
  {stage:'7 · שילם מקדמה',     next:'לגבות שכ"ל'},
  {stage:'8 · נרשם',           next:'לוודא רישום ב-CRM'},
  {stage:'✗ סגור',             next:'—'}
];

function schemaByKey(){ var m={}; SCHEMA.forEach(function(c){m[c.key]=c;}); return m; }
function headers(){ return SCHEMA.map(function(c){return c.header;}); }

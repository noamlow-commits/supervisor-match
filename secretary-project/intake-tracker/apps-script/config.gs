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
  {key:'recordType',    header:'סוג רשומה',       type:'string', group:'זיהוי', options:['פנייה','איש-קשר','קורס']},
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
  // מסמכים (צ'ק-ליסט — ✓ לכל אחד, לא מעכב)
  {key:'docCert',       header:'תעודות',          type:'bool',   group:'מסמכים'},
  {key:'docExperience', header:'טופס ניסיון',     type:'bool',   group:'מסמכים'},
  {key:'docCV',         header:'קורות חיים',      type:'bool',   group:'מסמכים'},
  {key:'docStory',      header:'סיפור אישי',      type:'bool',   group:'מסמכים'},
  {key:'docPassport',   header:'פספורט (לא חובה)',type:'bool',   group:'מסמכים'},
  {key:'docRec1',       header:'המלצה 1',         type:'bool',   group:'מסמכים'},
  {key:'docRec2',       header:'המלצה 2',         type:'bool',   group:'מסמכים'},
  // התלבטות — שתי נקודות התלבטות (טקסט חופשי). aug=true: לא נדרס בייבוא.
  {key:'delibEarly',    header:'התלבטות (שיחה←הרשמה)',  type:'string', group:'התלבטות', aug:true},
  {key:'delibLate',     header:'התלבטות (קבלה←מקדמה)',  type:'string', group:'התלבטות', aug:true},
  // תהליך
  {key:'materialSent',  header:'נשלח חומר',       type:'bool',   group:'תהליך', label:'נוצר קשר ונשלח חומר'},
  {key:'materialDate',  header:'תאריך חומר',      type:'date',   group:'תהליך'},
  {key:'spoke',         header:'שוחחנו',          type:'bool',   group:'תהליך'},
  {key:'regForm',       header:'טופס הרשמה',      type:'bool',   group:'תהליך'},
  {key:'certDocs',      header:'מסמכי תעודות',    type:'bool',   group:'תהליך'},
  {key:'recommend',     header:'המלצות',          type:'string', group:'תהליך'},
  {key:'missingForms',  header:'טפסים חסרים',     type:'string', group:'תהליך'},
  {key:'interview',     header:'מצב ראיון',       type:'string', group:'תהליך', options:['לא נקבע','נקבע','בוצע','התקבל','נדחה']},
  {key:'interviewer',   header:'מראיין',          type:'string', group:'תהליך'},
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
  // קורסים: רישום עצמאי שדורש הכנסה ידנית למודל (התראה לטל)
  {key:'needsMoodle',   header:'להכניס למודל',    type:'bool',   group:'תוצאה', aug:true},
  // מחושב
  {key:'stage',         header:'שלב במשפך',       type:'string', group:'מחושב', computed:true},
  {key:'nextAction',    header:'פעולה הבאה',      type:'string', group:'מחושב', computed:true},
  {key:'daysSince',     header:'ימים מאז עדכון',  type:'number', group:'מחושב', computed:true},
  {key:'updatedAt',     header:'תאריך עדכון',     type:'date',   group:'מחושב', computed:true},
  // מטא / הרחבות אפליקציה (לא נדרסות בייבוא)
  {key:'source',        header:'מקור',            type:'string', group:'מטא',   aug:true},
  {key:'snoozeUntil',   header:'דחיית תזכורת עד', type:'date',   group:'מטא',   aug:true},
  {key:'actionNote',    header:'הערת פעולה',      type:'string', group:'מטא',   aug:true},
  // מיקום ידני בלוח (נקבע בגרירה). aug + group מטא → מוסתר מהטופס, נשמר בייבוא.
  {key:'boardStage',    header:'עמודת לוח',       type:'string', group:'מטא',   aug:true},
  // מתי הפנייה נכנסה לשלב הנוכחי — לחישוב התיישנות (מסגרות 5/10 ימים). מתעדכן בתזוזת שלב.
  {key:'stageSince',    header:'בשלב מאז',        type:'date',   group:'מטא',   aug:true}
];

// תזכורות-מעבר: כשגוררים כרטיס לשלב יעד, אילו אבני-דרך כדאי שכבר יסומנו.
// אם חסר — קופצת תזכורת (לא חוסמת). מפתח: תוכנית → טקסט-השלב → [{key,label}].
var STAGE_REQUIRES = {
  'הדיאלוגי': {
    '4 · ריאיון':            [{key:'payReg', label:'דמי הרשמה (300)'}],
    '5 · ועדה / מכתב קבלה':  [{key:'payInterview', label:'תשלום למראיין'}],
    '6 · נרשם (מקדמה 1200)': [{key:'payDeposit', label:'מקדמה (1200)'}]
  },
  'תעודה': {
    '3 · נרשם (דמי הרשמה 300)': [{key:'payReg', label:'דמי הרשמה (300)'}]
  }
};

// גרירה לשלב → אילו אבני-דרך לסמן אוטומטית (כדי שהגרירה תעדכן את הנתונים, לא רק את המיקום).
// שלב שאינו כאן → גרירה מזיזה מיקום ידני בלבד (boardStage).
var STAGE_APPLY = {
  'הדיאלוגי': {
    '1 · שיחה והתאמה':        {spoke:true},
    '4 · ריאיון':             {interview:'נקבע'},
    '5 · ועדה / מכתב קבלה':   {interview:'התקבל'},
    '6 · נרשם (מקדמה 1200)':  {payDeposit:true}
  },
  'תעודה': {
    '1 · שיחה והתאמה':        {spoke:true},
    '2 · ריאיון (הרב רונן)':  {interview:'נקבע'},
    '3 · נרשם (דמי הרשמה 300)':{payReg:true}
  },
  'אח"ד': {
    '1 · נרשם (תשלום מלא)':   {payReg:true}
  }
};

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

// ── תוכניות פעילות השנה ────────────────────────────────────────
// טל עובדת השנה עם שלוש תוכניות בלבד. שם הלשונית הארוך בקובץ החי מנורמל לאחת מהן.
var ACTIVE_PROGRAMS = ['הדיאלוגי', 'תעודה', 'אח"ד'];

// צבע קבוע לכל תוכנית (גם בשרת — למבט הרוחבי). הלקוח יכול לדרוס.
var PROGRAM_COLORS = { 'הדיאלוגי':'#2b6cb0', 'תעודה':'#2f855a', 'אח"ד':'#dd6b20' };

// עוגן ההרשמה — איזה תשלום פירושו "נרשם" בכל תוכנית:
//   הדיאלוגי = מקדמה · תעודה = דמי הרשמה · אח"ד = תשלום מלא (כל תשלום)
var PROGRAM_REG_ANCHOR = { 'הדיאלוגי':'payDeposit', 'תעודה':'payReg', 'אח"ד':'payFull' };

// קורסים שנמכרים דרך קארדקום ודורשים רישום עצמאי + התראה לטל (הכנסה ידנית למודל).
// לכל קורס: ביטוי-זיהוי בתיאור המוצר + שם תצוגה. להוסיף קורסים נוספים כאן.
var COURSE_PRODUCTS = [
  { match: /רבי\s*נחמן|ברסלב/, name: 'קורס רבי נחמן מברסלב' }
];
function courseFromProduct_(desc){
  var d = String(desc || '');
  for (var i = 0; i < COURSE_PRODUCTS.length; i++){ if (COURSE_PRODUCTS[i].match.test(d)) return COURSE_PRODUCTS[i].name; }
  return '';
}

// נרמול שם תוכנית: שם לשונית ארוך / תווית → אחת משלוש התוויות הנקיות.
// מחזיר את הקלט כפי שהוא אם לא זוהה (למשל רשימת אנשי-קשר).
function canonicalProgram_(s){
  var t = String(s||'');
  if (/הדיאלוגי|דיאלוג/.test(t))            return 'הדיאלוגי';
  if (/תעודה|הצמצום|תהוד/.test(t))          return 'תעודה';
  if (/אח["׳']?ד|\bאחד\b|תוכנית אח/.test(t)) return 'אח"ד';
  return s;
}

// ── שלבי משפך ופעולות — לכל תוכנית משפך משלה ──────────────────
// כל פריט: {stage, next, reached(o)} — reached קובע אם אבן-הדרך הושגה.
// השלב = אבן-הדרך הגבוהה ביותר שהושגה (computeRow_ ב-lib.gs).
// הדיאלוגי (מלא). שלב המסמכים = צוואר-הבקבוק (נתקעים בו עד שכל המסמכים מגיעים).
function anyDoc_(o){ return o.payReg || o.docCert || o.docCV || o.docStory || o.docExperience || o.docRec1 || o.docRec2 || o.certDocs || o.recommend; }
var DIALOGI_FUNNEL = [
  {stage:'0 · פנייה ראשונית',       next:'התאמה לתוכנית + שיחת פרטים',        reached:function(o){ return true; }},
  {stage:'1 · שיחה והתאמה',         next:'לפתוח תהליך הרשמה (מסמכים + 300)',  reached:function(o){ return o.materialSent || o.spoke; }},
  {stage:'2 · מסמכים + דמי הרשמה',  next:'לאסוף את כל המסמכים + דמי הרשמה (300)', reached:function(o){ return anyDoc_(o); }},
  {stage:'3 · התאמת מראיין',        next:'לקבוע ריאיון',                       reached:function(o){ return o.interviewer || o.interview==='נקבע'; }},
  {stage:'4 · ריאיון',              next:'דמי ריאיון + שליחת חוו"ד לועדה',     reached:function(o){ return o.interviewDate || o.interview==='בוצע' || o.payInterview; }},
  {stage:'5 · ועדה / מכתב קבלה',    next:'לשלוח מכתב קבלה ולגבות מקדמה (1200)', reached:function(o){ return o.interview==='התקבל'; }},
  {stage:'6 · נרשם (מקדמה 1200)',   next:'לוודא שהכסף הגיע (הבטחת מקום)',      reached:function(o){ return o.payDeposit; }}
];
// כוח הצמצום (תעודה) — מהיר: אחרי הפנייה הראשונית, ריאיון עם הרב רונן + דמי הרשמה 300 = נרשם.
var TEUDA_FUNNEL = [
  {stage:'0 · פנייה ראשונית',        next:'התאמה לתוכנית + שיחה',             reached:function(o){ return true; }},
  {stage:'1 · שיחה והתאמה',          next:'להפנות לריאיון עם הרב רונן',       reached:function(o){ return o.materialSent || o.spoke; }},
  {stage:'2 · ריאיון (הרב רונן)',    next:'לגבות דמי הרשמה (300)',            reached:function(o){ return o.interviewDate || o.interview==='נקבע' || o.interview==='בוצע' || o.interview==='התקבל'; }},
  {stage:'3 · נרשם (דמי הרשמה 300)', next:'לוודא שהכסף הגיע',                 reached:function(o){ return o.payReg; }}
];
var AHAD_FUNNEL = [
  {stage:'0 · פנייה חדשה',       next:'לגבות תשלום מלא',                  reached:function(o){ return true; }},
  {stage:'1 · נרשם (תשלום מלא)', next:'לוודא שהכסף הגיע',                 reached:function(o){ return o.payTuition || o.payDeposit || o.payReg; }}
];
// משפך ברירת-מחדל לתוכנית לא-מזוהה (תאימות לאחור).
var GENERIC_FUNNEL = [
  {stage:'0 · פנייה חדשה',   next:'לשלוח חומר',         reached:function(o){ return true; }},
  {stage:'1 · נשלח חומר',    next:'ליצור קשר / לשוחח',  reached:function(o){ return o.materialSent; }},
  {stage:'2 · שוחחנו',       next:'לאסוף מסמכים',       reached:function(o){ return o.spoke; }},
  {stage:'3 · מסמכים מלאים', next:'לקבוע ראיון',        reached:function(o){ return o.certDocs && o.regForm && o.recommend; }},
  {stage:'4 · ראיון נקבע',   next:'לקיים ראיון',        reached:function(o){ return o.interview==='נקבע' || o.interview==='בוצע' || o.interviewDate; }},
  {stage:'5 · התקבל',        next:'לגבות דמי הרשמה',    reached:function(o){ return o.interview==='התקבל'; }},
  {stage:'6 · שילם הרשמה',   next:'לגבות מקדמה',        reached:function(o){ return o.payReg; }},
  {stage:'7 · שילם מקדמה',   next:'לגבות שכ"ל',         reached:function(o){ return o.payDeposit; }},
  {stage:'8 · נרשם',         next:'לוודא שהכסף הגיע',   reached:function(o){ return o.payTuition; }}
];

// מחזיר את מערך המשפך המתאים לתוכנית.
function funnelFor_(program){
  var p = canonicalProgram_(program);
  if (p === 'הדיאלוגי') return DIALOGI_FUNNEL;
  if (p === 'תעודה')    return TEUDA_FUNNEL;
  if (p === 'אח"ד')     return AHAD_FUNNEL;
  return GENERIC_FUNNEL;
}

function schemaByKey(){ var m={}; SCHEMA.forEach(function(c){m[c.key]=c;}); return m; }
function headers(){ return SCHEMA.map(function(c){return c.header;}); }

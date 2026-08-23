/**
 * One-time bulk import — טלפונים למאגר המדריכים (בקשת טל, 28.7).
 *
 * Source: Tal's "צוות מדריכים בי"ס לפסיכותרפיה דיאלוגית" Google Doc
 *   https://docs.google.com/document/d/1zMRsANvoWE0Nx6M4T6uTAQ07D6IgwGV_/edit
 * Only the phone column was taken from that doc. Names + emails there are used
 * for MATCHING rows only — this script never writes names or emails.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────
 *   1. Run ▸ previewSupervisorPhones2026   → logs exactly what WOULD change,
 *                                            writes nothing. Read the log.
 *   2. Run ▸ importSupervisorPhones2026    → performs the writes.
 * No redeploy needed — this writes straight to the bound spreadsheet.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 *   • ADD       — row has no phone      → writes the phone from the doc
 *   • NORMALIZE — row has the SAME number in a messy form ("⁦05XXXXXXXX⁩",
 *                 stray bidi marks, spaces, dashes) → rewrites it as 05XXXXXXXX
 *   • CONFLICT  — row has a DIFFERENT number → left untouched, reported. A human
 *                 decides. Nothing is ever silently overwritten.
 *   • NOT FOUND — no row matched that person → reported, no row is created.
 *
 * Phones are written with number-format '@' (text) so the leading zero survives
 * — Sheets otherwise turns "05XXXXXXXX" into the number 523797343 and the
 * student page's wa.me / tel: links break. See feedback_sheets_phone_format.
 *
 * ── TWO JUDGEMENT CALLS, DECIDED BY NOAM 2026-08-02 ───────────────────────
 *   אפרת ברום — the doc lists "05XXXXXXXX" = 9 digits; an Israeli mobile is 10.
 *     Resolved: use "05XXXXXXXX" from the old seedHadialogyDirectory data (the
 *     doc's number + the trailing 9 it evidently lost). Noam's call.
 *
 *   ד"ר קארן לרנר — her card is a published row with EVERY field blank except
 *     the phone, so students see an empty available card. Noam's call: do NOT
 *     restore/publish it — take it out of the student view. This script
 *     unpublishes it (see unpublishOrphanCard_). Her name/email/profile are
 *     left alone; the card is simply hidden until someone rebuilds it.
 */

/* ========================= CONFIG ========================= */

// Turn WhatsApp on for supervisors who had NO phone until now. Their
// whatsappEnabled flag is meaningless while the phone is empty (the button
// can't render), and the doc itself says "יש ליצור קשר ישירות עם המדריך …
// עדיף בוואצפ". Set to false to add the number as phone-only.
var ENABLE_WHATSAPP_FOR_NEW_PHONES = true;

// Rewrite messy-but-identical existing numbers into clean 05XXXXXXXX form.
var NORMALIZE_EXISTING = true;

// Hide the blank published card described in the header (ד"ר קארן לרנר).
// Targeted narrowly — a row is only unpublished when it is published AND has an
// empty fullName AND its phone matches ORPHAN_CARD_PHONE. All three, so this
// can never wander onto a real profile.
var UNPUBLISH_ORPHAN_CARD = true;
var ORPHAN_CARD_PHONE = '05XXXXXXXX';

/* ===================== DATA FROM THE DOC ===================== */
// phone = local Israeli form, digits only, leading 0.
// name/email are matching keys only — never written.
var PHONE_ROSTER_2026 = [
  { name: 'ד"ר ברוך כהנא',        email: 'REDACTED@example.com',            phone: '05XXXXXXXX' },
  // Expected to log as NOT FOUND — her row has no name and no email to match on.
  // It is handled separately by unpublishOrphanCard_() instead. Kept here so the
  // roster stays a faithful copy of the doc.
  { name: 'ד"ר קארן לרנר',        email: 'REDACTED@example.com',           phone: '05XXXXXXXX' },
  { name: 'איתן כלפה',            email: 'REDACTED@example.com',   phone: '05XXXXXXXX' },
  { name: 'גבריאל פרץ',           email: 'REDACTED@example.com',       phone: '05XXXXXXXX' },
  { name: 'נעמי אשואל',           email: 'REDACTED@example.com',        phone: '05XXXXXXXX' },
  { name: 'ד"ר חגי סרי',          email: 'REDACTED@example.com',        phone: '05XXXXXXXX' },
  { name: 'ד"ר נילי פויירשטיין',  email: 'REDACTED@example.com',            phone: '05XXXXXXXX' },
  { name: 'חנה יאיר בוריה',       email: 'REDACTED@example.com',              phone: '05XXXXXXXX' },
  { name: 'נריה קרין',            email: 'REDACTED@example.com',          phone: '05XXXXXXXX' },
  { name: 'נועם לב',              email: 'REDACTED@example.com',             phone: '05XXXXXXXX' },
  { name: 'טליק לרנר',            email: 'REDACTED@example.com',         phone: '05XXXXXXXX' },
  { name: 'מני פולק',             email: 'REDACTED@example.com',          phone: '05XXXXXXXX' },
  { name: 'אבי יעקובסון',         email: 'REDACTED@example.com',         phone: '05XXXXXXXX' },
  { name: 'דני קורנבליט',         email: 'REDACTED@example.com',            phone: '05XXXXXXXX' },
  { name: 'בנימין גולדנהירש',     email: 'REDACTED@example.com',   phone: '05XXXXXXXX' },
  { name: 'סלעית בן דרור',        email: 'REDACTED@example.com',         phone: '05XXXXXXXX' },
  // Doc says "05XXXXXXXX" (9 digits — a digit was lost). Noam ruled 2026-08-02 to
  // trust the older seedHadialogyDirectory value "05XXXXXXXX" instead.
  { name: 'אפרת ברום',            email: 'REDACTED@example.com',           phone: '05XXXXXXXX' }
  // ד"ר יפעה מליק גרינברג — no phone in the doc (consultation card).
];

/* ========================= ENTRY POINTS ========================= */

function previewSupervisorPhones2026() { return runPhoneImport_(true); }
function importSupervisorPhones2026()  { return runPhoneImport_(false); }

/* ========================= IMPLEMENTATION ========================= */

function runPhoneImport_(dryRun) {
  var sheet = getOrCreateSupervisorsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  if (col.phone === undefined || col.fullName === undefined) {
    throw new Error('Supervisors sheet is missing a "phone" or "fullName" column.');
  }

  var added = [], normalized = [], unchanged = [], conflicts = [], notFound = [];
  var now = new Date().toISOString();

  PHONE_ROSTER_2026.forEach(function (entry) {
    var want = digitsOnly_(entry.phone);
    if (!isValidIsraeliMobile_(want)) {
      conflicts.push(entry.name + ' — מספר לא תקין בקוד עצמו: ' + entry.phone);
      return;
    }

    var rowIdx = findSupervisorRow_(data, col, entry);   // 0-based index into `data`
    if (rowIdx === -1) { notFound.push(entry.name + '  (' + entry.phone + ')'); return; }

    var rowNum = rowIdx + 1;                             // 1-based sheet row
    var sheetName = String(data[rowIdx][col.fullName] || '(ללא שם)').trim();
    var current = String(data[rowIdx][col.phone] == null ? '' : data[rowIdx][col.phone]).trim();
    var currentDigits = normalizeIsraeliDigits_(current);

    // 1. Empty → add.
    if (!currentDigits) {
      if (!dryRun) {
        writePhone_(sheet, rowNum, col.phone, want);
        if (ENABLE_WHATSAPP_FOR_NEW_PHONES && col.whatsappEnabled !== undefined) {
          sheet.getRange(rowNum, col.whatsappEnabled + 1).setValue(true);
        }
        touchUpdated_(sheet, rowNum, col, now);
      }
      added.push(sheetName + '  →  ' + want +
        (ENABLE_WHATSAPP_FOR_NEW_PHONES ? '  (+WhatsApp)' : ''));
      return;
    }

    // 2. Same number, messy form → normalize.
    if (currentDigits === want) {
      if (current === want) { unchanged.push(sheetName + '  =  ' + want); return; }
      if (!NORMALIZE_EXISTING) { unchanged.push(sheetName + '  =  ' + current + '  (לא נוקה)'); return; }
      if (!dryRun) {
        writePhone_(sheet, rowNum, col.phone, want);
        touchUpdated_(sheet, rowNum, col, now);
      }
      normalized.push(sheetName + '  "' + current + '"  →  ' + want);
      return;
    }

    // 3. Genuinely different → never overwrite.
    conflicts.push(sheetName + '  בגיליון: ' + current + '   |   במסמך: ' + want);
  });

  /* ---------- report ---------- */
  var out = [];
  out.push(dryRun ? '=== תצוגה מקדימה בלבד — לא נכתב כלום ===' : '=== ייבוא טלפונים בוצע ===');
  out.push('');
  out.push('נוספו (' + added.length + '):');        added.forEach(function (s) { out.push('  + ' + s); });
  out.push('');
  out.push('נוקו לפורמט אחיד (' + normalized.length + '):'); normalized.forEach(function (s) { out.push('  ~ ' + s); });
  out.push('');
  out.push('כבר נכונים (' + unchanged.length + '):'); unchanged.forEach(function (s) { out.push('  · ' + s); });

  if (conflicts.length) {
    out.push('');
    out.push('⚠ סתירות — לא נגענו, צריך הכרעה אנושית (' + conflicts.length + '):');
    conflicts.forEach(function (s) { out.push('  ! ' + s); });
  }
  if (notFound.length) {
    out.push('');
    out.push('⚠ לא נמצאה שורה במאגר (' + notFound.length + ') — לא נוצרו כרטיסים חדשים:');
    notFound.forEach(function (s) { out.push('  ? ' + s); });
  }

  if (UNPUBLISH_ORPHAN_CARD) {
    var orphan = unpublishOrphanCard_(sheet, data, col, dryRun, now);
    out.push('');
    out.push('כרטיס ריק שהוסתר מהסטודנטים:');
    out.push('  ' + orphan);
  }

  var report = out.join('\n');
  Logger.log(report);
  return report;
}

/* ========================= orphan card ========================= */

/**
 * Sets published=false on the blank card that students currently see as an
 * available supervisor. Requires ALL THREE to hold before touching a row:
 * published, empty fullName, and phone === ORPHAN_CARD_PHONE. Nothing else is
 * changed — the phone stays put, so the row can be rebuilt later if wanted.
 * Idempotent: a second run just reports that nothing matched.
 */
function unpublishOrphanCard_(sheet, data, col, dryRun, iso) {
  if (col.published === undefined) return 'אין עמודת published — דילוג.';

  var hits = [];
  for (var i = 1; i < data.length; i++) {
    var isPublished = data[i][col.published] === true ||
                      String(data[i][col.published]).toUpperCase() === 'TRUE';
    var nameBlank = String(data[i][col.fullName] || '').trim() === '';
    var phoneMatch = normalizeIsraeliDigits_(data[i][col.phone]) === ORPHAN_CARD_PHONE;
    if (isPublished && nameBlank && phoneMatch) hits.push(i + 1);
  }

  if (!hits.length) return 'לא נמצא כרטיס ריק מפורסם עם הטלפון ' + ORPHAN_CARD_PHONE + ' — כנראה כבר טופל.';

  if (!dryRun) {
    hits.forEach(function (rowNum) {
      sheet.getRange(rowNum, col.published + 1).setValue(false);
      touchUpdated_(sheet, rowNum, col, iso);
    });
  }
  return 'הוסתר (published=false): שורה ' + hits.join(', ') +
         '  — הכרטיס הריק עם ' + ORPHAN_CARD_PHONE + ' (ד"ר קארן לרנר). הטלפון נשאר בשורה.';
}

/* ========================= helpers ========================= */

// Write as TEXT so Sheets keeps the leading zero (05XXXXXXXX, not 523797343).
function writePhone_(sheet, rowNum, phoneColIdx, value) {
  var cell = sheet.getRange(rowNum, phoneColIdx + 1);
  cell.setNumberFormat('@');
  cell.setValue(String(value));
}

function touchUpdated_(sheet, rowNum, col, iso) {
  if (col.updated !== undefined) sheet.getRange(rowNum, col.updated + 1).setValue(iso);
}

function digitsOnly_(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

// Reduce any written form to the canonical local one: 05XXXXXXXX.
// Handles "05XXXXXXXX", "972523797343", "523797343" (zero eaten by Sheets),
// and stray bidi isolates (U+2066/U+2069) that the doc's numbers carry.
function normalizeIsraeliDigits_(v) {
  var d = digitsOnly_(v);
  if (!d) return '';
  if (d.indexOf('972') === 0) d = '0' + d.substring(3);
  else if (d.charAt(0) !== '0') d = '0' + d;   // Sheets dropped the leading zero
  return d;
}

function isValidIsraeliMobile_(d) {
  return /^05\d{8}$/.test(d)        // mobile:   05X + 7  = 10 digits
      || /^0[2-489]\d{7}$/.test(d); // landline: 0X  + 7  =  9 digits
}

// Strip titles, quote variants and extra whitespace so "ד\"ר נילי פויירשטיין",
// "ד״ר נילי פויירשטיין" and "נילי פויירשטיין" all collapse to the same key.
function normalizeName_(v) {
  return String(v == null ? '' : v)
    .replace(/[‎‏⁦-⁩]/g, '')      // bidi marks
    .replace(/["'״׳`]/g, '')
    .replace(/^\s*(ד\s*ר|דר|פרופ|מר|גב)\s*\.?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match order: exact name → normalized name → email. Email last, because the
// roster's emails have drifted from the doc's in at least one case
// (סלעית בן דרור: salit6@ in the sheet vs salitnehara@ in the doc).
function findSupervisorRow_(data, col, entry) {
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][col.fullName]).trim() === entry.name) return i;
  }
  var key = normalizeName_(entry.name);
  for (i = 1; i < data.length; i++) {
    if (normalizeName_(data[i][col.fullName]) === key) return i;
  }
  if (col.email !== undefined && entry.email) {
    var mail = String(entry.email).trim().toLowerCase();
    for (i = 1; i < data.length; i++) {
      if (String(data[i][col.email]).trim().toLowerCase() === mail) return i;
    }
  }
  return -1;
}

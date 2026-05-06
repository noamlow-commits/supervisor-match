/**
 * Apps Script Backend — Supervisor Match
 * בית הספר לפסיכותרפיה
 *
 * Deployment:
 *   1. Open Google Sheet → Extensions → Apps Script
 *   2. Paste this entire file into Code.gs (replace existing content)
 *   3. Run setupSheets() once manually (creates required tabs)
 *   4. Deploy → New deployment → Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Copy the deployment URL
 *   6. Open the app and paste the URL into the setup screen
 *
 * Endpoints (all GET, query params):
 *   ?action=verifyClassPin&pin=XXXX
 *   ?action=verifyRegistrationCode&code=XXXX
 *   ?action=registerSupervisor&name=...&email=...&code=...
 *   ?action=getSupervisors&pin=XXXX           → published only
 *   ?action=getSupervisor&token=XXX           → for editing (published or not)
 *   ?action=saveSupervisor&token=XXX&data=URLENCODED_JSON
 *   ?action=getParameters&pin=XXXX
 */

const TAB_SUPERVISORS = 'Supervisors';
const TAB_PARAMETERS = 'Parameters';
const TAB_SETTINGS = 'Settings';

const SUPERVISOR_COLS = [
  'token', 'created', 'updated', 'published',
  'fullName', 'credential', 'yearsSupervising',
  'orientations', 'populations', 'specialties',
  'styleText', 'format', 'area',
  'availability', 'hasSpot',
  'phone', 'whatsappEnabled', 'email',
  'studentsAccepted'
];

/* ========== Routing ========== */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || '';

  try {
    let result;
    switch (action) {
      case 'verifyClassPin':         result = verifyClassPin(params); break;
      case 'verifyRegistrationCode': result = verifyRegistrationCode(params); break;
      case 'verifyAdminPin':         result = verifyAdminPin(params); break;
      case 'registerSupervisor':     result = registerSupervisor(params); break;
      case 'getSupervisors':         result = getSupervisors(params); break;
      case 'getSupervisor':          result = getSupervisor(params); break;
      case 'saveSupervisor':         result = saveSupervisor(params); break;
      case 'getParameters':          result = getParameters(params); break;
      case 'getAdminStats':          result = getAdminStats(params); break;
      default:                       result = { error: 'unknown_action', action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: 'server_error', message: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========== Auth ========== */

function verifyClassPin(p) {
  const expected = getSetting('classPin') || '2026';
  return { valid: String(p.pin || '') === String(expected) };
}

function verifyRegistrationCode(p) {
  const expected = getSetting('registrationCode') || 'CFGUSH26';
  return { valid: String(p.code || '').toUpperCase() === String(expected).toUpperCase() };
}

function verifyAdminPin(p) {
  const expected = getSetting('adminPin') || 'cfgush26admin';
  return { valid: String(p.adminPin || '') === String(expected) };
}

function requireClassPin(p) {
  if (!verifyClassPin(p).valid) throw new Error('invalid_pin');
}

function requireAdminPin(p) {
  if (!verifyAdminPin(p).valid) throw new Error('invalid_admin_pin');
}

/* ========== Supervisor Registration ========== */

function registerSupervisor(p) {
  if (!verifyRegistrationCode({ code: p.code }).valid) {
    return { error: 'invalid_code' };
  }
  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim();
  if (!name || !email) return { error: 'missing_fields' };

  const token = generateToken();
  const sheet = getOrCreateSupervisorsSheet();
  const now = new Date().toISOString();
  const row = SUPERVISOR_COLS.map(col => {
    if (col === 'token') return token;
    if (col === 'created' || col === 'updated') return now;
    if (col === 'published') return false;
    if (col === 'fullName') return name;
    if (col === 'email') return email;
    if (col === 'hasSpot') return true;
    if (col === 'whatsappEnabled') return false;
    if (col === 'studentsAccepted') return 0;
    return '';
  });
  sheet.appendRow(row);

  const personalUrl = (getSetting('appBaseUrl') || '') + 'supervisor.html?token=' + token;
  sendRegistrationEmail(email, name, personalUrl);

  return { token, personalUrl };
}

function sendRegistrationEmail(toEmail, name, personalUrl) {
  try {
    const schoolName = getSetting('schoolName') || 'בית הספר לפסיכותרפיה';
    MailApp.sendEmail({
      to: toEmail,
      subject: 'פרופיל מדריך — ' + schoolName,
      htmlBody:
        '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' +
        '<p>שלום ' + escapeHtml(name) + ',</p>' +
        '<p>הפרופיל שלך נוצר במאגר המדריכים של ' + escapeHtml(schoolName) + '.</p>' +
        '<p>הקישור האישי שלך לעריכת הפרופיל בכל זמן:</p>' +
        '<p><a href="' + personalUrl + '">' + personalUrl + '</a></p>' +
        '<p><b>חשוב:</b> שמור/שמרי את הקישור הזה. הוא משמש כסיסמה — מי שיש לו אותו יכול לערוך את הפרופיל.</p>' +
        '<p>בהצלחה,<br>צוות בית הספר</p>' +
        '</div>'
    });
  } catch (e) {
    // email is best-effort; don't fail registration if mail fails
  }
}

/* ========== Get Supervisors (public, for students) ========== */

function getSupervisors(p) {
  requireClassPin(p);
  const rows = readSupervisorRows();
  const published = rows.filter(r => r.published === true || r.published === 'TRUE' || r.published === 'true');
  return { supervisors: published.map(toClientSupervisor) };
}

function toClientSupervisor(r) {
  return {
    id: r.token,
    fullName: r.fullName,
    credential: r.credential,
    yearsSupervising: Number(r.yearsSupervising) || 0,
    orientations: splitList(r.orientations),
    populations: splitList(r.populations),
    specialties: splitList(r.specialties),
    styleText: r.styleText,
    format: r.format,
    area: r.area,
    availability: parseAvailability(r.availability),
    hasSpot: r.hasSpot === true || r.hasSpot === 'TRUE' || r.hasSpot === 'true',
    contact: {
      phone: r.phone || '',
      whatsappEnabled: r.whatsappEnabled === true || r.whatsappEnabled === 'TRUE' || r.whatsappEnabled === 'true',
      email: r.email || ''
    }
  };
}

/* ========== Get / Save One Supervisor (by token) ========== */

function getSupervisor(p) {
  const token = String(p.token || '');
  if (!token) return { error: 'missing_token' };
  const rows = readSupervisorRows();
  const r = rows.find(x => x.token === token);
  if (!r) return { error: 'not_found' };
  return {
    profile: {
      fullName: r.fullName,
      credential: r.credential,
      yearsSupervising: Number(r.yearsSupervising) || '',
      orientations: splitList(r.orientations),
      populations: splitList(r.populations),
      specialties: splitList(r.specialties),
      styleText: r.styleText,
      format: r.format,
      area: r.area,
      availability: parseAvailability(r.availability),
      hasSpot: r.hasSpot === true || r.hasSpot === 'TRUE' || r.hasSpot === 'true',
      contact: {
        phone: r.phone || '',
        whatsappEnabled: r.whatsappEnabled === true || r.whatsappEnabled === 'TRUE' || r.whatsappEnabled === 'true',
        email: r.email || ''
      },
      published: r.published === true || r.published === 'TRUE' || r.published === 'true',
      studentsAccepted: Number(r.studentsAccepted) || 0
    }
  };
}

function saveSupervisor(p) {
  const token = String(p.token || '');
  if (!token) return { error: 'missing_token' };

  let data;
  try {
    data = JSON.parse(p.data || '{}');
  } catch (e) {
    return { error: 'bad_json' };
  }

  const sheet = getOrCreateSupervisorsSheet();
  const allValues = sheet.getDataRange().getValues();
  const headers = allValues[0];
  const tokenCol = headers.indexOf('token');
  if (tokenCol < 0) return { error: 'schema_error' };

  let rowIdx = -1;
  for (let i = 1; i < allValues.length; i++) {
    if (String(allValues[i][tokenCol]) === token) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) return { error: 'not_found' };

  const c = data.contact || {};
  const updates = {
    updated: new Date().toISOString(),
    fullName: data.fullName || '',
    credential: data.credential || '',
    yearsSupervising: data.yearsSupervising || '',
    orientations: joinList(data.orientations),
    populations: joinList(data.populations),
    specialties: joinList(data.specialties),
    styleText: data.styleText || '',
    format: data.format || '',
    area: data.area || '',
    availability: JSON.stringify(data.availability || {}),
    hasSpot: !!data.hasSpot,
    phone: c.phone || '',
    whatsappEnabled: !!c.whatsappEnabled,
    email: c.email || '',
    published: !!data.published,
    studentsAccepted: Math.max(0, Number(data.studentsAccepted) || 0)
  };

  for (const [k, v] of Object.entries(updates)) {
    const col = headers.indexOf(k);
    if (col < 0) continue;
    const cell = sheet.getRange(rowIdx, col + 1);
    // Force phone column to text format so leading zeros are preserved
    if (k === 'phone' && v) {
      cell.setNumberFormat('@');
      cell.setValue(String(v));
    } else {
      cell.setValue(v);
    }
  }

  return { ok: true };
}

/* ========== Admin Stats ========== */

function getAdminStats(p) {
  requireAdminPin(p);
  const rows = readSupervisorRows();

  const expectedStudents = Number(getSetting('expectedStudents')) || 0;
  let totalAccepted = 0;
  let publishedCount = 0;
  let withSpotCount = 0;

  const supervisors = rows.map(r => {
    const published = r.published === true || r.published === 'TRUE' || r.published === 'true';
    const hasSpot = r.hasSpot === true || r.hasSpot === 'TRUE' || r.hasSpot === 'true';
    const accepted = Number(r.studentsAccepted) || 0;
    if (published) publishedCount++;
    if (hasSpot) withSpotCount++;
    totalAccepted += accepted;
    return {
      fullName: r.fullName || '(ללא שם)',
      credential: r.credential || '',
      published,
      hasSpot,
      studentsAccepted: accepted,
      email: r.email || '',
      phone: r.phone || ''
    };
  });

  // Sort by acceptance count desc, then by name
  supervisors.sort((a, b) => (b.studentsAccepted - a.studentsAccepted) || a.fullName.localeCompare(b.fullName));

  return {
    summary: {
      totalSupervisors: rows.length,
      publishedCount,
      withSpotCount,
      totalAccepted,
      expectedStudents,
      remaining: Math.max(0, expectedStudents - totalAccepted)
    },
    supervisors
  };
}

/* ========== Parameters ========== */

function getParameters(p) {
  requireClassPin(p);
  const sheet = getOrCreateParametersSheet();
  const values = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const [field, option] = values[i];
    if (!field || !option) continue;
    if (!out[field]) out[field] = [];
    out[field].push(option);
  }
  return { parameters: out };
}

/* ========== Sheet helpers ========== */

function readSupervisorRows() {
  const sheet = getOrCreateSupervisorsSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row[0]).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getOrCreateSupervisorsSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(TAB_SUPERVISORS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_SUPERVISORS);
    sheet.appendRow(SUPERVISOR_COLS);
    sheet.setFrozenRows(1);
  } else {
    // ensure headers exist
    const firstRow = sheet.getRange(1, 1, 1, SUPERVISOR_COLS.length).getValues()[0];
    if (!firstRow[0]) sheet.getRange(1, 1, 1, SUPERVISOR_COLS.length).setValues([SUPERVISOR_COLS]);
  }
  return sheet;
}

function getOrCreateParametersSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(TAB_PARAMETERS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_PARAMETERS);
    sheet.appendRow(['field', 'option']);
    sheet.setFrozenRows(1);
    seedDefaultParameters(sheet);
  }
  return sheet;
}

function getOrCreateSettingsSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(TAB_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_SETTINGS);
    sheet.appendRow(['key', 'value']);
    sheet.setFrozenRows(1);
    sheet.appendRow(['classPin', '2026']);
    sheet.appendRow(['registrationCode', 'CFGUSH26']);
    sheet.appendRow(['adminPin', 'cfgush26admin']);
    sheet.appendRow(['expectedStudents', 25]);
    sheet.appendRow(['schoolName', 'בית הספר הדיאלוגי']);
    sheet.appendRow(['season', '2026']);
    sheet.appendRow(['appBaseUrl', '']);  // fill with deployed app URL
  }
  return sheet;
}

function getSetting(key) {
  const sheet = getOrCreateSettingsSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) return values[i][1];
  }
  return null;
}

function seedDefaultParameters(sheet) {
  const defaults = [
    ['orientations', 'דינאמי'],
    ['orientations', 'CBT'],
    ['orientations', 'טיפול ממוקד טראומה - SE/EMDR'],
    ['orientations', 'טיפול זוגי'],
    ['orientations', 'מיניות'],
    ['orientations', 'התמכרויות'],
    ['populations', 'מבוגרים'],
    ['populations', 'נוער'],
    ['populations', 'ילדים'],
    ['populations', 'זוגות'],
    ['populations', 'משפחות'],
    ['specialties', 'טראומה'],
    ['specialties', 'חרדה ודיכאון'],
    ['specialties', 'אובדן ושכול'],
    ['specialties', 'הפרעות אכילה'],
    ['specialties', 'התמכרויות'],
    ['specialties', 'מיניות'],
    ['specialties', 'פסיכוזה'],
    ['specialties', 'ASD'],
    ['specialties', 'רגישות דתית/חרדית'],
    ['specialties', 'רב-תרבותי'],
    ['formats', 'פרונטלי'],
    ['formats', 'מקוון'],
    ['formats', 'היברידי'],
    ['areas', 'ירושלים'],
    ['areas', 'גוש עציון'],
    ['areas', 'מרכז'],
    ['areas', 'שפלה'],
    ['areas', 'צפון'],
    ['areas', 'דרום'],
    ['areas', 'שרון']
  ];
  sheet.getRange(2, 1, defaults.length, 2).setValues(defaults);
}

/* ========== Utils ========== */

function generateToken() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 14; i++) t += a[Math.floor(Math.random() * a.length)];
  return t;
}

function splitList(s) {
  if (!s) return [];
  return String(s).split(';').map(x => x.trim()).filter(Boolean);
}

function joinList(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.filter(Boolean).join(';');
}

function parseAvailability(s) {
  if (!s) return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch (e) { return {}; }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ========== Setup (run manually once) ========== */

function setupSheets() {
  getOrCreateSupervisorsSheet();
  getOrCreateParametersSheet();
  getOrCreateSettingsSheet();
  Logger.log('Setup complete. Sheets: Supervisors, Parameters, Settings');
}

/**
 * Run manually after upgrading to v2 (admin view + new orientations).
 * - Replaces all orientations rows in Parameters with the new 6-item list
 * - Maps existing supervisor orientations to the new list
 * - Adds adminPin & expectedStudents to Settings if missing
 * - Adds studentsAccepted column if missing
 */
function migrateToV2() {
  // 1) Update Parameters sheet — replace orientations rows
  const params = getOrCreateParametersSheet();
  const values = params.getDataRange().getValues();
  const keep = values.filter((row, i) => i === 0 || row[0] !== 'orientations');
  params.clearContents();
  params.getRange(1, 1, keep.length, 2).setValues(keep);
  const newOri = [
    ['orientations', 'דינאמי'],
    ['orientations', 'CBT'],
    ['orientations', 'טיפול ממוקד טראומה - SE/EMDR'],
    ['orientations', 'טיפול זוגי'],
    ['orientations', 'מיניות'],
    ['orientations', 'התמכרויות']
  ];
  params.getRange(params.getLastRow() + 1, 1, newOri.length, 2).setValues(newOri);

  // 2) Map existing supervisor data
  const map = {
    'פסיכודינמי': 'דינאמי',
    'יחסי-אובייקט': 'דינאמי',
    'JPT': 'דינאמי',
    'גשטאלט': 'דינאמי',
    'נרטיבי': 'דינאמי',
    'אינטגרטיבי': 'דינאמי',
    'מערכתי-משפחתי': 'טיפול זוגי',
    'EFT': 'טיפול זוגי',
    'CBT': 'CBT'
  };
  const sup = getOrCreateSupervisorsSheet();
  const sv = sup.getDataRange().getValues();
  const headers = sv[0];
  const oCol = headers.indexOf('orientations');
  if (oCol >= 0) {
    for (let i = 1; i < sv.length; i++) {
      const old = sv[i][oCol];
      if (!old) continue;
      const items = String(old).split(';').map(x => x.trim()).filter(Boolean);
      const mapped = Array.from(new Set(items.map(x => map[x] || x).filter(x => map[x] || ['דינאמי','CBT','טיפול ממוקד טראומה - SE/EMDR','טיפול זוגי','מיניות','התמכרויות'].includes(x))));
      sup.getRange(i + 1, oCol + 1).setValue(mapped.join(';'));
    }
  }

  // 3) Settings — add adminPin & expectedStudents if missing
  const settings = getOrCreateSettingsSheet();
  const sv2 = settings.getDataRange().getValues();
  const existingKeys = sv2.slice(1).map(r => r[0]);
  if (!existingKeys.includes('adminPin')) settings.appendRow(['adminPin', 'cfgush26admin']);
  if (!existingKeys.includes('expectedStudents')) settings.appendRow(['expectedStudents', 25]);

  // 4) Supervisors — add studentsAccepted column if missing
  if (!headers.includes('studentsAccepted')) {
    sup.getRange(1, headers.length + 1).setValue('studentsAccepted');
    if (sv.length > 1) {
      const zeros = Array(sv.length - 1).fill([0]);
      sup.getRange(2, headers.length + 1, sv.length - 1, 1).setValues(zeros);
    }
  }

  Logger.log('Migration v2 complete. Settings: adminPin=cfgush26admin, expectedStudents=25 (change as needed)');
}

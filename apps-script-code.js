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
const TAB_STUDENTS = 'Students';

const STUDENT_COLS = [
  'id', 'created', 'fullName', 'email', 'phone',
  'placedWith',   // supervisor token, or empty if not placed
  'placedDate',   // ISO date when placed, or empty
  'notes'
];

const SUPERVISOR_COLS = [
  'token', 'created', 'updated', 'published',
  'fullName', 'credential', 'yearsSupervising',
  'orientations', 'populations', 'specialties',
  'styleText', 'format', 'area',
  'availability', 'hasSpot',
  'phone', 'whatsappEnabled', 'email',
  'studentsAccepted',
  'mailed',         // TRUE after claim/registration email sent
  'maxStudents'     // capacity stated by supervisor (form, May 2026). ADMIN-ONLY — never sent to students.
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
      case 'claimSupervisor':        result = claimSupervisor(params); break;
      case 'getSupervisors':         result = getSupervisors(params); break;
      case 'getSupervisor':          result = getSupervisor(params); break;
      case 'saveSupervisor':         result = saveSupervisor(params); break;
      case 'getParameters':          result = getParameters(params); break;
      case 'getAdminStats':          result = getAdminStats(params); break;
      case 'getStudents':            result = getStudents(params); break;
      case 'addStudent':             result = addStudent(params); break;
      case 'updateStudent':          result = updateStudent(params); break;
      case 'deleteStudent':          result = deleteStudent(params); break;
      case 'bulkAddStudents':        result = bulkAddStudents(params); break;
      case 'getUnplacedStudents':    result = getUnplacedStudents(params); break;
      case 'getMyPlacedStudents':    result = getMyPlacedStudents(params); break;
      case 'claimStudent':           result = claimStudent(params); break;
      case 'unclaimStudent':         result = unclaimStudent(params); break;
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
    if (col === 'mailed') return true;
    return '';
  });
  sheet.appendRow(row);

  const personalUrl = (getSetting('appBaseUrl') || '') + 'supervisor.html?token=' + token;
  sendRegistrationEmail(email, name, personalUrl);

  return { token, personalUrl };
}

/* ========== Supervisor Claim (for pre-imported supervisors) ========== */

function claimSupervisor(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const name = String(p.name || '').trim();
  if (!email || !name) return { error: 'missing_fields' };

  const rows = readSupervisorRows();
  const match = rows.find(r => String(r.email || '').trim().toLowerCase() === email);

  if (!match) return { error: 'not_found' };

  // Loose name match: case-insensitive substring in either direction
  const sheetName = String(match.fullName || '').trim();
  const a = name.toLowerCase().replace(/["׳״]/g, '');
  const b = sheetName.toLowerCase().replace(/["׳״]/g, '');
  if (a !== b && !a.includes(b) && !b.includes(a)) {
    return { error: 'name_mismatch' };
  }

  return { token: match.token, fullName: match.fullName };
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
      studentsAccepted: Number(r.studentsAccepted) || 0,
      maxStudents: r.maxStudents === '' || r.maxStudents == null ? '' : Number(r.maxStudents)
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

  ensureMaxStudentsColumn();
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
    studentsAccepted: Math.max(0, Number(data.studentsAccepted) || 0),
    maxStudents: (data.maxStudents === '' || data.maxStudents == null) ? '' : Math.max(0, Number(data.maxStudents) || 0)
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
  ensureMaxStudentsColumn();
  const rows = readSupervisorRows();
  const students = readStudentRows();

  // Build supervisor token → name lookup
  const supByToken = {};
  rows.forEach(r => { if (r.token) supByToken[r.token] = r; });

  // Student-level placement tally (authoritative once students are tracked)
  const placedPerSupervisor = {};
  let placedCount = 0;
  students.forEach(s => {
    if (s.placedWith) {
      placedCount++;
      placedPerSupervisor[s.placedWith] = (placedPerSupervisor[s.placedWith] || 0) + 1;
    }
  });

  let publishedCount = 0;
  let withSpotCount = 0;
  let totalAccepted = 0;

  const supervisors = rows.map(r => {
    const published = r.published === true || r.published === 'TRUE' || r.published === 'true';
    const hasSpot = r.hasSpot === true || r.hasSpot === 'TRUE' || r.hasSpot === 'true';
    const selfReported = Number(r.studentsAccepted) || 0;
    const placedFromList = placedPerSupervisor[r.token] || 0;
    // If we have student records, prefer them; otherwise fall back to self-report
    const accepted = students.length > 0 ? placedFromList : selfReported;
    if (published) publishedCount++;
    if (hasSpot) withSpotCount++;
    totalAccepted += accepted;
    return {
      token: r.token || '',
      fullName: r.fullName || '(ללא שם)',
      credential: r.credential || '',
      published,
      hasSpot,
      studentsAccepted: accepted,
      selfReportedAccepted: selfReported,
      maxStudents: (r.maxStudents === '' || r.maxStudents == null) ? '' : Number(r.maxStudents),
      email: r.email || '',
      phone: r.phone || ''
    };
  });

  supervisors.sort((a, b) => (b.studentsAccepted - a.studentsAccepted) || a.fullName.localeCompare(b.fullName));

  // Source of truth: if student list exists, use its count; otherwise the legacy expectedStudents setting.
  const expectedStudents = students.length > 0 ? students.length : (Number(getSetting('expectedStudents')) || 0);
  const totalForRemaining = students.length > 0 ? placedCount : totalAccepted;

  return {
    summary: {
      totalSupervisors: rows.length,
      publishedCount,
      withSpotCount,
      totalAccepted: students.length > 0 ? placedCount : totalAccepted,
      expectedStudents,
      remaining: Math.max(0, expectedStudents - totalForRemaining),
      hasStudentList: students.length > 0
    },
    supervisors,
    students: students.map(s => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email || '',
      phone: s.phone || '',
      placedWith: s.placedWith || '',
      placedWithName: s.placedWith && supByToken[s.placedWith] ? supByToken[s.placedWith].fullName : '',
      placedDate: s.placedDate || '',
      notes: s.notes || ''
    }))
  };
}

/* ========== Students (admin-managed roster) ========== */

function getStudents(p) {
  requireAdminPin(p);
  const rows = readStudentRows();
  const sup = readSupervisorRows();
  const supByToken = {};
  sup.forEach(r => { if (r.token) supByToken[r.token] = r.fullName || ''; });
  return {
    students: rows.map(s => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email || '',
      phone: s.phone || '',
      placedWith: s.placedWith || '',
      placedWithName: s.placedWith ? (supByToken[s.placedWith] || '') : '',
      placedDate: s.placedDate || '',
      notes: s.notes || '',
      created: s.created || ''
    }))
  };
}

function addStudent(p) {
  requireAdminPin(p);
  const fullName = String(p.fullName || '').trim();
  if (!fullName) return { error: 'missing_name' };
  const sheet = getOrCreateStudentsSheet();
  const id = generateStudentId();
  const now = new Date().toISOString();
  const row = STUDENT_COLS.map(col => {
    switch (col) {
      case 'id': return id;
      case 'created': return now;
      case 'fullName': return fullName;
      case 'email': return String(p.email || '').trim();
      case 'phone': return String(p.phone || '').trim();
      case 'placedWith': return String(p.placedWith || '').trim();
      case 'placedDate': return p.placedWith ? now : '';
      case 'notes': return String(p.notes || '').trim();
      default: return '';
    }
  });
  sheet.appendRow(row);
  // Force phone column to text
  const phoneCol = STUDENT_COLS.indexOf('phone');
  if (phoneCol >= 0 && p.phone) {
    const r = sheet.getLastRow();
    sheet.getRange(r, phoneCol + 1).setNumberFormat('@').setValue(String(p.phone).trim());
  }
  return { ok: true, id };
}

function updateStudent(p) {
  requireAdminPin(p);
  const id = String(p.id || '');
  if (!id) return { error: 'missing_id' };
  const sheet = getOrCreateStudentsSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { error: 'schema_error' };

  let rowIdx = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) return { error: 'not_found' };

  const updatable = ['fullName', 'email', 'phone', 'placedWith', 'notes'];
  for (const k of updatable) {
    if (p[k] === undefined) continue;
    const col = headers.indexOf(k);
    if (col < 0) continue;
    const v = String(p[k] == null ? '' : p[k]).trim();
    const cell = sheet.getRange(rowIdx, col + 1);
    if (k === 'phone') {
      cell.setNumberFormat('@').setValue(v);
    } else {
      cell.setValue(v);
    }
  }
  // If placedWith was set, stamp placedDate (or clear it when unassigned)
  if (p.placedWith !== undefined) {
    const dateCol = headers.indexOf('placedDate');
    if (dateCol >= 0) {
      const newPlaced = String(p.placedWith || '').trim();
      const prev = String(values[rowIdx - 1][headers.indexOf('placedWith')] || '').trim();
      if (newPlaced && newPlaced !== prev) {
        sheet.getRange(rowIdx, dateCol + 1).setValue(new Date().toISOString());
      } else if (!newPlaced) {
        sheet.getRange(rowIdx, dateCol + 1).setValue('');
      }
    }
  }
  return { ok: true };
}

function deleteStudent(p) {
  requireAdminPin(p);
  const id = String(p.id || '');
  if (!id) return { error: 'missing_id' };
  const sheet = getOrCreateStudentsSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { error: 'schema_error' };
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'not_found' };
}

function bulkAddStudents(p) {
  requireAdminPin(p);
  const text = String(p.names || '');
  // Each line = one student. Optional: "Name, email, phone" comma-separated.
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return { error: 'empty' };

  const sheet = getOrCreateStudentsSheet();
  const existing = readStudentRows();
  const existingNames = new Set(existing.map(s => String(s.fullName || '').trim().toLowerCase()));
  const existingEmails = new Set(existing.map(s => String(s.email || '').trim().toLowerCase()).filter(Boolean));

  let added = 0, skipped = 0;
  const now = new Date().toISOString();
  const newRows = [];
  for (const line of lines) {
    const parts = line.split(',').map(x => x.trim());
    const fullName = parts[0] || '';
    const email = parts[1] || '';
    const phone = parts[2] || '';
    if (!fullName) { skipped++; continue; }
    const nameKey = fullName.toLowerCase();
    const emailKey = email.toLowerCase();
    if (existingNames.has(nameKey) || (emailKey && existingEmails.has(emailKey))) { skipped++; continue; }
    existingNames.add(nameKey);
    if (emailKey) existingEmails.add(emailKey);
    newRows.push(STUDENT_COLS.map(col => {
      switch (col) {
        case 'id': return generateStudentId();
        case 'created': return now;
        case 'fullName': return fullName;
        case 'email': return email;
        case 'phone': return phone;
        case 'placedWith': return '';
        case 'placedDate': return '';
        case 'notes': return '';
        default: return '';
      }
    }));
    added++;
  }
  if (newRows.length) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, STUDENT_COLS.length).setValues(newRows);
    const phoneCol = STUDENT_COLS.indexOf('phone');
    if (phoneCol >= 0) {
      sheet.getRange(startRow, phoneCol + 1, newRows.length, 1).setNumberFormat('@');
    }
  }
  return { ok: true, added, skipped };
}

/* ========== Students (supervisor-facing — token-authenticated) ========== */

function requireSupervisorToken(p) {
  const token = String(p.token || '');
  if (!token) throw new Error('missing_token');
  const rows = readSupervisorRows();
  const sup = rows.find(r => String(r.token) === token);
  if (!sup) throw new Error('invalid_token');
  return sup;
}

function getUnplacedStudents(p) {
  requireSupervisorToken(p);
  const rows = readStudentRows();
  const unplaced = rows.filter(s => !String(s.placedWith || '').trim());
  // Sort alphabetically
  unplaced.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
  return {
    students: unplaced.map(s => ({ id: s.id, fullName: s.fullName }))
  };
}

function getMyPlacedStudents(p) {
  const sup = requireSupervisorToken(p);
  const rows = readStudentRows();
  const mine = rows.filter(s => String(s.placedWith || '').trim() === sup.token);
  mine.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
  return {
    students: mine.map(s => ({
      id: s.id,
      fullName: s.fullName,
      placedDate: s.placedDate || ''
    }))
  };
}

function claimStudent(p) {
  const sup = requireSupervisorToken(p);
  const id = String(p.id || '');
  if (!id) return { error: 'missing_id' };
  const sheet = getOrCreateStudentsSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  const placedCol = headers.indexOf('placedWith');
  const dateCol = headers.indexOf('placedDate');
  if (idCol < 0 || placedCol < 0) return { error: 'schema_error' };

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) {
      const current = String(values[i][placedCol] || '').trim();
      // Refuse if already claimed by someone else (race protection)
      if (current && current !== sup.token) {
        return { error: 'already_claimed' };
      }
      sheet.getRange(i + 1, placedCol + 1).setValue(sup.token);
      if (dateCol >= 0) sheet.getRange(i + 1, dateCol + 1).setValue(new Date().toISOString());
      return { ok: true };
    }
  }
  return { error: 'not_found' };
}

function unclaimStudent(p) {
  const sup = requireSupervisorToken(p);
  const id = String(p.id || '');
  if (!id) return { error: 'missing_id' };
  const sheet = getOrCreateStudentsSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  const placedCol = headers.indexOf('placedWith');
  const dateCol = headers.indexOf('placedDate');
  if (idCol < 0 || placedCol < 0) return { error: 'schema_error' };

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) {
      const current = String(values[i][placedCol] || '').trim();
      // Only the supervisor who claimed can release
      if (current !== sup.token) {
        return { error: 'not_yours' };
      }
      sheet.getRange(i + 1, placedCol + 1).setValue('');
      if (dateCol >= 0) sheet.getRange(i + 1, dateCol + 1).setValue('');
      return { ok: true };
    }
  }
  return { error: 'not_found' };
}

function readStudentRows() {
  const sheet = getOrCreateStudentsSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row[headers.indexOf('id')]).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getOrCreateStudentsSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(TAB_STUDENTS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_STUDENTS);
    sheet.appendRow(STUDENT_COLS);
    sheet.setFrozenRows(1);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, STUDENT_COLS.length).getValues()[0];
    if (!firstRow[0]) sheet.getRange(1, 1, 1, STUDENT_COLS.length).setValues([STUDENT_COLS]);
  }
  return sheet;
}

function generateStudentId() {
  return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
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

/* ========== Bulk Import (for older supervisors who can't fill the form themselves) ========== */

const TAB_BULK_IMPORT = 'BulkImport';
const BULK_COLS = [
  'imported',          // TRUE after script processed this row
  'fullName',          // required
  'email',             // required (used to match in claim flow)
  'credential',
  'yearsSupervising',
  'orientations',      // semicolon-separated, e.g. "דינאמי;CBT"
  'populations',       // semicolon-separated
  'specialties',       // semicolon-separated
  'styleText',
  'format',            // "פרונטלי" / "מקוון" / "היברידי"
  'area',
  'phone',
  'whatsappEnabled',   // TRUE / FALSE
  'hasSpot',           // TRUE / FALSE (default TRUE)
  'autoPublish'        // TRUE = mark as published automatically; FALSE = save as draft
];

function getOrCreateBulkImportSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(TAB_BULK_IMPORT);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_BULK_IMPORT);
    sheet.appendRow(BULK_COLS);
    sheet.setFrozenRows(1);
    // Sample row for guidance (commented out fields)
    sheet.appendRow([
      false,
      'שם מלא לדוגמה — מחק שורה זו',
      'example@example.com',
      'פסיכולוג קליני, MA',
      15,
      'דינאמי;CBT',
      'מבוגרים;נוער',
      'טראומה;חרדה ודיכאון',
      'תיאור קצר של הסגנון. 50 תווים מינימום.',
      'היברידי',
      'ירושלים',
      '0501234567',
      true,
      true,
      false
    ]);
    sheet.setColumnWidths(1, BULK_COLS.length, 140);
    Logger.log('Created BulkImport sheet. Fill rows and run bulkImportFromSheet().');
  }
  return sheet;
}

/**
 * Read all unimported rows from the BulkImport sheet, create supervisor records,
 * and mark each row as imported. Sends a "your profile is ready" email to each
 * supervisor with their personal claim link.
 *
 * Run this manually after filling rows in the BulkImport sheet.
 */
function bulkImportFromSheet() {
  return _bulkImportImpl(true);
}

/**
 * Same as bulkImportFromSheet but does NOT send the claim email.
 *
 * Use when staff wants to fill in profiles on behalf of supervisors before
 * announcing the directory. Each new supervisor row is created with
 * mailed=FALSE; later, run sendInvitationsToUnmailed() to send the mails.
 */
function bulkImportSilent() {
  return _bulkImportImpl(false);
}

function _bulkImportImpl(sendMail) {
  ensureMailedColumn();
  const sheet = getOrCreateBulkImportSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log('BulkImport sheet is empty.');
    return;
  }
  const headers = values[0];
  const supSheet = getOrCreateSupervisorsSheet();
  const supHeaders = supSheet.getRange(1, 1, 1, supSheet.getLastColumn()).getValues()[0];
  const baseUrl = getSetting('appBaseUrl') || '';

  let created = 0;
  let skipped = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });

    if (obj.imported === true || obj.imported === 'TRUE' || obj.imported === 'true') {
      skipped++;
      continue;
    }
    if (!obj.fullName || !obj.email) {
      skipped++;
      continue;
    }

    const token = generateToken();
    const now = new Date().toISOString();

    const supRow = supHeaders.map(col => {
      switch (col) {
        case 'token': return token;
        case 'created': return now;
        case 'updated': return now;
        case 'published': return obj.autoPublish === true || obj.autoPublish === 'TRUE' || obj.autoPublish === 'true';
        case 'fullName': return String(obj.fullName).trim();
        case 'credential': return obj.credential || '';
        case 'yearsSupervising': return Number(obj.yearsSupervising) || 0;
        case 'orientations': return obj.orientations || '';
        case 'populations': return obj.populations || '';
        case 'specialties': return obj.specialties || '';
        case 'styleText': return obj.styleText || '';
        case 'format': return obj.format || '';
        case 'area': return obj.area || '';
        case 'availability': return '{}';
        case 'hasSpot': {
          const v = obj.hasSpot;
          if (v === '' || v == null) return true;
          return v === true || v === 'TRUE' || v === 'true';
        }
        case 'phone': return String(obj.phone || '').trim();
        case 'whatsappEnabled': return obj.whatsappEnabled === true || obj.whatsappEnabled === 'TRUE' || obj.whatsappEnabled === 'true';
        case 'email': return String(obj.email).trim().toLowerCase();
        case 'studentsAccepted': return 0;
        case 'mailed': return !!sendMail;
        default: return '';
      }
    });
    supSheet.appendRow(supRow);

    // Re-set phone column to text format on the just-appended row
    const newRowIdx = supSheet.getLastRow();
    const phoneCol = supHeaders.indexOf('phone');
    if (phoneCol >= 0) {
      const cell = supSheet.getRange(newRowIdx, phoneCol + 1);
      cell.setNumberFormat('@');
      cell.setValue(String(obj.phone || '').trim());
    }

    // Mark BulkImport row as imported
    const importedCol = headers.indexOf('imported');
    if (importedCol >= 0) sheet.getRange(i + 1, importedCol + 1).setValue(true);

    // Send claim email if requested
    if (sendMail) {
      sendClaimEmail(String(obj.email).trim(), String(obj.fullName).trim(), baseUrl);
    }
    created++;
  }

  const mailNote = sendMail ? 'mails sent' : 'NO mails sent (silent mode)';
  Logger.log(`Bulk import done. Created: ${created}, skipped (already imported / missing fields): ${skipped}. ${mailNote}`);
}

/**
 * Send the "your profile is ready" mail to every supervisor whose
 * mailed column is explicitly FALSE. Marks each as mailed=TRUE on success.
 *
 * Rows with mailed='' (empty / pre-existing) are NOT mailed — that's the
 * safety guard so old supervisors aren't accidentally re-mailed.
 */
function sendInvitationsToUnmailed() {
  ensureMailedColumn();
  const sheet = getOrCreateSupervisorsSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) { Logger.log('No supervisors.'); return; }

  const headers = values[0];
  const mailedCol = headers.indexOf('mailed');
  const emailCol = headers.indexOf('email');
  const nameCol = headers.indexOf('fullName');
  if (mailedCol < 0 || emailCol < 0 || nameCol < 0) {
    Logger.log('Missing required column.');
    return;
  }

  const baseUrl = getSetting('appBaseUrl') || '';
  let sent = 0, skipped = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const v = row[mailedCol];
    // Only mail rows where mailed is explicitly FALSE (not empty/blank)
    const isFalse = v === false || v === 'FALSE' || v === 'false';
    if (!isFalse) { skipped++; continue; }
    const email = String(row[emailCol] || '').trim();
    const name = String(row[nameCol] || '').trim();
    if (!email || !name) { skipped++; continue; }

    sendClaimEmail(email, name, baseUrl);
    sheet.getRange(i + 1, mailedCol + 1).setValue(true);
    sent++;
  }

  Logger.log(`Invitations sent: ${sent}, skipped: ${skipped}`);
}

/**
 * Idempotent migration helper. Adds the 'mailed' column to the Supervisors
 * sheet if it doesn't exist, defaulting all existing rows to TRUE
 * (assume previously created supervisors were already mailed).
 */
function ensureMailedColumn() {
  const sheet = getOrCreateSupervisorsSheet();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('mailed') >= 0) return;

  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue('mailed');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = [];
    for (let i = 0; i < lastRow - 1; i++) vals.push([true]);
    sheet.getRange(2, newCol, lastRow - 1, 1).setValues(vals);
  }
  Logger.log('Added "mailed" column to Supervisors. Existing rows defaulted to TRUE.');
}

/**
 * Adds the "maxStudents" column to the Supervisors tab if missing.
 * Admin-only capacity field (how many supervisees the supervisor can take).
 * Existing rows default to '' (unknown). Safe to run repeatedly.
 */
function ensureMaxStudentsColumn() {
  const sheet = getOrCreateSupervisorsSheet();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('maxStudents') >= 0) return;

  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue('maxStudents');
  Logger.log('Added "maxStudents" column to Supervisors (admin-only). Existing rows left blank.');
}

function sendClaimEmail(toEmail, name, baseUrl) {
  try {
    const schoolName = getSetting('schoolName') || 'בית הספר הדיאלוגי';
    const claimUrl = (baseUrl || '') + 'claim.html';
    MailApp.sendEmail({
      to: toEmail,
      subject: 'הפרופיל שלך מוכן — ' + schoolName,
      htmlBody:
        '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7">' +
        '<p>שלום ' + escapeHtml(name) + ',</p>' +
        '<p>צוות ' + escapeHtml(schoolName) + ' הכין עבורך פרופיל מוכן במאגר המדריכים.</p>' +
        '<p><b>איך נכנסים לערוך:</b></p>' +
        '<ol>' +
        '<li>פתח/י את הקישור: <a href="' + claimUrl + '">' + claimUrl + '</a></li>' +
        '<li>הזן/י את השם המלא והמייל שלך — זה המייל הזה</li>' +
        '<li>תיכנס/י לפרופיל ותוכל/י לעבור עליו, לתקן ולפרסם</li>' +
        '</ol>' +
        '<p>אין צורך בקוד או בסיסמה — השם והמייל שלך הם המפתח.</p>' +
        '<p>בהצלחה,<br>צוות בית הספר</p>' +
        '</div>'
    });
  } catch (e) {
    // best-effort
  }
}

/* ========== Seed: Hadialogy directory (run once) ========== */

/**
 * Pre-fill the BulkImport sheet with the 16 supervisors from the Hadialogy
 * directory (data scraped from jewishpsychology.org/hadialogy + bogrim_h.php).
 *
 * Skips any email that already exists in Supervisors or BulkImport so it's
 * safe to re-run. After running, review the BulkImport rows in the Sheet,
 * fix anything wrong, then run bulkImportFromSheet() to send claim emails.
 *
 * imported is left FALSE; autoPublish is FALSE — supervisor reviews and
 * publishes from claim.html.
 */
function seedHadialogyDirectory() {
  const seedRows = [
    // From hadialogy/#9 (צוות מקצועי + צוות עמיתי הוראה)
    { fullName: 'ד"ר ברוך כהנא',          email: 'kahanabh@gmail.com',           credential: 'פסיכולוג קליני מומחה' },
    { fullName: 'ד"ר יפעה מליק-גרינברג',  email: 'yifaor@walla.com',             credential: 'פסיכיאטרית מתמחה' },
    { fullName: 'ד"ר קארן לרנר',          email: 'karenlmt5@gmail.com',          credential: 'פסיכולוגית קלינית' },
    { fullName: 'איתן כלפה',              email: 'eitan.calfa@mail.huji.ac.il',  credential: 'פסיכולוג קליני מומחה - מדריך' },
    { fullName: 'גבריאל פרץ',             email: 'gabrielperetz@gmail.com',      credential: 'פסיכולוג קליני מדריך' },
    { fullName: 'נעמי אשואל',             email: 'naomiashwal7@gmail.com',       credential: 'פסיכולוגית קלינית, חינוכית ומדריכה' },
    { fullName: 'ד"ר חגי סרי',            email: 'hagai.s@meuhedet.co.il',       credential: 'פסיכולוג קליני מומחה' },
    { fullName: 'ד"ר נילי פויירשטיין',    email: 'fnili175@gmail.com',           credential: 'פסיכולוגית ועו"ס קלינית' },
    { fullName: 'חנה יאיר בוריה',         email: 'Ybhana@gmail.com',             credential: 'עו"ס פסיכותרפיסטית, מדריכה בטיפול זוגי' },
    { fullName: 'נועם לב',                email: 'noamlow@gmail.com',            credential: 'פסיכולוג קליני מומחה' },
    { fullName: 'אבי יעקובסון',           email: 'Aviyacobson@gmail.com',        credential: 'פסיכולוג קליני מומחה' },
    { fullName: 'בנימין גולדנהירש',       email: 'benjaminfranklin1@gmail.com',  credential: 'פסיכולוג קליני וחינוכי – מדריך' },
    // From bogrim_h.php (no photo, but we have phone + area + role)
    { fullName: 'נריה קרין',              email: 'neriakarin@gmail.com',         credential: 'עו"ס קלינית, פסיכואנליטיקאית', orientations: 'דינאמי', phone: '0507724704', area: 'שרון' },
    { fullName: 'אפרת ברום',              email: 'efratbrom@gmail.com',          credential: '',                            phone: '0527906319', area: 'שילה' },
    // Not found on either site — name+email only, supervisor fills the rest in claim
    { fullName: 'טליק לרנר',              email: 'taliklerner@gmail.com' },
    { fullName: 'דני קורנבליט',           email: 'donnyk23@gmail.com' }
  ];

  const bulkSheet = getOrCreateBulkImportSheet();
  const supSheet = getOrCreateSupervisorsSheet();

  // Collect existing emails (lowercased) from both sheets to skip dupes
  const existingEmails = new Set();
  const supValues = supSheet.getDataRange().getValues();
  if (supValues.length > 1) {
    const supHeaders = supValues[0];
    const emailCol = supHeaders.indexOf('email');
    if (emailCol >= 0) {
      for (let i = 1; i < supValues.length; i++) {
        const v = String(supValues[i][emailCol] || '').trim().toLowerCase();
        if (v) existingEmails.add(v);
      }
    }
  }
  const bulkValues = bulkSheet.getDataRange().getValues();
  if (bulkValues.length > 1) {
    const bulkHeaders = bulkValues[0];
    const emailCol = bulkHeaders.indexOf('email');
    if (emailCol >= 0) {
      for (let i = 1; i < bulkValues.length; i++) {
        const v = String(bulkValues[i][emailCol] || '').trim().toLowerCase();
        if (v) existingEmails.add(v);
      }
    }
  }

  let added = 0;
  let skipped = 0;
  const newRows = [];
  for (const r of seedRows) {
    const e = String(r.email || '').trim().toLowerCase();
    if (!e || existingEmails.has(e)) { skipped++; continue; }
    existingEmails.add(e);
    newRows.push(BULK_COLS.map(col => {
      switch (col) {
        case 'imported':        return false;
        case 'fullName':        return r.fullName || '';
        case 'email':           return r.email || '';
        case 'credential':      return r.credential || '';
        case 'yearsSupervising':return '';
        case 'orientations':    return r.orientations || '';
        case 'populations':     return r.populations || '';
        case 'specialties':     return r.specialties || '';
        case 'styleText':       return r.styleText || '';
        case 'format':          return r.format || '';
        case 'area':            return r.area || '';
        case 'phone':           return r.phone || '';
        case 'whatsappEnabled': return false;
        case 'hasSpot':         return true;
        case 'autoPublish':     return false;
        default:                return '';
      }
    }));
    added++;
  }

  if (newRows.length) {
    const startRow = bulkSheet.getLastRow() + 1;
    bulkSheet.getRange(startRow, 1, newRows.length, BULK_COLS.length).setValues(newRows);
    // Force phone column to text so leading zeros survive
    const phoneCol = BULK_COLS.indexOf('phone');
    if (phoneCol >= 0) {
      bulkSheet.getRange(startRow, phoneCol + 1, newRows.length, 1).setNumberFormat('@');
    }
  }

  Logger.log('seedHadialogyDirectory: added ' + added + ', skipped (dupe/empty): ' + skipped);
}

/* ========== Setup (run manually once) ========== */

function setupSheets() {
  getOrCreateSupervisorsSheet();
  getOrCreateParametersSheet();
  getOrCreateSettingsSheet();
  getOrCreateBulkImportSheet();
  getOrCreateStudentsSheet();
  Logger.log('Setup complete. Sheets: Supervisors, Parameters, Settings, BulkImport, Students');
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

  // 5) BulkImport tab
  getOrCreateBulkImportSheet();

  Logger.log('Migration v2 complete. Settings: adminPin=cfgush26admin, expectedStudents=25 (change as needed). BulkImport tab created.');
}

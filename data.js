// ============================================================================
// データ層。localStorage にすべてのデータをブラウザ内保存する（外部送信なし）。
// 従業員マスタ / 勤怠記録 / 給与明細履歴 / 賞与明細履歴 を管理する。
// ============================================================================

const STORAGE_KEY = 'payrollAttendanceApp.v1';

function defaultDB() {
  return { employees: [], attendance: {}, payslips: {}, bonuses: {} };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    return {
      employees: parsed.employees || [],
      attendance: parsed.attendance || {},
      payslips: parsed.payslips || {},
      bonuses: parsed.bonuses || {},
    };
  } catch (e) {
    return defaultDB();
  }
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// 従業員マスタ
// ---------------------------------------------------------------------------
function listEmployees() {
  return loadDB().employees.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

function getEmployee(id) {
  return loadDB().employees.find((e) => e.id === id) || null;
}

// emp.id が未設定なら新規追加、設定済みなら更新
function saveEmployee(emp) {
  const db = loadDB();
  if (emp.id) {
    const i = db.employees.findIndex((e) => e.id === emp.id);
    if (i >= 0) db.employees[i] = emp;
    else db.employees.push(emp);
  } else {
    emp.id = genId('emp');
    db.employees.push(emp);
  }
  saveDB(db);
  return emp;
}

function deleteEmployee(id) {
  const db = loadDB();
  db.employees = db.employees.filter((e) => e.id !== id);
  delete db.attendance[id];
  delete db.payslips[id];
  delete db.bonuses[id];
  saveDB(db);
}

// ---------------------------------------------------------------------------
// 勤怠記録
// ym: 'YYYY-MM' 形式、day: 1〜31（数値 or 文字列どちらでも可）
// record: { clockIn: 'HH:MM', clockOut: 'HH:MM', breakMinutes: number, status, note }
// status: 'normal' | 'paid_leave' | 'absence' | 'holiday_work'
// ---------------------------------------------------------------------------
function getMonthAttendance(empId, ym) {
  const db = loadDB();
  return (db.attendance[empId] && db.attendance[empId][ym]) || {};
}

function setDayAttendance(empId, ym, day, record) {
  const db = loadDB();
  db.attendance[empId] = db.attendance[empId] || {};
  db.attendance[empId][ym] = db.attendance[empId][ym] || {};
  const key = String(day);
  if (record === null) {
    delete db.attendance[empId][ym][key];
  } else {
    db.attendance[empId][ym][key] = record;
  }
  saveDB(db);
}

function timeToMinutes(t) {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

const ATTENDANCE_STATUS_LABELS = {
  normal: '通常',
  paid_leave: '有給休暇',
  absence: '欠勤',
  holiday_work: '休日出勤',
};

// 従業員の所定労働設定をもとに、1か月分の勤怠から集計値を計算する
function computeMonthSummary(employee, ym) {
  const records = getMonthAttendance(employee.id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const standardDailyMinutes = (employee.standardDailyHours || 8) * 60;
  const stdStartMin = timeToMinutes(employee.workStart || '09:00');
  const stdEndMin = timeToMinutes(employee.workEnd || '18:00');

  let workedMinutesTotal = 0;
  let overtimeMinutesTotal = 0;
  let lateMinutesTotal = 0;
  let earlyLeaveMinutesTotal = 0;
  let absenceDays = 0;
  let paidLeaveDays = 0;
  let holidayWorkDays = 0;
  let workDays = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const rec = records[String(d)];
    if (!rec) continue;
    if (rec.status === 'absence') { absenceDays++; continue; }
    if (rec.status === 'paid_leave') { paidLeaveDays++; continue; }

    const inMin = timeToMinutes(rec.clockIn);
    const outMin = timeToMinutes(rec.clockOut);
    if (inMin === null || outMin === null) continue;

    const breakMin = Number(rec.breakMinutes) || 0;
    const worked = Math.max(0, outMin - inMin - breakMin);
    workedMinutesTotal += worked;
    workDays++;

    if (rec.status === 'holiday_work') {
      holidayWorkDays++;
      overtimeMinutesTotal += worked; // 休日出勤分は全時間を割増対象の残業として扱う
      continue;
    }

    if (inMin > stdStartMin) { lateMinutesTotal += (inMin - stdStartMin); lateCount++; }
    if (outMin < stdEndMin && worked < standardDailyMinutes) { earlyLeaveMinutesTotal += (stdEndMin - outMin); earlyLeaveCount++; }
    if (worked > standardDailyMinutes) overtimeMinutesTotal += (worked - standardDailyMinutes);
  }

  return {
    ym,
    workDays,
    workedHours: workedMinutesTotal / 60,
    overtimeHours: overtimeMinutesTotal / 60,
    lateMinutes: lateMinutesTotal,
    lateCount,
    earlyLeaveMinutes: earlyLeaveMinutesTotal,
    earlyLeaveCount,
    absenceDays,
    paidLeaveDays,
    holidayWorkDays,
  };
}

// ---------------------------------------------------------------------------
// 給与明細履歴（従業員ID × 年月をキーに1件保存）
// ---------------------------------------------------------------------------
function savePayslip(empId, ym, data) {
  const db = loadDB();
  db.payslips[empId] = db.payslips[empId] || {};
  db.payslips[empId][ym] = Object.assign({}, data, { savedAt: new Date().toISOString() });
  saveDB(db);
}

function getPayslip(empId, ym) {
  const db = loadDB();
  return (db.payslips[empId] && db.payslips[empId][ym]) || null;
}

function listPayslips(empId) {
  const db = loadDB();
  return db.payslips[empId] || {};
}

function deletePayslip(empId, ym) {
  const db = loadDB();
  if (db.payslips[empId]) delete db.payslips[empId][ym];
  saveDB(db);
}

// ---------------------------------------------------------------------------
// 賞与明細履歴（従業員ID配下に配列で保存、複数回の賞与支給に対応）
// ---------------------------------------------------------------------------
function listBonuses(empId) {
  const db = loadDB();
  return (db.bonuses[empId] || []).slice().sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

function saveBonusRecord(empId, bonusRecord) {
  const db = loadDB();
  db.bonuses[empId] = db.bonuses[empId] || [];
  if (bonusRecord.id) {
    const i = db.bonuses[empId].findIndex((b) => b.id === bonusRecord.id);
    if (i >= 0) db.bonuses[empId][i] = bonusRecord;
    else db.bonuses[empId].push(bonusRecord);
  } else {
    bonusRecord.id = genId('bonus');
    db.bonuses[empId].push(bonusRecord);
  }
  saveDB(db);
  return bonusRecord;
}

function deleteBonusRecord(empId, bonusId) {
  const db = loadDB();
  if (db.bonuses[empId]) db.bonuses[empId] = db.bonuses[empId].filter((b) => b.id !== bonusId);
  saveDB(db);
}

// ---------------------------------------------------------------------------
// ダッシュボード集計用ヘルパー
// ---------------------------------------------------------------------------
function currentYm() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

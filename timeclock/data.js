// ============================================================================
// データ層。Supabase（Postgres + RLS）に会社ごとのデータを保存する。
// 各テーブルは行レベルセキュリティ（RLS）で user_id = auth.uid() の行だけを
// 読み書きできるよう制限されているため、SELECT時に自分で絞り込む必要はない。
// 従業員マスタ / 勤怠記録 / 給与明細履歴 / 賞与明細履歴 / 会社設定を管理する。
// ============================================================================

async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインしていません。');
  return user.id;
}

function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// 従業員マスタ
// ---------------------------------------------------------------------------
function employeeRowToObj(row) {
  const obj = {
    id: row.id,
    name: row.name,
    nameKana: row.name_kana || '',
    employmentType: row.employment_type,
    birthDate: row.birth_date,
    baseSalary: row.base_salary,
    allowances: row.allowances || [],
    commuteAllowance: row.commute_allowance,
    commuteAllowanceExcludeFromOvertimeBase: row.commute_allowance_exclude,
    dependents: row.dependents,
    taxTable: row.tax_table,
    residentTax: row.resident_tax,
    workStart: row.work_start,
    workEnd: row.work_end,
    standardDailyHours: Number(row.standard_daily_hours),
    monthlyStandardHours: Number(row.monthly_standard_hours),
    monthlyStandardDays: Number(row.monthly_standard_days),
  };
  const rates = row.overtime_rates || {};
  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    obj[c.key] = rates[c.key] !== undefined ? rates[c.key] : c.defaultRate;
  });
  return obj;
}

function employeeObjToRow(emp, userId) {
  const rates = {};
  OVERTIME_RATE_CATEGORIES.forEach((c) => { rates[c.key] = emp[c.key]; });
  return {
    user_id: userId,
    name: emp.name,
    name_kana: emp.nameKana || null,
    employment_type: emp.employmentType,
    birth_date: emp.birthDate || null,
    base_salary: emp.baseSalary,
    allowances: emp.allowances || [],
    commute_allowance: emp.commuteAllowance,
    commute_allowance_exclude: emp.commuteAllowanceExcludeFromOvertimeBase,
    dependents: emp.dependents,
    tax_table: emp.taxTable,
    resident_tax: emp.residentTax,
    work_start: emp.workStart,
    work_end: emp.workEnd,
    standard_daily_hours: emp.standardDailyHours,
    monthly_standard_hours: emp.monthlyStandardHours,
    monthly_standard_days: emp.monthlyStandardDays,
    overtime_rates: rates,
    updated_at: new Date().toISOString(),
  };
}

async function listEmployees() {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) throw error;
  return data.map(employeeRowToObj);
}

async function getEmployee(id) {
  const { data, error } = await supabase.from('employees').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? employeeRowToObj(data) : null;
}

// emp.id が未設定なら新規追加、設定済みなら更新
async function saveEmployee(emp) {
  const userId = await getCurrentUserId();
  const row = employeeObjToRow(emp, userId);
  if (emp.id) {
    const { data, error } = await supabase.from('employees').update(row).eq('id', emp.id).select().single();
    if (error) throw error;
    return employeeRowToObj(data);
  }
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return employeeRowToObj(data);
}

// 従業員を削除すると、紐づく勤怠・給与明細・賞与明細もDBの外部キー制約により自動削除される
async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 勤怠記録
// ym: 'YYYY-MM' 形式、day: 1〜31（数値 or 文字列どちらでも可）
// record: { clockIn: 'HH:MM', clockOut: 'HH:MM', breakMinutes: number, status }
// status: 'normal' | 'paid_leave' | 'absence' | 'holiday_work'
// ---------------------------------------------------------------------------
async function getMonthAttendance(employeeId, ym) {
  const { data, error } = await supabase
    .from('attendance_records').select('*').eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
  const result = {};
  for (const row of data) {
    result[String(row.day)] = {
      clockIn: row.clock_in || '',
      clockOut: row.clock_out || '',
      breakMinutes: row.break_minutes,
      status: row.status,
    };
  }
  return result;
}

async function setDayAttendance(employeeId, ym, day, record) {
  if (record === null) {
    const { error } = await supabase.from('attendance_records').delete()
      .eq('employee_id', employeeId).eq('ym', ym).eq('day', day);
    if (error) throw error;
    return;
  }
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('attendance_records').upsert({
    user_id: userId,
    employee_id: employeeId,
    ym,
    day: Number(day),
    clock_in: record.clockIn || null,
    clock_out: record.clockOut || null,
    break_minutes: Number(record.breakMinutes) || 0,
    status: record.status || 'normal',
  }, { onConflict: 'employee_id,ym,day' });
  if (error) throw error;
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
async function computeMonthSummary(employee, ym) {
  const records = await getMonthAttendance(employee.id, ym);
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
async function savePayslip(employeeId, ym, data) {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('payslips').upsert({
    user_id: userId,
    employee_id: employeeId,
    ym,
    input: data.input,
    result: data.result,
    saved_at: new Date().toISOString(),
  }, { onConflict: 'employee_id,ym' });
  if (error) throw error;
}

async function getPayslip(employeeId, ym) {
  const { data, error } = await supabase.from('payslips').select('*')
    .eq('employee_id', employeeId).eq('ym', ym).maybeSingle();
  if (error) throw error;
  return data ? { input: data.input, result: data.result, savedAt: data.saved_at } : null;
}

async function listPayslips(employeeId) {
  const { data, error } = await supabase.from('payslips').select('*').eq('employee_id', employeeId);
  if (error) throw error;
  const result = {};
  for (const row of data) result[row.ym] = { input: row.input, result: row.result, savedAt: row.saved_at };
  return result;
}

async function deletePayslip(employeeId, ym) {
  const { error } = await supabase.from('payslips').delete().eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 賞与明細履歴（従業員ごとに複数件、複数回の賞与支給に対応）
// ---------------------------------------------------------------------------
function bonusRowToObj(row) {
  return { id: row.id, label: row.label || '', date: row.bonus_date || '', input: row.input, result: row.result };
}

async function listBonuses(employeeId) {
  const { data, error } = await supabase.from('bonuses').select('*')
    .eq('employee_id', employeeId).order('bonus_date', { ascending: true });
  if (error) throw error;
  return data.map(bonusRowToObj);
}

async function saveBonusRecord(employeeId, bonusRecord) {
  if (bonusRecord.id) {
    const { data, error } = await supabase.from('bonuses').update({
      label: bonusRecord.label || null,
      bonus_date: bonusRecord.date || null,
      input: bonusRecord.input,
      result: bonusRecord.result,
    }).eq('id', bonusRecord.id).select().single();
    if (error) throw error;
    return bonusRowToObj(data);
  }
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from('bonuses').insert({
    user_id: userId,
    employee_id: employeeId,
    label: bonusRecord.label || null,
    bonus_date: bonusRecord.date || null,
    input: bonusRecord.input,
    result: bonusRecord.result,
  }).select().single();
  if (error) throw error;
  return bonusRowToObj(data);
}

async function deleteBonusRecord(employeeId, bonusId) {
  const { error } = await supabase.from('bonuses').delete().eq('id', bonusId).eq('employee_id', employeeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 会社マスタ（保険料率設定。ログインユーザー1人＝会社1社の単一レコード）
// ---------------------------------------------------------------------------
function defaultCompany() {
  return {
    companyName: '',
    healthInsuranceType: 'kyoukai',
    prefecture: '東京',
    healthRate: PREFECTURE_HEALTH_RATES['東京'],
    careRate: CARE_RATE_DEFAULT,
    pensionRate: PENSION_RATE_DEFAULT,
    industryType: '一般の事業',
    employmentRate: EMPLOYMENT_RATES_BY_INDUSTRY['一般の事業'],
    calcMethod: 'table',
  };
}

async function getCompany() {
  const { data, error } = await supabase.from('company_settings').select('*').maybeSingle();
  if (error) throw error;
  if (!data) return defaultCompany();
  return {
    companyName: data.company_name || '',
    healthInsuranceType: data.health_insurance_type,
    prefecture: data.prefecture,
    healthRate: Number(data.health_rate),
    careRate: Number(data.care_rate),
    pensionRate: Number(data.pension_rate),
    industryType: data.industry_type,
    employmentRate: Number(data.employment_rate),
    calcMethod: data.calc_method,
  };
}

async function saveCompany(company) {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('company_settings').upsert({
    user_id: userId,
    company_name: company.companyName || null,
    health_insurance_type: company.healthInsuranceType,
    prefecture: company.prefecture,
    health_rate: company.healthRate,
    care_rate: company.careRate,
    pension_rate: company.pensionRate,
    industry_type: company.industryType,
    employment_rate: company.employmentRate,
    calc_method: company.calcMethod,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ダッシュボード集計用ヘルパー
// ---------------------------------------------------------------------------
function currentYm() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

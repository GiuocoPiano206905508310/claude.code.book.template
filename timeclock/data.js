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
    employeeNumber: row.employee_number || '',
    department: row.department || '',
    name: row.name,
    nameKana: row.name_kana || '',
    gender: row.gender || '男性',
    genderOther: row.gender_other || '',
    employeeCode: row.employee_code || '',
    loginPassword: row.login_password || '',
    employmentType: row.employment_type,
    hireDate: row.hire_date,
    birthDate: row.birth_date,
    baseSalary: row.base_salary,
    allowances: row.allowances || [],
    commuteAllowance: row.commute_allowance,
    commuteAllowanceExcludeFromOvertimeBase: row.commute_allowance_exclude,
    dependents: row.dependents,
    taxTable: row.tax_table,
    workStart: row.work_start,
    workEnd: row.work_end,
    standardDailyHours: Number(row.standard_daily_hours),
    weeklyScheduledDays: Number(row.weekly_scheduled_days) || 5,
    monthlyStandardHours: Number(row.monthly_standard_hours),
    monthlyStandardDays: Number(row.monthly_standard_days),
  };
  const rates = row.overtime_rates || {};
  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    obj[c.key] = rates[c.key] !== undefined ? rates[c.key] : c.defaultRate;
  });
  const fixedOT = row.fixed_overtime || {};
  obj.fixedOvertimeEnabled = !!fixedOT.enabled;
  obj.fixedOvertimeAllowanceName = fixedOT.allowanceName || '';
  obj.fixedOvertimeMonthlyHours = Number(fixedOT.monthlyHours) || 0;
  obj.fixedOvertimeAmount = Number(fixedOT.amount) || 0;
  obj.fixedOvertimeBaseCategories = Array.isArray(fixedOT.baseCategories) && fixedOT.baseCategories.length
    ? fixedOT.baseCategories : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES.slice();
  const socialIns = row.social_insurance || {};
  const fixedOTAmountForStandard = obj.fixedOvertimeEnabled ? obj.fixedOvertimeAmount : 0;
  const standardMonthlyBase = computeStandardMonthlyBase(
    obj.baseSalary, fixedOTAmountForStandard, sumNonExcludedFromSocialInsurance(obj.allowances), obj.commuteAllowance
  );
  obj.healthInsuranceNumber = socialIns.healthInsuranceNumber || '';
  obj.healthStandardMonthly = Number(socialIns.healthStandardMonthly)
    || lookupStandardMonthlyAmount(standardMonthlyBase, HEALTH_STANDARD_BRACKETS);
  obj.pensionStandardMonthly = Number(socialIns.pensionStandardMonthly)
    || lookupStandardMonthlyAmount(standardMonthlyBase, PENSION_STANDARD_BRACKETS);
  return obj;
}

function employeeObjToRow(emp, userId) {
  const rates = {};
  OVERTIME_RATE_CATEGORIES.forEach((c) => { rates[c.key] = emp[c.key]; });
  return {
    user_id: userId,
    employee_number: emp.employeeNumber || null,
    department: emp.department || null,
    name: emp.name,
    name_kana: emp.nameKana || null,
    gender: emp.gender || null,
    gender_other: emp.genderOther || null,
    employee_code: emp.employeeCode || null,
    login_password: emp.loginPassword || null,
    employment_type: emp.employmentType,
    hire_date: emp.hireDate || null,
    birth_date: emp.birthDate || null,
    base_salary: emp.baseSalary,
    allowances: emp.allowances || [],
    commute_allowance: emp.commuteAllowance,
    commute_allowance_exclude: emp.commuteAllowanceExcludeFromOvertimeBase,
    dependents: emp.dependents,
    tax_table: emp.taxTable,
    work_start: emp.workStart,
    work_end: emp.workEnd,
    standard_daily_hours: emp.standardDailyHours,
    weekly_scheduled_days: emp.weeklyScheduledDays,
    monthly_standard_hours: emp.monthlyStandardHours,
    monthly_standard_days: emp.monthlyStandardDays,
    overtime_rates: rates,
    fixed_overtime: {
      enabled: !!emp.fixedOvertimeEnabled,
      allowanceName: emp.fixedOvertimeAllowanceName || '',
      monthlyHours: Number(emp.fixedOvertimeMonthlyHours) || 0,
      amount: Number(emp.fixedOvertimeAmount) || 0,
      baseCategories: (emp.fixedOvertimeBaseCategories && emp.fixedOvertimeBaseCategories.length)
        ? emp.fixedOvertimeBaseCategories : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES.slice(),
    },
    social_insurance: {
      healthInsuranceNumber: emp.healthInsuranceNumber || '',
      healthStandardMonthly: Number(emp.healthStandardMonthly) || 0,
      pensionStandardMonthly: Number(emp.pensionStandardMonthly) || 0,
    },
    updated_at: new Date().toISOString(),
  };
}

async function listEmployees() {
  const { data, error } = await supabaseClient.from('employees').select('*').order('name');
  if (error) throw error;
  return data.map(employeeRowToObj);
}

// 従業員が1人でも登録されているか（打刻ログイン前の画面表示用。
// パスワード等を含む全件データを読み込まずに済むよう件数のみ取得する）
async function hasAnyEmployees() {
  const { count, error } = await supabaseClient.from('employees').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count || 0) > 0;
}

async function getEmployee(id) {
  const { data, error } = await supabaseClient.from('employees').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? employeeRowToObj(data) : null;
}

// 勤怠打刻システムの従業員ログイン用。ユーザーIDで1件だけを取得する
// （全従業員のパスワードを一括で端末に読み込まないようにするため）
async function getEmployeeByCode(employeeCode) {
  const { data, error } = await supabaseClient.from('employees').select('*')
    .eq('employee_code', employeeCode).maybeSingle();
  if (error) throw error;
  return data ? employeeRowToObj(data) : null;
}

// emp.id が未設定なら新規追加、設定済みなら更新
async function saveEmployee(emp) {
  const userId = await getCurrentUserId();
  const row = employeeObjToRow(emp, userId);
  if (emp.id) {
    const { data, error } = await supabaseClient.from('employees').update(row).eq('id', emp.id).select().single();
    if (error) throw error;
    return employeeRowToObj(data);
  }
  const { data, error } = await supabaseClient.from('employees').insert(row).select().single();
  if (error) throw error;
  return employeeRowToObj(data);
}

// 従業員を削除すると、紐づく勤怠・給与明細・賞与明細もDBの外部キー制約により自動削除される
async function deleteEmployee(id) {
  const { error } = await supabaseClient.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 勤怠記録
// ym: 'YYYY-MM' 形式、day: 1〜31（数値 or 文字列どちらでも可）
// record: { clockIn: 'HH:MM', clockOut: 'HH:MM', breakMinutes: number, status }
// status: 'normal' | 'paid_leave' | 'absence' | 'holiday_work'
// ---------------------------------------------------------------------------
async function getMonthAttendance(employeeId, ym) {
  const { data, error } = await supabaseClient
    .from('attendance_records').select('*').eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
  const result = {};
  for (const row of data) {
    result[String(row.day)] = {
      clockIn: row.clock_in || '',
      clockOut: row.clock_out || '',
      scheduledStart: row.scheduled_start || '',
      scheduledEnd: row.scheduled_end || '',
      breakMinutes: row.break_minutes,
      status: row.status,
    };
  }
  return result;
}

async function setDayAttendance(employeeId, ym, day, record) {
  if (record === null) {
    const { error } = await supabaseClient.from('attendance_records').delete()
      .eq('employee_id', employeeId).eq('ym', ym).eq('day', day);
    if (error) throw error;
    return;
  }
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient.from('attendance_records').upsert({
    user_id: userId,
    employee_id: employeeId,
    ym,
    day: Number(day),
    clock_in: record.clockIn || null,
    clock_out: record.clockOut || null,
    scheduled_start: record.scheduledStart || null,
    scheduled_end: record.scheduledEnd || null,
    break_minutes: Number(record.breakMinutes) || 0,
    status: record.status || 'normal',
  }, { onConflict: 'employee_id,ym,day' });
  if (error) throw error;
}

// 指定期間（両端含む、'YYYY-MM-DD'形式）に日次勤怠入力でステータスが「有給休暇」
// となっている日数を数える（有給休暇管理簿の取得日数の算定に使用。半日単位には
// 対応していないため、1日単位の取得としてカウントする）
async function countPaidLeaveDaysBetween(employeeId, startDateStr, endDateStr) {
  const { data, error } = await supabaseClient.from('attendance_records').select('ym, day, status')
    .eq('employee_id', employeeId).eq('status', 'paid_leave');
  if (error) throw error;
  return data.filter((row) => {
    const dateStr = `${row.ym}-${String(row.day).padStart(2, '0')}`;
    return dateStr >= startDateStr && dateStr <= endDateStr;
  }).length;
}

function ymKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

// 期間内の各日について実際の(ym, day)に対応する勤怠レコードを取得し、
// 1始まりの連番でまとめ直す（月をまたぐ期間の場合は関係する月の分だけ
// getMonthAttendanceを呼び出してマージする）
async function fetchPeriodRecords(employeeId, periodDates) {
  const yms = [...new Set(periodDates.map((date) => ymKey(date.y, date.m)))];
  const byYm = {};
  for (const ym of yms) {
    byYm[ym] = await getMonthAttendance(employeeId, ym);
  }
  const records = {};
  periodDates.forEach((date, i) => {
    const rec = byYm[ymKey(date.y, date.m)][String(date.d)];
    if (rec) records[String(i + 1)] = rec;
  });
  return records;
}

// periodDatesの週残業・週深夜残業を、月・期間をまたぐ週も正しく計上できるよう
// 計算する。periodDatesの先頭が週の途中から始まる場合、その週の起算日まで
// 遡って前月分の実績を取得・合算した上でcomputeWeeklyOvertimeByDayを呼び出す
// （calcLeadingWeekPadDates参照。末尾が週の途中で終わる場合はcomputeWeeklyOvertimeByDay
// 側の仕様によりその週は0として返され、その週の最終日を含む次の期間の計算時に
// 同様の遡り処理によって正しく計上される）。
// records: 呼び出し側がすでに取得済みのperiodDates分の勤怠記録（fetchPeriodRecordsの
// 戻り値と同じ形式）。ここでは前月分の追加取得のみ行い、二重取得はしない。
// company: 渡された場合、打刻の丸め設定を出勤・退勤時刻に適用する
async function computeWeeklyOvertimeWithPadding(employeeId, periodDates, records, overtimeCategoryPerDay, weekStartDay, weeklyOvertimeThreshold, company) {
  if (!periodDates.length) return {};
  const leadingPad = calcLeadingWeekPadDates(periodDates[0], weekStartDay);
  if (!leadingPad.length) {
    return computeWeeklyOvertimeByDay(records, overtimeCategoryPerDay, periodDates, weekStartDay, weeklyOvertimeThreshold, company);
  }

  const padYm = ymKey(leadingPad[0].y, leadingPad[0].m);
  const padMonthRecords = await getMonthAttendance(employeeId, padYm);
  const padDaysInMonth = new Date(leadingPad[0].y, leadingPad[0].m, 0).getDate();
  const { perDay: padMonthPerDay } = computeOvertimeCategoryBreakdown(padMonthRecords, padDaysInMonth, company);

  const extendedDates = leadingPad.concat(periodDates);
  const extendedRecords = {};
  const extendedPerDay = {};
  leadingPad.forEach((date, i) => {
    const rec = padMonthRecords[String(date.d)];
    if (rec) extendedRecords[String(i + 1)] = rec;
    extendedPerDay[i + 1] = padMonthPerDay[date.d];
  });
  periodDates.forEach((date, i) => {
    const idx = leadingPad.length + i + 1;
    const rec = records[String(i + 1)];
    if (rec) extendedRecords[String(idx)] = rec;
    extendedPerDay[idx] = overtimeCategoryPerDay[i + 1];
  });

  const extendedResult = computeWeeklyOvertimeByDay(extendedRecords, extendedPerDay, extendedDates, weekStartDay, weeklyOvertimeThreshold, company);

  const result = {};
  periodDates.forEach((date, i) => {
    result[i + 1] = extendedResult[leadingPad.length + i + 1];
  });
  return result;
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
  scheduled_holiday_work: '所定休日',
  statutory_holiday_work: '法定休日',
  holiday_work: '休日出勤（旧）', // 旧データ互換用。以後は所定休日／法定休日のいずれかで記録される
};

// 従業員の所定労働設定をもとに、1か月分の勤怠から集計値を計算する。
// companyを渡すと、会社マスタ管理の「週の起算日」「週法定外労働時間」に基づく
// 週残業・週深夜残業時間の当月合計もoventimeCategoryMonthTotalsに含める
// （固定残業代の計算等、週残業分も含めた区分別合計が必要な場面で使用する）。
async function computeMonthSummary(employee, ym, company) {
  const records = await getMonthAttendance(employee.id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const standardDailyMinutes = (employee.standardDailyHours || 8) * 60;
  const defaultStdStartMin = timeToMinutes(employee.workStart || '09:00');
  const defaultStdEndMin = timeToMinutes(employee.workEnd || '18:00');

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

    const inMin = roundClockInMinutes(timeToMinutes(rec.clockIn), company);
    const outMin = roundClockOutMinutes(timeToMinutes(rec.clockOut), company);
    if (inMin === null || outMin === null) continue;

    const breakMin = Number(rec.breakMinutes) || 0;
    const worked = Math.max(0, outMin - inMin - breakMin);
    workedMinutesTotal += worked;
    workDays++;

    if (isScheduledHolidayStatus(rec.status) || isStatutoryHolidayStatus(rec.status)) {
      holidayWorkDays++;
      overtimeMinutesTotal += worked; // 休日出勤分は全時間を割増対象の残業として扱う
      continue;
    }

    const stdStartMin = timeToMinutes(rec.scheduledStart) ?? defaultStdStartMin;
    const stdEndMin = timeToMinutes(rec.scheduledEnd) ?? defaultStdEndMin;
    if (inMin > stdStartMin) { lateMinutesTotal += (inMin - stdStartMin); lateCount++; }
    if (outMin < stdEndMin && worked < standardDailyMinutes) { earlyLeaveMinutesTotal += (stdEndMin - outMin); earlyLeaveCount++; }
    if (worked > standardDailyMinutes) overtimeMinutesTotal += (worked - standardDailyMinutes);
  }

  const { perDay: overtimeCategoryPerDay, monthTotals: overtimeCategoryMonthTotals } =
    computeOvertimeCategoryBreakdown(records, daysInMonth, company);

  if (company) {
    const periodDates = buildCalendarMonthDates(y, m);
    const weeklyByDay = await computeWeeklyOvertimeWithPadding(
      employee.id, periodDates, records, overtimeCategoryPerDay, company.weekStartDay, company.weeklyOvertimeThreshold, company
    );
    let weeklyOvertimeMonthTotal = 0;
    let weeklyOvertimeNightMonthTotal = 0;
    Object.values(weeklyByDay).forEach((w) => {
      weeklyOvertimeMonthTotal += w.weeklyOvertime;
      weeklyOvertimeNightMonthTotal += w.weeklyOvertimeNight;
    });
    overtimeCategoryMonthTotals.weeklyOvertime = weeklyOvertimeMonthTotal;
    overtimeCategoryMonthTotals.weeklyOvertimeNight = weeklyOvertimeNightMonthTotal;
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
    overtimeCategoryPerDay,
    overtimeCategoryMonthTotals,
  };
}

// ---------------------------------------------------------------------------
// 給与明細履歴（従業員ID × 年月をキーに1件保存）
// ---------------------------------------------------------------------------
async function savePayslip(employeeId, ym, data) {
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient.from('payslips').upsert({
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
  const { data, error } = await supabaseClient.from('payslips').select('*')
    .eq('employee_id', employeeId).eq('ym', ym).maybeSingle();
  if (error) throw error;
  return data ? { input: data.input, result: data.result, savedAt: data.saved_at } : null;
}

async function listPayslips(employeeId) {
  const { data, error } = await supabaseClient.from('payslips').select('*').eq('employee_id', employeeId);
  if (error) throw error;
  const result = {};
  for (const row of data) result[row.ym] = { input: row.input, result: row.result, savedAt: row.saved_at };
  return result;
}

async function deletePayslip(employeeId, ym) {
  const { error } = await supabaseClient.from('payslips').delete().eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 賞与明細履歴（従業員ごとに複数件、複数回の賞与支給に対応）
// ---------------------------------------------------------------------------
function bonusRowToObj(row) {
  return { id: row.id, label: row.label || '', date: row.bonus_date || '', input: row.input, result: row.result };
}

async function listBonuses(employeeId) {
  const { data, error } = await supabaseClient.from('bonuses').select('*')
    .eq('employee_id', employeeId).order('bonus_date', { ascending: true });
  if (error) throw error;
  return data.map(bonusRowToObj);
}

async function saveBonusRecord(employeeId, bonusRecord) {
  if (bonusRecord.id) {
    const { data, error } = await supabaseClient.from('bonuses').update({
      label: bonusRecord.label || null,
      bonus_date: bonusRecord.date || null,
      input: bonusRecord.input,
      result: bonusRecord.result,
    }).eq('id', bonusRecord.id).select().single();
    if (error) throw error;
    return bonusRowToObj(data);
  }
  const userId = await getCurrentUserId();
  const { data, error } = await supabaseClient.from('bonuses').insert({
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
  const { error } = await supabaseClient.from('bonuses').delete().eq('id', bonusId).eq('employee_id', employeeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 会社マスタ（保険料率設定。ログインユーザー1人＝会社1社の単一レコード）
// ---------------------------------------------------------------------------
// 勤怠丸め設定のデフォルト（打刻の丸め設定を参照。単位は分、method: 'up'=切り上げ/'down'=切り捨て）
function defaultRoundingRules() {
  return {
    clockIn: { minutes: 15, method: 'up' },
    clockOut: { minutes: 15, method: 'down' },
    breakStart: { minutes: 15, method: 'up' },
    breakEnd: { minutes: 15, method: 'down' },
  };
}

function defaultCompany() {
  return {
    companyName: '',
    statutoryHolidayWeekday: 0, // 0=日曜日 〜 6=土曜日
    scheduledHolidayWeekday: 6, // 0=日曜日 〜 6=土曜日
    weekStartDay: 0, // 0=日曜日 〜 6=土曜日（週の起算日）
    weeklyOvertimeThreshold: 40, // 週法定外労働時間の基準（40 または 44。特例措置対象事業場のみ44）
    paycheckClosingDay: 'end', // 1〜31 または 'end'（末日）
    paycheckPaymentDay: '25', // 1〜31 または 'end'（末日）
    healthInsuranceType: 'kyoukai',
    prefecture: '東京',
    healthRate: PREFECTURE_HEALTH_RATES['東京'],
    careRate: CARE_RATE_DEFAULT,
    pensionRate: PENSION_RATE_DEFAULT,
    industryType: '一般の事業',
    employmentRate: EMPLOYMENT_RATES_BY_INDUSTRY['一般の事業'],
    calcMethod: 'table',
    // 勤怠丸め設定（デフォルト無＝1分単位で計算。出勤・退勤のみ実際の計算に反映され、
    // 休憩開始・休憩終了は設定を保存するのみで計算には未反映）
    roundingEnabled: false,
    roundingRules: defaultRoundingRules(),
    // 割増賃金計算における端数処理設定（労働基準局通達に基づく3項目。デフォルト適用なし）
    overtimeFractionRules: {
      monthlyHoursRounding: false, // (1) 月間の時間外・休日・深夜業時間数の30分未満切捨て・以上切上げ
      hourlyWageRounding: false, // (2) 時給・割増単価の50銭未満切捨て・以上切上げ
      monthlyPayRounding: false, // (3) 月間の時間外・休日・深夜業の割増賃金総額の50銭未満切捨て・以上切上げ
    },
    // 1か月の賃金支払額における端数処理設定（デフォルト適用なし）
    monthlyPaymentFractionRules: {
      round100: false, // (1) 賃金支払額の100円未満端数を50円未満切捨て・以上切上げ
      carryOver1000: false, // (2) 1,000円未満の端数を翌月の賃金支払日に繰り越して支払う
    },
  };
}

// サインアップ時にuser_idのみのプレースホルダー行を作成しているため（login.js参照）、
// 行自体は存在してもほとんどの列がnull/undefinedの場合がある。列ごとに未設定なら
// defaultCompany()の値にフォールバックする（存在チェックを行全体ではなく列単位で行う）。
async function getCompany() {
  const { data, error } = await supabaseClient.from('company_settings').select('*').maybeSingle();
  if (error) throw error;
  const defaults = defaultCompany();
  if (!data) return defaults;
  const orNum = (v, fallback) => (v !== null && v !== undefined ? Number(v) : fallback);
  return {
    companyName: data.company_name || defaults.companyName,
    statutoryHolidayWeekday: orNum(data.statutory_holiday_weekday, defaults.statutoryHolidayWeekday),
    scheduledHolidayWeekday: orNum(data.scheduled_holiday_weekday, defaults.scheduledHolidayWeekday),
    weekStartDay: orNum(data.week_start_day, defaults.weekStartDay),
    weeklyOvertimeThreshold: orNum(data.weekly_overtime_threshold, defaults.weeklyOvertimeThreshold),
    paycheckClosingDay: data.paycheck_closing_day || defaults.paycheckClosingDay,
    paycheckPaymentDay: data.paycheck_payment_day || defaults.paycheckPaymentDay,
    healthInsuranceType: data.health_insurance_type || defaults.healthInsuranceType,
    prefecture: data.prefecture || defaults.prefecture,
    healthRate: orNum(data.health_rate, defaults.healthRate),
    careRate: orNum(data.care_rate, defaults.careRate),
    pensionRate: orNum(data.pension_rate, defaults.pensionRate),
    industryType: data.industry_type || defaults.industryType,
    employmentRate: orNum(data.employment_rate, defaults.employmentRate),
    calcMethod: data.calc_method || defaults.calcMethod,
    roundingEnabled: data.rounding_enabled !== null && data.rounding_enabled !== undefined ? !!data.rounding_enabled : defaults.roundingEnabled,
    roundingRules: data.rounding_rules || defaults.roundingRules,
    overtimeFractionRules: data.overtime_fraction_rules || defaults.overtimeFractionRules,
    monthlyPaymentFractionRules: data.monthly_payment_fraction_rules || defaults.monthlyPaymentFractionRules,
  };
}

async function saveCompany(company) {
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient.from('company_settings').upsert({
    user_id: userId,
    company_name: company.companyName || null,
    statutory_holiday_weekday: company.statutoryHolidayWeekday,
    scheduled_holiday_weekday: company.scheduledHolidayWeekday,
    week_start_day: company.weekStartDay,
    weekly_overtime_threshold: company.weeklyOvertimeThreshold,
    paycheck_closing_day: String(company.paycheckClosingDay || 'end'),
    paycheck_payment_day: String(company.paycheckPaymentDay || 'end'),
    health_insurance_type: company.healthInsuranceType,
    prefecture: company.prefecture,
    health_rate: company.healthRate,
    care_rate: company.careRate,
    pension_rate: company.pensionRate,
    industry_type: company.industryType,
    employment_rate: company.employmentRate,
    calc_method: company.calcMethod,
    rounding_enabled: !!company.roundingEnabled,
    rounding_rules: company.roundingRules || defaultRoundingRules(),
    overtime_fraction_rules: company.overtimeFractionRules || {},
    monthly_payment_fraction_rules: company.monthlyPaymentFractionRules || {},
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

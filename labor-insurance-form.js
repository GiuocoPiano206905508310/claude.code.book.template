// ============================================================================
// 労働保険 年度更新（確定保険料・一般拠出金算定基礎賃金集計表）の
// Excel様式（forms/chingin-shukeihyo.xlsx）への差し込み内容を組み立てる
//
// このExcel様式は、厚生労働省が公開している賃金集計表（様式のレイアウトを
// 本アプリ向けに簡略化して作成したもの）です。原本の官公庁配布ファイルは
// 古い形式（.xls）で本アプリの動作環境では直接編集できないため、同じ集計
// 項目・計算方法を持つ様式を新規に作成し、様式内に合計・平均・千円未満
// 切り捨ての数式を組み込んでいます（月ごとの実績値のみ差し込めば、開いた
// ときに自動計算されます）。
// ============================================================================

const CHINGIN_SHUKEIHYO_FORM = {
  templateUrl: 'forms/chingin-shukeihyo.xlsx',
  titleCell: 'A1',
  periodCell: 'A2',
  header: {
    laborInsuranceNumber: 'A5',
    officeName: 'D5',
    zipCode: 'H5',
    phone: 'J5',
    address: 'A7',
    businessDescription: 'B7',
  },
  monthStartRow: 12, // A12＝4月, ..., A23＝翌3月
  bonusStartRow: 24, // A24〜A26＝賞与1〜3
  // 区分ごとの列（人・円）。区分2・6（役員で労働者扱いの人）は本アプリでは常に0で出力する
  categoryColumns: {
    category1: { count: 'B', wage: 'C' },
    category2: { count: 'D', wage: 'E' },
    category3: { count: 'F', wage: 'G' },
    category4: { count: 'H', wage: 'I' },
    category5: { count: 'J', wage: 'K' },
    category6: { count: 'L', wage: 'M' },
    category7: { count: 'N', wage: 'O' },
  },
};

function laborInsuranceNumberText(info) {
  if (!info) return '';
  const parts = [info.prefectureCode, info.officeCode, info.jurisdiction].filter(Boolean).join('');
  const base = info.baseNumber || '';
  const branch = info.branchNumber || '';
  if (!parts && !base && !branch) return '';
  return `${parts}－${base}－${branch}`;
}

// summary: computeLaborInsuranceSummary()の戻り値、company: 会社マスタ（従業員マスタで
// 分かる範囲の事業所情報のみ差し込む。労働保険番号等は会社マスタ管理で入力した内容を使用）
function buildLaborInsuranceFormValues(summary, company) {
  const form = CHINGIN_SHUKEIHYO_FORM;
  const values = {};
  const laborInfo = (company && company.laborInsuranceInfo) || {};

  values[form.titleCell] = `令和${toReiwaYear(summary.year)}年度　確定保険料・一般拠出金算定基礎賃金集計表`;
  values[form.periodCell] = `（算定期間　令和${toReiwaYear(summary.year)}年4月～令和${toReiwaYear(summary.year + 1)}年3月）`;

  values[form.header.laborInsuranceNumber] = laborInsuranceNumberText(laborInfo);
  if (company && company.companyName) values[form.header.officeName] = company.companyName;
  if (laborInfo.zipCode) values[form.header.zipCode] = laborInfo.zipCode;
  if (laborInfo.phone) values[form.header.phone] = laborInfo.phone;
  if (laborInfo.address) values[form.header.address] = laborInfo.address;
  if (laborInfo.businessDescription) values[form.header.businessDescription] = laborInfo.businessDescription;

  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return `令和${toReiwaYear(y)}年${m}月`;
  };

  summary.monthRows.forEach((row, i) => {
    const excelRow = form.monthStartRow + i;
    values[`A${excelRow}`] = monthLabel(row.paymentYm);
    Object.entries(form.categoryColumns).forEach(([key, cols]) => {
      const bucket = row[key];
      values[`${cols.count}${excelRow}`] = bucket.count;
      values[`${cols.wage}${excelRow}`] = bucket.wage;
    });
  });

  summary.bonusRows.forEach((row, i) => {
    const excelRow = form.bonusStartRow + i;
    const [y, m] = row.ym.split('-').map(Number);
    values[`A${excelRow}`] = `賞与　令和${toReiwaYear(y)}年${m}月`;
    values[`${form.categoryColumns.category4.wage}${excelRow}`] = row.category4Wage;
    values[`${form.categoryColumns.category7.wage}${excelRow}`] = row.category7Wage;
  });

  return values;
}

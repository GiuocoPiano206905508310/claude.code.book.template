// 協会けんぽ「令和8年度都道府県単位保険料率」（都道府県名 → 健康保険料率(%)、全体）
const PREFECTURE_HEALTH_RATES = {
  '北海道': 10.28, '青森': 9.85, '岩手': 9.51, '宮城': 10.10, '秋田': 10.01,
  '山形': 9.75, '福島': 9.50, '茨城': 9.52, '栃木': 9.82, '群馬': 9.68,
  '埼玉': 9.67, '千葉': 9.73, '東京': 9.85, '神奈川': 9.92, '新潟': 9.21,
  '富山': 9.59, '石川': 9.70, '福井': 9.71, '山梨': 9.55, '長野': 9.63,
  '岐阜': 9.80, '静岡': 9.61, '愛知': 9.93, '三重': 9.77, '滋賀': 9.88,
  '京都': 9.89, '大阪': 10.13, '兵庫': 10.12, '奈良': 9.91, '和歌山': 10.06,
  '鳥取': 9.86, '島根': 9.94, '岡山': 10.05, '広島': 9.78, '山口': 10.15,
  '徳島': 10.24, '香川': 10.02, '愛媛': 9.98, '高知': 10.05, '福岡': 10.11,
  '佐賀': 10.55, '長崎': 10.06, '熊本': 10.08, '大分': 10.08, '宮崎': 9.77,
  '鹿児島': 10.13, '沖縄': 9.44,
};
// 介護保険料率・子ども子育て支援金率は全国一律（令和8年度）
const CARE_RATE_DEFAULT = 1.62;
const CHILD_SUPPORT_LEVY_RATE_DEFAULT = 0.23; // 全体率。令和8年4月分（5月納付分）から徴収、労使折半

// 厚生労働省「令和8年度雇用保険料率」（労働者負担分・失業等給付等の保険料率のみ、令和8年4月～令和9年3月）
const EMPLOYMENT_RATES_BY_INDUSTRY = {
  '一般の事業': 0.5,
  '農林水産・清酒製造の事業': 0.6,
  '建設の事業': 0.6,
};

function populatePrefectureSelect(selectId, healthId, careId, childLevyId) {
  const select = document.getElementById(selectId);
  for (const name of Object.keys(PREFECTURE_HEALTH_RATES)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === '東京') option.selected = true;
    select.appendChild(option);
  }
  applyPrefectureRate(selectId, healthId, careId, childLevyId);
}

function applyPrefectureRate(selectId, healthId, careId, childLevyId) {
  const prefecture = document.getElementById(selectId).value;
  document.getElementById(healthId).value = PREFECTURE_HEALTH_RATES[prefecture].toFixed(2);
  document.getElementById(careId).value = CARE_RATE_DEFAULT.toFixed(2);
  document.getElementById(childLevyId).value = CHILD_SUPPORT_LEVY_RATE_DEFAULT.toFixed(2);
}

// 健康保険の種類（協会けんぽ／健康保険組合）の切り替え
// 協会けんぽ：都道府県選択欄を表示し、健康保険料率・介護保険料率・子ども子育て支援金料率は都道府県/全国一律の値から自動入力（編集不可）
// 健康保険組合：都道府県選択欄を隠し、健康保険料率・介護保険料率・子ども子育て支援金料率とも手動入力（厚生年金保険料率は影響を受けない）
function applyHealthInsuranceType(typeId, prefectureRowId, prefectureSelectId, healthId, careId, childLevyId, healthLabelId, careLabelId, childLevyLabelId) {
  const isKumiai = document.getElementById(typeId).value === 'kumiai';
  document.getElementById(prefectureRowId).style.display = isKumiai ? 'none' : '';
  document.getElementById(healthId).readOnly = !isKumiai;
  document.getElementById(careId).readOnly = !isKumiai;
  document.getElementById(childLevyId).readOnly = !isKumiai;
  document.getElementById(healthLabelId).textContent = isKumiai ? '健康保険料率（手動入力）' : '健康保険料率（自動入力）';
  document.getElementById(careLabelId).textContent = isKumiai ? '介護保険料率（手動入力）' : '介護保険料率（全国一律）';
  document.getElementById(childLevyLabelId).textContent = isKumiai ? '子ども・子育て支援金料率（手動入力）' : '子ども・子育て支援金料率（全国一律）';
  if (!isKumiai) {
    applyPrefectureRate(prefectureSelectId, healthId, careId, childLevyId);
  }
}

// 雇用形態による保険料率欄の表示切り替え
// アルバイト・パート（雇用保険のみ対象）：健康保険・厚生年金関連の欄を非表示にし、雇用保険関連の欄のみ表示
// アルバイト・パート（雇用保険対象外）：健康保険・厚生年金・雇用保険関連の欄をすべて非表示
// 役員：雇用保険の対象外のため、雇用保険関連の欄を非表示
function updateInsuranceFieldVisibility(o) {
  const employmentType = document.getElementById(o.employmentTypeId).value;
  const hideHealthGroup = employmentType === 'アルバイト・パート' || employmentType === 'アルバイト・パート（雇用保険対象外）';
  const hideEmploymentGroup = employmentType === 'アルバイト・パート（雇用保険対象外）' || employmentType === '役員';

  o.healthGroupIds.forEach(id => { document.getElementById(id).style.display = hideHealthGroup ? 'none' : ''; });
  o.employmentGroupIds.forEach(id => { document.getElementById(id).style.display = hideEmploymentGroup ? 'none' : ''; });

  if (hideHealthGroup) {
    document.getElementById(o.prefectureRowId).style.display = 'none';
  } else {
    applyHealthInsuranceType(o.healthTypeId, o.prefectureRowId, o.prefectureSelectId, o.healthRateId, o.careRateId, o.childLevyRateId, o.healthRateLabelId, o.careRateLabelId, o.childLevyRateLabelId);
  }
}

function populateIndustrySelect(selectId, rateId) {
  const select = document.getElementById(selectId);
  for (const name of Object.keys(EMPLOYMENT_RATES_BY_INDUSTRY)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  applyIndustryRate(selectId, rateId);
}

function applyIndustryRate(selectId, rateId) {
  const industry = document.getElementById(selectId).value;
  document.getElementById(rateId).value = EMPLOYMENT_RATES_BY_INDUSTRY[industry].toFixed(2);
}

// 数字にカンマを付けて表示する入力欄
function attachThousandsFormatting(id) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    const cursorPos = input.selectionStart;
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/[^\d]/g, '').length;
    const raw = input.value.replace(/[^\d]/g, '');
    input.value = raw === '' ? '' : Number(raw).toLocaleString('en-US');
    let count = 0, pos = input.value.length;
    for (let i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i])) count++;
      if (count === digitsBeforeCursor) { pos = i + 1; break; }
    }
    input.setSelectionRange(pos, pos);
  });
}

function getNumValue(id) {
  const raw = document.getElementById(id).value.replace(/,/g, '');
  return Number(raw) || 0;
}

// 被保険者負担額の1円未満の端数処理（健康保険法・厚生年金保険法等）：50銭以下は切り捨て、50銭を超える端数は切り上げ
// 通常の四捨五入（Math.round）とはちょうど50銭のときの扱いが逆になるため、専用の丸め処理を行う
function roundInsuranceShare(x) {
  const floor = Math.floor(x);
  return x - floor > 0.5 ? floor + 1 : floor;
}

// 年齢区分ごとの社会保険加入ルール
const AGE_RULES = {
  under40: { care: false, pension: true, health: true },
  '40to64': { care: true, pension: true, health: true },
  '65to69': { care: false, pension: true, health: true },
  '70to74': { care: false, pension: false, health: true },
  '75plus': { care: false, pension: false, health: false },
};

const PART_TIME_TAX_EXEMPT_THRESHOLD = 88000; // 月額88,000円未満は源泉所得税を計算対象外（アルバイト・パートのみ）

function applyEmploymentTypeLabel() {
  const employmentType = document.getElementById('employmentType').value;
  const label = document.getElementById('baseSalaryLabel');
  label.textContent = employmentType === '役員' ? '役員報酬（円）' : '基本給（円）';
}

// 給与所得の源泉徴収税額表（令和8年分）月額表
// 各行: [以上, 未満, 甲欄0人, 1人, 2人, 3人, 4人, 5人, 6人, 7人, 乙欄]
const WITHHOLDING_FINE_TABLE = [
  [105000, 107000, 170, 0, 0, 0, 0, 0, 0, 0, 3800],
  [107000, 109000, 280, 0, 0, 0, 0, 0, 0, 0, 3800],
  [109000, 111000, 380, 0, 0, 0, 0, 0, 0, 0, 3900],
  [111000, 113000, 480, 0, 0, 0, 0, 0, 0, 0, 4000],
  [113000, 115000, 580, 0, 0, 0, 0, 0, 0, 0, 4100],
  [115000, 117000, 680, 0, 0, 0, 0, 0, 0, 0, 4100],
  [117000, 119000, 790, 0, 0, 0, 0, 0, 0, 0, 4200],
  [119000, 121000, 890, 0, 0, 0, 0, 0, 0, 0, 4300],
  [121000, 123000, 990, 0, 0, 0, 0, 0, 0, 0, 4300],
  [123000, 125000, 1090, 0, 0, 0, 0, 0, 0, 0, 4400],
  [125000, 127000, 1190, 0, 0, 0, 0, 0, 0, 0, 4700],
  [127000, 129000, 1300, 0, 0, 0, 0, 0, 0, 0, 5000],
  [129000, 131000, 1400, 0, 0, 0, 0, 0, 0, 0, 5300],
  [131000, 133000, 1500, 0, 0, 0, 0, 0, 0, 0, 5500],
  [133000, 135000, 1600, 0, 0, 0, 0, 0, 0, 0, 5800],
  [135000, 137000, 1710, 0, 0, 0, 0, 0, 0, 0, 6100],
  [137000, 139000, 1810, 190, 0, 0, 0, 0, 0, 0, 6400],
  [139000, 141000, 1910, 300, 0, 0, 0, 0, 0, 0, 6700],
  [141000, 143000, 2010, 400, 0, 0, 0, 0, 0, 0, 7000],
  [143000, 145000, 2110, 500, 0, 0, 0, 0, 0, 0, 7400],
  [145000, 147000, 2220, 600, 0, 0, 0, 0, 0, 0, 7700],
  [147000, 149000, 2320, 700, 0, 0, 0, 0, 0, 0, 8000],
  [149000, 151000, 2420, 810, 0, 0, 0, 0, 0, 0, 8300],
  [151000, 153000, 2520, 910, 0, 0, 0, 0, 0, 0, 8600],
  [153000, 155000, 2620, 1010, 0, 0, 0, 0, 0, 0, 8900],
  [155000, 157000, 2730, 1110, 0, 0, 0, 0, 0, 0, 9200],
  [157000, 159000, 2830, 1210, 0, 0, 0, 0, 0, 0, 9500],
  [159000, 161000, 2910, 1300, 0, 0, 0, 0, 0, 0, 9800],
  [161000, 163000, 2980, 1370, 0, 0, 0, 0, 0, 0, 10100],
  [163000, 165000, 3050, 1440, 0, 0, 0, 0, 0, 0, 10400],
  [165000, 167000, 3120, 1510, 0, 0, 0, 0, 0, 0, 10700],
  [167000, 169000, 3200, 1580, 0, 0, 0, 0, 0, 0, 11000],
  [169000, 171000, 3270, 1650, 0, 0, 0, 0, 0, 0, 11300],
  [171000, 173000, 3340, 1730, 100, 0, 0, 0, 0, 0, 11500],
  [173000, 175000, 3410, 1800, 170, 0, 0, 0, 0, 0, 11800],
  [175000, 177000, 3480, 1870, 250, 0, 0, 0, 0, 0, 12100],
  [177000, 179000, 3550, 1940, 320, 0, 0, 0, 0, 0, 12500],
  [179000, 181000, 3620, 2010, 390, 0, 0, 0, 0, 0, 12800],
  [181000, 183000, 3700, 2080, 460, 0, 0, 0, 0, 0, 13300],
  [183000, 185000, 3770, 2150, 530, 0, 0, 0, 0, 0, 14000],
  [185000, 187000, 3840, 2230, 600, 0, 0, 0, 0, 0, 14700],
  [187000, 189000, 3910, 2300, 670, 0, 0, 0, 0, 0, 15400],
  [189000, 191000, 3980, 2370, 750, 0, 0, 0, 0, 0, 16100],
  [191000, 193000, 4050, 2440, 820, 0, 0, 0, 0, 0, 16800],
  [193000, 195000, 4120, 2510, 890, 0, 0, 0, 0, 0, 17600],
  [195000, 197000, 4200, 2580, 960, 0, 0, 0, 0, 0, 18300],
  [197000, 199000, 4270, 2650, 1030, 0, 0, 0, 0, 0, 19000],
  [199000, 201000, 4340, 2730, 1100, 0, 0, 0, 0, 0, 19700],
  [201000, 203000, 4410, 2800, 1170, 0, 0, 0, 0, 0, 20400],
  [203000, 205000, 4480, 2870, 1250, 0, 0, 0, 0, 0, 21000],
  [205000, 207000, 4550, 2940, 1320, 0, 0, 0, 0, 0, 21700],
  [207000, 209000, 4630, 3010, 1390, 0, 0, 0, 0, 0, 22500],
  [209000, 211000, 4700, 3080, 1460, 0, 0, 0, 0, 0, 23000],
  [211000, 213000, 4770, 3150, 1530, 0, 0, 0, 0, 0, 23600],
  [213000, 215000, 4840, 3230, 1600, 0, 0, 0, 0, 0, 24100],
  [215000, 217000, 4910, 3300, 1670, 0, 0, 0, 0, 0, 24700],
  [217000, 219000, 4980, 3370, 1750, 130, 0, 0, 0, 0, 25300],
  [219000, 221000, 5050, 3440, 1820, 200, 0, 0, 0, 0, 25800],
  [221000, 224000, 5150, 3520, 1910, 300, 0, 0, 0, 0, 26400],
  [224000, 227000, 5250, 3630, 2020, 400, 0, 0, 0, 0, 27500],
  [227000, 230000, 5360, 3740, 2120, 510, 0, 0, 0, 0, 28500],
  [230000, 233000, 5460, 3850, 2240, 610, 0, 0, 0, 0, 29500],
  [233000, 236000, 5570, 3950, 2340, 720, 0, 0, 0, 0, 30500],
  [236000, 239000, 5680, 4060, 2450, 830, 0, 0, 0, 0, 31500],
  [239000, 242000, 5790, 4170, 2550, 940, 0, 0, 0, 0, 32600],
  [242000, 245000, 5890, 4280, 2660, 1040, 0, 0, 0, 0, 33600],
  [245000, 248000, 6000, 4380, 2770, 1150, 0, 0, 0, 0, 34600],
  [248000, 251000, 6110, 4490, 2880, 1260, 0, 0, 0, 0, 35500],
  [251000, 254000, 6220, 4590, 2980, 1370, 0, 0, 0, 0, 36600],
  [254000, 257000, 6320, 4710, 3090, 1470, 0, 0, 0, 0, 37600],
  [257000, 260000, 6430, 4810, 3200, 1580, 0, 0, 0, 0, 38600],
  [260000, 263000, 6530, 4920, 3310, 1680, 0, 0, 0, 0, 39600],
  [263000, 266000, 6650, 5020, 3410, 1800, 170, 0, 0, 0, 40600],
  [266000, 269000, 6750, 5140, 3520, 1900, 290, 0, 0, 0, 41700],
  [269000, 272000, 6860, 5240, 3620, 2010, 390, 0, 0, 0, 42700],
  [272000, 275000, 6960, 5350, 3740, 2110, 500, 0, 0, 0, 43700],
  [275000, 278000, 7080, 5450, 3840, 2230, 600, 0, 0, 0, 44700],
  [278000, 281000, 7180, 5560, 3950, 2330, 710, 0, 0, 0, 45600],
  [281000, 284000, 7290, 5670, 4050, 2440, 820, 0, 0, 0, 46700],
  [284000, 287000, 7390, 5780, 4170, 2540, 930, 0, 0, 0, 47800],
  [287000, 290000, 7500, 5880, 4270, 2650, 1030, 0, 0, 0, 48900],
  [290000, 293000, 7610, 5990, 4380, 2760, 1140, 0, 0, 0, 50000],
  [293000, 296000, 7720, 6100, 4480, 2870, 1250, 0, 0, 0, 51300],
  [296000, 299000, 7820, 6210, 4590, 2970, 1360, 0, 0, 0, 52400],
  [299000, 302000, 7930, 6320, 4700, 3080, 1470, 0, 0, 0, 53600],
  [302000, 305000, 8060, 6440, 4820, 3210, 1590, 0, 0, 0, 54500],
  [305000, 308000, 8180, 6570, 4940, 3330, 1720, 0, 0, 0, 55200],
  [308000, 311000, 8300, 6690, 5060, 3450, 1840, 210, 0, 0, 56100],
  [311000, 314000, 8550, 6810, 5190, 3570, 1960, 340, 0, 0, 56900],
  [314000, 317000, 8790, 6930, 5310, 3700, 2080, 460, 0, 0, 57700],
  [317000, 320000, 9040, 7060, 5430, 3820, 2210, 580, 0, 0, 58500],
  [320000, 323000, 9280, 7180, 5550, 3940, 2330, 700, 0, 0, 59500],
  [323000, 326000, 9530, 7300, 5680, 4060, 2450, 830, 0, 0, 60500],
  [326000, 329000, 9770, 7420, 5800, 4190, 2570, 950, 0, 0, 61600],
  [329000, 332000, 10020, 7550, 5920, 4310, 2700, 1070, 0, 0, 62600],
  [332000, 335000, 10260, 7670, 6040, 4430, 2820, 1190, 0, 0, 63700],
  [335000, 338000, 10510, 7790, 6170, 4550, 2940, 1320, 0, 0, 64700],
  [338000, 341000, 10750, 7910, 6290, 4680, 3060, 1440, 0, 0, 65800],
  [341000, 344000, 11000, 8040, 6410, 4800, 3190, 1560, 0, 0, 66800],
  [344000, 347000, 11240, 8160, 6530, 4920, 3310, 1680, 0, 0, 67800],
  [347000, 350000, 11490, 8280, 6660, 5040, 3430, 1810, 190, 0, 68800],
  [350000, 353000, 11730, 8500, 6780, 5170, 3550, 1930, 320, 0, 69800],
  [353000, 356000, 11980, 8750, 6900, 5290, 3680, 2050, 440, 0, 70900],
  [356000, 359000, 12220, 9000, 7020, 5410, 3800, 2170, 560, 0, 71900],
  [359000, 362000, 12470, 9240, 7150, 5530, 3920, 2300, 680, 0, 72900],
  [362000, 365000, 12710, 9490, 7270, 5660, 4040, 2420, 810, 0, 73900],
  [365000, 368000, 12960, 9730, 7390, 5780, 4170, 2540, 930, 0, 74900],
  [368000, 371000, 13200, 9980, 7510, 5900, 4290, 2660, 1050, 0, 76000],
  [371000, 374000, 13450, 10220, 7640, 6020, 4410, 2790, 1170, 0, 76900],
  [374000, 377000, 13690, 10470, 7760, 6150, 4530, 2910, 1300, 0, 77800],
  [377000, 380000, 13940, 10710, 7880, 6270, 4660, 3030, 1420, 0, 78700],
  [380000, 383000, 14180, 10960, 8000, 6390, 4780, 3150, 1540, 0, 79600],
  [383000, 386000, 14430, 11200, 8130, 6510, 4900, 3280, 1660, 0, 80600],
  [386000, 389000, 14670, 11450, 8250, 6640, 5020, 3400, 1790, 170, 82000],
  [389000, 392000, 14920, 11690, 8450, 6760, 5150, 3520, 1910, 300, 83600],
  [392000, 395000, 15160, 11940, 8700, 6880, 5270, 3640, 2030, 420, 85400],
  [395000, 398000, 15410, 12180, 8940, 7000, 5390, 3770, 2150, 540, 87100],
  [398000, 401000, 15650, 12430, 9190, 7130, 5510, 3890, 2280, 660, 88700],
  [401000, 404000, 15900, 12670, 9430, 7250, 5640, 4010, 2400, 790, 90500],
  [404000, 407000, 16140, 12920, 9680, 7370, 5760, 4140, 2520, 910, 92200],
  [407000, 410000, 16390, 13160, 9920, 7490, 5880, 4260, 2640, 1030, 93800],
  [410000, 413000, 16630, 13410, 10170, 7620, 6000, 4380, 2770, 1150, 95600],
  [413000, 416000, 16880, 13650, 10410, 7740, 6130, 4500, 2890, 1280, 97300],
  [416000, 419000, 17120, 13900, 10660, 7860, 6250, 4630, 3010, 1400, 98900],
  [419000, 422000, 17370, 14140, 10900, 7980, 6370, 4750, 3130, 1520, 100700],
  [422000, 425000, 17610, 14390, 11150, 8110, 6490, 4870, 3260, 1640, 102400],
  [425000, 428000, 17860, 14630, 11390, 8230, 6620, 4990, 3380, 1770, 104000],
  [428000, 431000, 18100, 14880, 11640, 8400, 6740, 5120, 3500, 1890, 105800],
  [431000, 434000, 18350, 15120, 11880, 8650, 6860, 5240, 3620, 2010, 107500],
  [434000, 437000, 18590, 15370, 12130, 8890, 6980, 5360, 3750, 2130, 109100],
  [437000, 440000, 18840, 15610, 12370, 9140, 7110, 5480, 3870, 2260, 110900],
  [440000, 443000, 19080, 15860, 12620, 9380, 7230, 5610, 3990, 2380, 112600],
  [443000, 446000, 19330, 16100, 12860, 9630, 7350, 5730, 4110, 2500, 114200],
  [446000, 449000, 19570, 16350, 13110, 9870, 7470, 5850, 4240, 2620, 116000],
  [449000, 452000, 19860, 16590, 13350, 10120, 7600, 5970, 4360, 2750, 117600],
  [452000, 455000, 20350, 16840, 13600, 10360, 7720, 6100, 4480, 2870, 119400],
  [455000, 458000, 20840, 17080, 13840, 10610, 7840, 6220, 4600, 2990, 121100],
  [458000, 461000, 21330, 17330, 14090, 10850, 7960, 6340, 4730, 3110, 122700],
  [461000, 464000, 21820, 17570, 14330, 11100, 8090, 6460, 4850, 3240, 124500],
  [464000, 467000, 22310, 17820, 14580, 11340, 8210, 6590, 4970, 3360, 126200],
  [467000, 470000, 22800, 18060, 14820, 11590, 8360, 6710, 5090, 3480, 127800],
  [470000, 473000, 23290, 18310, 15070, 11830, 8610, 6830, 5220, 3600, 129600],
  [473000, 476000, 23780, 18550, 15320, 12080, 8850, 6950, 5340, 3730, 131200],
  [476000, 479000, 24270, 18800, 15560, 12320, 9100, 7080, 5460, 3850, 132800],
  [479000, 482000, 24760, 19040, 15810, 12570, 9340, 7200, 5580, 3970, 134500],
  [482000, 485000, 25250, 19290, 16050, 12810, 9590, 7320, 5710, 4090, 136100],
  [485000, 488000, 25740, 19530, 16300, 13060, 9830, 7440, 5830, 4220, 137600],
  [488000, 491000, 26230, 19780, 16540, 13300, 10080, 7570, 5950, 4340, 139300],
  [491000, 494000, 26720, 20260, 16790, 13550, 10320, 7690, 6070, 4460, 140900],
  [494000, 497000, 27210, 20750, 17030, 13790, 10570, 7810, 6200, 4580, 142500],
  [497000, 500000, 27700, 21240, 17280, 14040, 10810, 7930, 6320, 4710, 144100],
  [500000, 503000, 28190, 21730, 17520, 14280, 11060, 8060, 6440, 4830, 145700],
  [503000, 506000, 28680, 22220, 17770, 14530, 11300, 8180, 6570, 4950, 147300],
  [506000, 509000, 29170, 22710, 18010, 14770, 11550, 8310, 6690, 5070, 149000],
  [509000, 512000, 29660, 23200, 18260, 15020, 11790, 8560, 6810, 5200, 150500],
  [512000, 515000, 30150, 23690, 18500, 15260, 12040, 8800, 6930, 5320, 152100],
  [515000, 518000, 30640, 24180, 18750, 15510, 12280, 9050, 7060, 5440, 153800],
  [518000, 521000, 31130, 24670, 18990, 15750, 12530, 9290, 7180, 5560, 155400],
  [521000, 524000, 31620, 25160, 19240, 16000, 12770, 9540, 7300, 5690, 156900],
  [524000, 527000, 32110, 25650, 19480, 16240, 13020, 9780, 7420, 5810, 158600],
  [527000, 530000, 32600, 26140, 19730, 16490, 13260, 10030, 7550, 5930, 160200],
  [530000, 533000, 33090, 26630, 20160, 16730, 13510, 10270, 7670, 6050, 161600],
  [533000, 536000, 33580, 27120, 20650, 16980, 13750, 10520, 7790, 6180, 163200],
  [536000, 539000, 34070, 27610, 21140, 17220, 14000, 10760, 7910, 6300, 164600],
  [539000, 542000, 34560, 28100, 21630, 17470, 14240, 11010, 8040, 6420, 166000],
  [542000, 545000, 35050, 28590, 22130, 17710, 14490, 11250, 8160, 6540, 167500],
  [545000, 548000, 35540, 29080, 22620, 17960, 14730, 11500, 8280, 6670, 169000],
  [548000, 551000, 36030, 29570, 23110, 18200, 14980, 11740, 8500, 6790, 170500],
  [551000, 554000, 36570, 30110, 23650, 18480, 15240, 12020, 8780, 6920, 171900],
  [554000, 557000, 37120, 30660, 24200, 18760, 15520, 12290, 9060, 7060, 173400],
  [557000, 560000, 37670, 31210, 24750, 19030, 15790, 12570, 9330, 7200, 174900],
  [560000, 563000, 38230, 31760, 25300, 19310, 16070, 12840, 9610, 7330, 176300],
  [563000, 566000, 38780, 32310, 25850, 19580, 16350, 13120, 9880, 7470, 177900],
  [566000, 569000, 39330, 32870, 26400, 19930, 16620, 13400, 10160, 7610, 179300],
  [569000, 572000, 39880, 33420, 26950, 20480, 16900, 13670, 10430, 7750, 180700],
  [572000, 575000, 40430, 33970, 27510, 21030, 17170, 13950, 10710, 7880, 182200],
  [575000, 578000, 40980, 34520, 28060, 21580, 17450, 14220, 10990, 8030, 183700],
  [578000, 581000, 41530, 35070, 28610, 22140, 17720, 14500, 11260, 8160, 185200],
  [581000, 584000, 42090, 35620, 29160, 22690, 18000, 14770, 11540, 8300, 186600],
  [584000, 587000, 42640, 36170, 29710, 23240, 18280, 15050, 11810, 8580, 188100],
  [587000, 590000, 43190, 36730, 30260, 23790, 18550, 15330, 12090, 8850, 189600],
  [590000, 593000, 43740, 37280, 30810, 24340, 18830, 15600, 12360, 9130, 191000],
  [593000, 596000, 44290, 37830, 31370, 24890, 19100, 15880, 12640, 9400, 192600],
  [596000, 599000, 44840, 38380, 31920, 25440, 19380, 16150, 12920, 9680, 194000],
  [599000, 602000, 45390, 38930, 32470, 25990, 19650, 16430, 13190, 9950, 195400],
  [602000, 605000, 45950, 39480, 33020, 26550, 20080, 16700, 13470, 10230, 197000],
  [605000, 608000, 46500, 40030, 33570, 27100, 20630, 16980, 13740, 10510, 198400],
  [608000, 611000, 47050, 40580, 34120, 27650, 21190, 17250, 14020, 10780, 199900],
  [611000, 614000, 47600, 41140, 34670, 28200, 21740, 17530, 14290, 11060, 201300],
  [614000, 617000, 48150, 41690, 35220, 28750, 22290, 17810, 14570, 11330, 202800],
  [617000, 620000, 48700, 42240, 35780, 29300, 22840, 18080, 14850, 11610, 204300],
  [620000, 623000, 49250, 42790, 36330, 29850, 23390, 18360, 15120, 11880, 205700],
  [623000, 626000, 49800, 43340, 36880, 30410, 23940, 18630, 15400, 12160, 207300],
  [626000, 629000, 50360, 43890, 37430, 30960, 24490, 18910, 15670, 12440, 208700],
  [629000, 632000, 50910, 44440, 37980, 31510, 25050, 19180, 15950, 12710, 210100],
  [632000, 635000, 51460, 45000, 38530, 32060, 25600, 19460, 16220, 12990, 211700],
  [635000, 638000, 52010, 45550, 39080, 32610, 26150, 19740, 16500, 13260, 213100],
  [638000, 641000, 52560, 46100, 39640, 33160, 26700, 20240, 16780, 13540, 214600],
  [641000, 644000, 53110, 46650, 40190, 33710, 27250, 20790, 17050, 13810, 215900],
  [644000, 647000, 53660, 47200, 40740, 34260, 27800, 21340, 17330, 14090, 217000],
  [647000, 650000, 54220, 47750, 41290, 34820, 28350, 21890, 17600, 14370, 218000],
  [650000, 653000, 54770, 48300, 41840, 35370, 28900, 22440, 17880, 14640, 219000],
  [653000, 656000, 55320, 48850, 42390, 35920, 29460, 22990, 18150, 14920, 220000],
  [656000, 659000, 55870, 49410, 42940, 36470, 30010, 23540, 18430, 15190, 221000],
  [659000, 662000, 56420, 49960, 43490, 37020, 30560, 24100, 18700, 15470, 222100],
  [662000, 665000, 56970, 50510, 44050, 37570, 31110, 24650, 18980, 15740, 223100],
  [665000, 668000, 57520, 51060, 44600, 38120, 31660, 25200, 19260, 16020, 224100],
  [668000, 671000, 58070, 51610, 45150, 38680, 32210, 25750, 19530, 16300, 225000],
  [671000, 674000, 58630, 52160, 45700, 39230, 32760, 26300, 19830, 16570, 226000],
  [674000, 677000, 59180, 52710, 46250, 39780, 33320, 26850, 20380, 16850, 227100],
  [677000, 680000, 59730, 53270, 46800, 40330, 33870, 27400, 20930, 17120, 228100],
  [680000, 683000, 60280, 53820, 47350, 40880, 34420, 27950, 21480, 17400, 229100],
  [683000, 686000, 60830, 54370, 47910, 41430, 34970, 28510, 22030, 17670, 230100],
  [686000, 689000, 61380, 54920, 48460, 41980, 35520, 29060, 22580, 17950, 231500],
  [689000, 692000, 61930, 55470, 49010, 42530, 36070, 29610, 23140, 18220, 233000],
  [692000, 695000, 62490, 56020, 49560, 43090, 36620, 30160, 23690, 18500, 234500],
  [695000, 698000, 63040, 56570, 50110, 43640, 37170, 30710, 24240, 18780, 236100],
  [698000, 701000, 63590, 57120, 50660, 44190, 37730, 31260, 24790, 19050, 237600],
  [701000, 704000, 64140, 57680, 51210, 44740, 38280, 31810, 25340, 19330, 239100],
  [704000, 707000, 64690, 58230, 51760, 45290, 38830, 32370, 25890, 19600, 240800],
  [707000, 710000, 65250, 58780, 52320, 45850, 39380, 32920, 26450, 19980, 242300],
  [710000, 713000, 65860, 59390, 52930, 46470, 39990, 33530, 27070, 20590, 243800],
  [713000, 716000, 66480, 60000, 53540, 47080, 40610, 34140, 27680, 21210, 245300],
  [716000, 719000, 67090, 60620, 54150, 47690, 41220, 34750, 28290, 21820, 246900],
  [719000, 722000, 67700, 61230, 54770, 48300, 41830, 35370, 28900, 22430, 248400],
  [722000, 725000, 68320, 61840, 55380, 48920, 42440, 35980, 29520, 23040, 250000],
  [725000, 728000, 68930, 62450, 55990, 49530, 43060, 36590, 30130, 23660, 251600],
  [728000, 731000, 69540, 63070, 56600, 50140, 43670, 37210, 30740, 24270, 253100],
  [731000, 734000, 70150, 63680, 57220, 50750, 44280, 37820, 31350, 24880, 254600],
  [734000, 737000, 70770, 64290, 57830, 51370, 44890, 38430, 31970, 25490, 256200],
  [737000, 740000, 71380, 64900, 58440, 51980, 45510, 39040, 32580, 26110, 257700],
];

const WITHHOLDING_ZERO_BAND_UPPER = 105000;
const OTSU_LOW_RATE = 0.03063;

// 740,000円以上の速算式（甲欄）
const KOU_FORMULA_BANDS = [
  { threshold: 740000, base: [71680, 65210, 58750, 52290, 45810, 39350, 32890, 26410], rate: 0.2042 },
  { threshold: 790000, base: [81890, 75420, 68960, 62500, 56020, 49560, 43100, 36620], rate: 0.23483 },
  { threshold: 960000, base: [121820, 115340, 108880, 102420, 95940, 89480, 83020, 76540], rate: 0.33693 },
  { threshold: 1710000, base: [374520, 368040, 361580, 355120, 348640, 342180, 335720, 329240], rate: 0.4084 },
  { threshold: 2130000, base: [549440, 542970, 536500, 530040, 523570, 517110, 510640, 504170], rate: 0.4084 },
  { threshold: 2170000, base: [571220, 564750, 558280, 551820, 545350, 538880, 532420, 525950], rate: 0.4084 },
  { threshold: 2210000, base: [593000, 586520, 580060, 573600, 567120, 560660, 554200, 547730], rate: 0.4084 },
  { threshold: 2250000, base: [614770, 608300, 601840, 595380, 588900, 582440, 575980, 569500], rate: 0.4084 },
  { threshold: 3500000, base: [1125270, 1118800, 1112340, 1105880, 1099400, 1092940, 1086480, 1080000], rate: 0.45945 },
];

// 740,000円以上の速算式（乙欄）
const OTSU_FORMULA_BANDS = [
  { threshold: 740000, base: 259200, rate: 0.4084 },
  { threshold: 1710000, base: 655400, rate: 0.45945 },
];

const DEPENDENT_OVERFLOW_DEDUCTION = 1610; // 扶養親族等が7人を超える場合、1人ごとにこの額を控除

// taxBase: その月の社会保険料等控除後の給与等の金額（円） / taxTable: '甲' | '乙'
function calcWithholdingTax(taxBase, dependents, taxTable) {
  const base = Math.max(0, Math.floor(taxBase));

  if (taxTable === '乙') {
    if (base < WITHHOLDING_ZERO_BAND_UPPER) {
      return Math.round(base * OTSU_LOW_RATE);
    }
    if (base < 740000) {
      const row = WITHHOLDING_FINE_TABLE.find((r) => base >= r[0] && base < r[1]);
      return row ? row[10] : 0;
    }
    let band = OTSU_FORMULA_BANDS[0];
    for (const b of OTSU_FORMULA_BANDS) {
      if (base >= b.threshold) band = b;
    }
    return Math.floor(band.base + (base - band.threshold) * band.rate);
  }

  const col = Math.min(dependents, 7);
  const overflow = dependents > 7 ? (dependents - 7) * DEPENDENT_OVERFLOW_DEDUCTION : 0;

  let result;
  if (base < WITHHOLDING_ZERO_BAND_UPPER) {
    result = 0;
  } else if (base < 740000) {
    const row = WITHHOLDING_FINE_TABLE.find((r) => base >= r[0] && base < r[1]);
    result = row ? row[2 + col] : 0;
  } else {
    let band = KOU_FORMULA_BANDS[0];
    for (const b of KOU_FORMULA_BANDS) {
      if (base >= b.threshold) band = b;
    }
    result = Math.floor(band.base[col] + (base - band.threshold) * band.rate);
  }

  return Math.max(0, result - overflow);
}

// 月額表の甲欄を適用する給与等に対する税額の電算機計算の特例（令和8年分以降）
const MACHINE_SALARY_DEDUCTION_TABLE = [
  { upper: 158333, calc: () => 54167 },
  { upper: 299999, calc: (a) => Math.ceil(a * 0.3 + 6667) },
  { upper: 549999, calc: (a) => Math.ceil(a * 0.2 + 36667) },
  { upper: 708330, calc: (a) => Math.ceil(a * 0.1 + 91667) },
  { upper: Infinity, calc: () => 162500 },
];

const MACHINE_BASIC_DEDUCTION_TABLE = [
  { upper: 2120833, amount: 48334 },
  { upper: 2162499, amount: 40000 },
  { upper: 2204166, amount: 26667 },
  { upper: 2245833, amount: 13334 },
  { upper: Infinity, amount: 0 },
];

const MACHINE_PER_DEPENDENT_DEDUCTION = 31667; // 配偶者控除・扶養控除相当額（1人あたり、上限なし）

const MACHINE_TAX_BRACKETS = [
  { upper: 162500, rate: 0.05105, deduction: 0 },
  { upper: 275000, rate: 0.10210, deduction: 8296 },
  { upper: 579166, rate: 0.20420, deduction: 36374 },
  { upper: 750000, rate: 0.23483, deduction: 54113 },
  { upper: 1500000, rate: 0.33693, deduction: 130688 },
  { upper: 3333333, rate: 0.40840, deduction: 237893 },
  { upper: Infinity, rate: 0.45945, deduction: 408061 },
];

// taxBase: その月の社会保険料等控除後の給与等の金額（円）/ dependents: 源泉控除対象配偶者・親族等の合計人数
function calcMachineWithholdingTax(taxBase, dependents) {
  const a = Math.max(0, Math.floor(taxBase));

  const salaryDeduction = MACHINE_SALARY_DEDUCTION_TABLE.find((row) => a <= row.upper).calc(a);
  const basicDeduction = MACHINE_BASIC_DEDUCTION_TABLE.find((row) => a <= row.upper).amount;
  const dependentDeduction = MACHINE_PER_DEPENDENT_DEDUCTION * dependents;

  const b = Math.max(0, a - salaryDeduction - dependentDeduction - basicDeduction);
  const bracket = MACHINE_TAX_BRACKETS.find((row) => b <= row.upper);
  const rawTax = b * bracket.rate - bracket.deduction;

  return Math.max(0, Math.round(rawTax / 10) * 10); // 10円未満四捨五入
}

// 賞与に対する源泉徴収税額の算出率の表（令和8年分）
// 各行 [未満のしきい値(円), 率(%)]。前月の社会保険料等控除後の給与等の金額がしきい値未満ならその率を適用。
const BONUS_KOU_RATE_TABLE = [
  [[82000, 0.000], [94000, 2.042], [260000, 4.084], [309000, 6.126], [342000, 8.168], [372000, 10.210], [402000, 12.252], [433000, 14.294], [520000, 16.336], [605000, 18.378], [684000, 20.420], [715000, 22.462], [752000, 24.504], [795000, 26.546], [854000, 28.588], [922000, 30.630], [1318000, 32.672], [1521000, 35.735], [2621000, 38.798], [3495000, 41.861], [Infinity, 45.945]],
  [[107000, 0.000], [250000, 2.042], [289000, 4.084], [346000, 6.126], [373000, 8.168], [401000, 10.210], [430000, 12.252], [463000, 14.294], [520000, 16.336], [621000, 18.378], [705000, 20.420], [739000, 22.462], [778000, 24.504], [821000, 26.546], [882000, 28.588], [952000, 30.630], [1342000, 32.672], [1526000, 35.735], [2645000, 38.798], [3527000, 41.861], [Infinity, 45.945]],
  [[143000, 0.000], [276000, 2.042], [321000, 4.084], [377000, 6.126], [400000, 8.168], [426000, 10.210], [457000, 12.252], [492000, 14.294], [525000, 16.336], [636000, 18.378], [728000, 20.420], [764000, 22.462], [804000, 24.504], [848000, 26.546], [910000, 28.588], [983000, 30.630], [1367000, 32.672], [1526000, 35.735], [2669000, 38.798], [3559000, 41.861], [Infinity, 45.945]],
  [[181000, 0.000], [300000, 2.042], [354000, 4.084], [405000, 6.126], [424000, 8.168], [452000, 10.210], [484000, 12.252], [517000, 14.294], [550000, 16.336], [651000, 18.378], [751000, 20.420], [788000, 22.462], [830000, 24.504], [876000, 26.546], [938000, 28.588], [1013000, 30.630], [1391000, 32.672], [1538000, 35.735], [2693000, 38.798], [3590000, 41.861], [Infinity, 45.945]],
  [[218000, 0.000], [300000, 2.042], [387000, 4.084], [431000, 6.126], [452000, 8.168], [477000, 10.210], [509000, 12.252], [540000, 14.294], [577000, 16.336], [666000, 18.378], [774000, 20.420], [813000, 22.462], [856000, 24.504], [903000, 26.546], [966000, 28.588], [1044000, 30.630], [1416000, 32.672], [1555000, 35.735], [2716000, 38.798], [3622000, 41.861], [Infinity, 45.945]],
  [[251000, 0.000], [304000, 2.042], [412000, 4.084], [457000, 6.126], [479000, 8.168], [503000, 10.210], [531000, 12.252], [564000, 14.294], [604000, 16.336], [681000, 18.378], [798000, 20.420], [838000, 22.462], [881000, 24.504], [930000, 26.546], [994000, 28.588], [1074000, 30.630], [1440000, 32.672], [1555000, 35.735], [2740000, 38.798], [3654000, 41.861], [Infinity, 45.945]],
  [[284000, 0.000], [343000, 2.042], [438000, 4.084], [483000, 6.126], [505000, 8.168], [527000, 10.210], [553000, 12.252], [589000, 14.294], [630000, 16.336], [697000, 18.378], [821000, 20.420], [862000, 22.462], [907000, 24.504], [957000, 26.546], [1022000, 28.588], [1104000, 30.630], [1464000, 32.672], [1555000, 35.735], [2764000, 38.798], [3685000, 41.861], [Infinity, 45.945]],
  [[317000, 0.000], [383000, 2.042], [463000, 4.084], [508000, 6.126], [529000, 8.168], [552000, 10.210], [578000, 12.252], [614000, 14.294], [657000, 16.336], [708000, 18.378], [845000, 20.420], [887000, 22.462], [933000, 24.504], [985000, 26.546], [1051000, 28.588], [1135000, 30.630], [1489000, 32.672], [1583000, 35.735], [2788000, 38.798], [3717000, 41.861], [Infinity, 45.945]],
];

const BONUS_OTSU_RATE_TABLE = [[224000, 10.210], [295000, 20.420], [527000, 30.630], [1118000, 38.798], [Infinity, 45.945]];

function findBonusRate(base, table) {
  for (const [upper, rate] of table) {
    if (base < upper) return rate;
  }
  return table[table.length - 1][1];
}

// prevMonthBase: 前月の社会保険料等控除後の給与等の金額（円）
function calcBonusRate(prevMonthBase, dependents, taxTable) {
  if (taxTable === '乙') return findBonusRate(prevMonthBase, BONUS_OTSU_RATE_TABLE) / 100;
  const col = Math.min(dependents, 7);
  return findBonusRate(prevMonthBase, BONUS_KOU_RATE_TABLE[col]) / 100;
}

// bonusBase: 賞与の金額（社会保険料等控除後）/ situation: 'normal' | 'over10x' | 'noPrevSalary'
// calcMethod: 前月に給与の支払がない場合・10倍を超える場合の月額表相当の求め方（'table'=月額表 | 'machine'=機械計算）
// calcPeriodMonths: 賞与の計算期間が6か月以内の場合は6、6か月を超える場合は12
function calcBonusWithholdingTax(bonusBase, prevMonthBase, dependents, taxTable, situation, calcMethod, calcPeriodMonths) {
  if (situation === 'normal') {
    const rate = calcBonusRate(prevMonthBase, dependents, taxTable);
    return Math.floor(bonusBase * rate);
  }
  const monthlyEquivalentTax = (base) => (calcMethod === 'machine' && taxTable === '甲')
    ? calcMachineWithholdingTax(base, dependents)
    : calcWithholdingTax(base, dependents, taxTable);
  const n = calcPeriodMonths || 6;

  // 前月に給与の支払がない場合・前月給与の10倍を超える賞与の場合は月額表を使用
  if (situation === 'noPrevSalary') {
    const x = Math.floor(bonusBase / n);
    return monthlyEquivalentTax(x) * n;
  }
  // over10x：前月の給与の額に、賞与の額のn分の1に相当する金額を加算した金額を基準額とする
  const y = prevMonthBase + Math.floor(bonusBase / n);
  const taxOnCombined = monthlyEquivalentTax(y);
  const taxOnPrevMonth = monthlyEquivalentTax(prevMonthBase);
  return Math.max(0, (taxOnCombined - taxOnPrevMonth) * n);
}

function yen(n) {
  return Math.round(n).toLocaleString('ja-JP') + ' 円';
}

const BONUS_HEALTH_ANNUAL_CAP = 5730000; // 健康保険：標準賞与額の年度累計上限
const BONUS_PENSION_MONTHLY_CAP = 1500000; // 厚生年金：標準賞与額の月間上限

function calculateBonus() {
  const employmentType = document.getElementById('bonusEmploymentType').value;
  const ageGroup = document.getElementById('bonusAgeGroup').value;
  const taxTable = document.getElementById('bonusTaxTable').value;
  const calcMethod = document.getElementById('bonusCalcMethod').value;
  const dependents = Number(document.getElementById('bonusDependents').value) || 0;

  const healthRate = Number(document.getElementById('bonusHealthRate').value) / 100;
  const careRate = Number(document.getElementById('bonusCareRate').value) / 100;
  const childLevyRate = Number(document.getElementById('bonusChildLevyRate').value) / 100;
  const pensionRate = Number(document.getElementById('bonusPensionRate').value) / 100;
  const employmentRate = Number(document.getElementById('bonusEmploymentRate').value) / 100;

  const subjectSocialInsurance = employmentType !== 'アルバイト・パート' && employmentType !== 'アルバイト・パート（雇用保険対象外）';
  const subjectEmploymentInsurance = employmentType !== '役員' && employmentType !== 'アルバイト・パート（雇用保険対象外）';
  const ageRule = AGE_RULES[ageGroup];
  const hasHealth = subjectSocialInsurance && ageRule.health;
  const hasCare = subjectSocialInsurance && ageRule.care;
  const hasPension = subjectSocialInsurance && ageRule.pension;

  const bonusAmount = getNumValue('bonusAmount');
  const prevMonthSalary = getNumValue('prevMonthSalary');
  const calcPeriodMonths = Number(document.getElementById('bonusCalcPeriod').value) || 6;
  const healthCumulative = getNumValue('bonusHealthCumulative');
  const pensionCumulative = getNumValue('bonusPensionCumulative');

  // 標準賞与額：実際の賞与額（税引き前）から1,000円未満を切り捨てた額
  const standardBonus = Math.floor(bonusAmount / 1000) * 1000;
  // 健康保険・子ども子育て支援金：年度累計573万円が上限
  const healthStandardBonus = Math.max(0, Math.min(standardBonus, BONUS_HEALTH_ANNUAL_CAP - healthCumulative));
  // 厚生年金：同月内の累計150万円が上限
  const pensionStandardBonus = Math.max(0, Math.min(standardBonus, BONUS_PENSION_MONTHLY_CAP - pensionCumulative));

  const healthInsurance = hasHealth ? roundInsuranceShare(healthStandardBonus * healthRate / 2) : 0;
  const careInsurance = hasCare ? roundInsuranceShare(healthStandardBonus * careRate / 2) : 0;
  const pensionInsurance = hasPension ? roundInsuranceShare(pensionStandardBonus * pensionRate / 2) : 0;
  const employmentInsurance = subjectEmploymentInsurance ? bonusAmount * employmentRate : 0;
  const childSupportLevy = hasHealth ? roundInsuranceShare(healthStandardBonus * childLevyRate / 2) : 0;
  const socialInsuranceTotal = healthInsurance + careInsurance + pensionInsurance + employmentInsurance + childSupportLevy;

  const bonusBase = Math.max(0, bonusAmount - socialInsuranceTotal);

  // 支払い状況の自動判定（賞与額・前月給与額から判定、「賞与額」は社会保険料等控除後の金額で比較）
  const situation = prevMonthSalary <= 0
    ? 'noPrevSalary'
    : (bonusBase > prevMonthSalary * 10 ? 'over10x' : 'normal');
  const incomeTax = calcBonusWithholdingTax(bonusBase, prevMonthSalary, dependents, taxTable, situation, calcMethod, calcPeriodMonths);

  const netPay = bonusAmount - socialInsuranceTotal - incomeTax;

  renderBonusResult({
    bonusAmount,
    healthInsurance, hasHealth,
    careInsurance, hasCare,
    pensionInsurance, hasPension,
    employmentInsurance, subjectEmploymentInsurance,
    childSupportLevy,
    socialInsuranceTotal,
    taxBase: bonusBase,
    incomeTax,
    netPay,
  });
}

function buildBonusRows(r) {
  return [
    ['賞与額', r.bonusAmount, 'plain', true],
    ['', '', 'gap', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['課税対象額', r.taxBase, 'subtotal', true],
    ['', '', 'gap', true],
    ['源泉所得税（概算）', -r.incomeTax, 'deduction', true],
    ['総控除額', -r.incomeTax, 'subtotal', true],
  ];
}

// テキストコピー用に、画面表示と全く同じタイトル・項目・改行位置のプレーンテキストを組み立てる
function buildBonusCopyText(r) {
  const lines = ['賞与計算シミュレーション結果', ''];
  lines.push(`賞与額\t${yen(r.bonusAmount)}`, '');
  lines.push(`健康保険料\t${r.hasHealth ? yen(-r.healthInsurance) : '対象外'}`);
  lines.push(`子ども・子育て支援金\t${r.hasHealth ? yen(-r.childSupportLevy) : '対象外'}`);
  lines.push(`介護保険料\t${r.hasCare ? yen(-r.careInsurance) : '対象外'}`);
  lines.push(`厚生年金保険料\t${r.hasPension ? yen(-r.pensionInsurance) : '対象外'}`);
  lines.push(`雇用保険料\t${r.subjectEmploymentInsurance ? yen(-r.employmentInsurance) : '対象外'}`);
  lines.push(`社会保険料合計\t${yen(-r.socialInsuranceTotal)}`);
  lines.push(`課税対象額　${yen(r.taxBase)}`, '');
  lines.push(`源泉所得税（概算）\t${yen(-r.incomeTax)}`);
  lines.push(`総控除額　${yen(-r.incomeTax)}`, '');
  lines.push('差引支給額（手取り）', yen(r.netPay));
  return lines.join('\n');
}

let currentBonusResult = null;

function renderBonusResult(r) {
  currentBonusResult = r;
  renderResultRows(document.querySelector('#bonusResultTable tbody'), buildBonusRows(r));

  document.getElementById('bonusNetValue').textContent = yen(r.netPay);
}

function calculate() {
  const employmentType = document.getElementById('employmentType').value;
  const ageGroup = document.getElementById('ageGroup').value;
  const taxTable = document.getElementById('taxTable').value;
  const calcMethod = document.getElementById('calcMethod').value;
  const baseSalary = getNumValue('baseSalary');
  const overtimePay = getNumValue('overtimePay');
  const taxableAllowance = getNumValue('taxableAllowance');
  const commuteAllowance = getNumValue('commuteAllowance');
  const dependents = Number(document.getElementById('dependents').value) || 0;
  const residentTax = getNumValue('residentTax');

  const healthRate = Number(document.getElementById('healthRate').value) / 100;
  const careRate = Number(document.getElementById('careRate').value) / 100;
  const childLevyRate = Number(document.getElementById('childLevyRate').value) / 100;
  const pensionRate = Number(document.getElementById('pensionRate').value) / 100;
  const employmentRate = Number(document.getElementById('employmentRate').value) / 100;

  // 雇用形態による加入区分（役員=社会保険のみ、アルバイト・パート=雇用保険のみ、アルバイト・パート（雇用保険対象外）=いずれも対象外）
  const subjectSocialInsurance = employmentType !== 'アルバイト・パート' && employmentType !== 'アルバイト・パート（雇用保険対象外）';
  const subjectEmploymentInsurance = employmentType !== '役員' && employmentType !== 'アルバイト・パート（雇用保険対象外）';
  const ageRule = AGE_RULES[ageGroup];

  const hasHealth = subjectSocialInsurance && ageRule.health;
  const hasCare = subjectSocialInsurance && ageRule.care;
  const hasPension = subjectSocialInsurance && ageRule.pension;

  const grossPay = baseSalary + overtimePay + taxableAllowance + commuteAllowance;

  // 社会保険算定基礎額（通勤手当も含む）
  const socialInsuranceBase = baseSalary + overtimePay + taxableAllowance + commuteAllowance;

  const healthInsurance = hasHealth ? roundInsuranceShare(socialInsuranceBase * healthRate / 2) : 0;
  const careInsurance = hasCare ? roundInsuranceShare(socialInsuranceBase * careRate / 2) : 0;
  const pensionInsurance = hasPension ? roundInsuranceShare(socialInsuranceBase * pensionRate / 2) : 0;
  const employmentInsurance = subjectEmploymentInsurance ? grossPay * employmentRate : 0;
  const childSupportLevy = hasHealth ? roundInsuranceShare(socialInsuranceBase * childLevyRate / 2) : 0;

  const socialInsuranceTotal = healthInsurance + careInsurance + pensionInsurance + employmentInsurance + childSupportLevy;

  // 源泉所得税（給与所得の源泉徴収税額表 令和8年分 月額表）
  const monthlyTaxableIncome = grossPay - commuteAllowance; // 通勤手当は非課税
  const isTaxExempt = (employmentType === 'アルバイト・パート' || employmentType === 'アルバイト・パート（雇用保険対象外）') && monthlyTaxableIncome < PART_TIME_TAX_EXEMPT_THRESHOLD;

  // 課税対象額：その月の社会保険料等控除後の給与等の金額（源泉所得税の課税対象を可視化した参考値）
  const taxBase = grossPay - commuteAllowance - socialInsuranceTotal;

  let monthlyIncomeTax = 0;
  if (!isTaxExempt) {
    monthlyIncomeTax = (calcMethod === 'machine' && taxTable === '甲')
      ? calcMachineWithholdingTax(taxBase, dependents)
      : calcWithholdingTax(taxBase, dependents, taxTable);
  }

  const netPay = grossPay - socialInsuranceTotal - monthlyIncomeTax - residentTax;

  renderResult({
    baseSalary, baseSalaryLabel: employmentType === '役員' ? '役員報酬' : '基本給',
    overtimePay, overtimeEntered: document.getElementById('overtimePay').value.trim() !== '',
    taxableAllowance, taxableAllowanceEntered: document.getElementById('taxableAllowance').value.trim() !== '',
    commuteAllowance, commuteAllowanceEntered: document.getElementById('commuteAllowance').value.trim() !== '',
    grossPay,
    healthInsurance, hasHealth,
    careInsurance, hasCare,
    pensionInsurance, hasPension,
    employmentInsurance, subjectEmploymentInsurance,
    childSupportLevy,
    socialInsuranceTotal,
    taxBase,
    monthlyIncomeTax, isTaxExempt,
    residentTax,
    netPay,
  });
}

// 計算結果テーブルの行データを描画する共通処理
// kind: 'breakdown'（支給内訳の小項目）/ 'plain'（総支給額等）/ 'deduction'（控除項目）/
//       'total'（小計）/ 'subtotal'（課税対象額・総控除額などの参考値）/ 'gap'（区切りの空行）
function renderResultRows(tbody, rows) {
  tbody.innerHTML = '';
  for (const [label, value, kind, applicable] of rows) {
    const tr = document.createElement('tr');
    if (kind === 'gap') {
      tr.className = 'row-gap';
      tr.innerHTML = '<td></td><td></td>';
      tbody.appendChild(tr);
      continue;
    }
    if (kind === 'total' || kind === 'breakdown' || kind === 'subtotal') tr.className = kind;
    const valueClass = !applicable ? 'value na' : (kind === 'deduction' ? 'value deduction' : 'value');
    const valueHtml = applicable ? yen(value) : '対象外';
    tr.innerHTML = `<td class="label">${label}</td><td class="${valueClass}">${valueHtml}</td>`;
    tbody.appendChild(tr);
  }
}

function buildMonthlyRows(r) {
  const rows = [
    [r.baseSalaryLabel, r.baseSalary, 'breakdown', true],
  ];
  if (r.overtimeEntered) rows.push(['残業手当', r.overtimePay, 'breakdown', true]);
  if (r.taxableAllowanceEntered) rows.push(['その他手当（課税）', r.taxableAllowance, 'breakdown', true]);
  if (r.commuteAllowanceEntered) rows.push(['通勤手当（非課税）', r.commuteAllowance, 'breakdown', true]);
  rows.push(
    ['総支給額', r.grossPay, 'plain', true],
    ['', '', 'gap', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['課税対象額', r.taxBase, 'subtotal', true],
    ['', '', 'gap', true],
    ['源泉所得税（概算）', -r.monthlyIncomeTax, 'deduction', !r.isTaxExempt],
    ['住民税', -r.residentTax, 'deduction', true],
    ['総控除額', -(r.monthlyIncomeTax + r.residentTax), 'subtotal', true],
  );
  return rows;
}

// テキストコピー用に、画面表示と全く同じタイトル・項目・改行位置のプレーンテキストを組み立てる
function buildMonthlyCopyText(r) {
  const lines = ['給与計算シミュレーション結果', ''];
  lines.push(`${r.baseSalaryLabel}　${yen(r.baseSalary)}`);
  if (r.overtimeEntered) lines.push(`残業手当　${yen(r.overtimePay)}`);
  if (r.taxableAllowanceEntered) lines.push(`その他手当（課税）　${yen(r.taxableAllowance)}`);
  if (r.commuteAllowanceEntered) lines.push(`通勤手当（非課税）　${yen(r.commuteAllowance)}`);
  lines.push(`総支給額\t${yen(r.grossPay)}`, '');
  lines.push(`健康保険料\t${r.hasHealth ? yen(-r.healthInsurance) : '対象外'}`);
  lines.push(`子ども・子育て支援金\t${r.hasHealth ? yen(-r.childSupportLevy) : '対象外'}`);
  lines.push(`介護保険料\t${r.hasCare ? yen(-r.careInsurance) : '対象外'}`);
  lines.push(`厚生年金保険料\t${r.hasPension ? yen(-r.pensionInsurance) : '対象外'}`);
  lines.push(`雇用保険料\t${r.subjectEmploymentInsurance ? yen(-r.employmentInsurance) : '対象外'}`);
  lines.push(`社会保険料合計\t${yen(-r.socialInsuranceTotal)}`);
  lines.push(`課税対象額　${yen(r.taxBase)}`, '');
  lines.push(`源泉所得税（概算）\t${!r.isTaxExempt ? yen(-r.monthlyIncomeTax) : '対象外'}`);
  lines.push(`住民税\t${yen(-r.residentTax)}`);
  lines.push(`総控除額　${yen(-(r.monthlyIncomeTax + r.residentTax))}`, '');
  lines.push('差引支給額（手取り）', yen(r.netPay));
  return lines.join('\n');
}

let currentMonthlyResult = null;

function renderResult(r) {
  currentMonthlyResult = r;
  renderResultRows(document.querySelector('#resultTable tbody'), buildMonthlyRows(r));

  document.getElementById('netValue').textContent = yen(r.netPay);
}

const MONTHLY_INSURANCE_VISIBILITY_CONFIG = {
  employmentTypeId: 'employmentType',
  healthGroupIds: ['rateSectionHeader', 'healthTypeFieldRow', 'rateGrid'],
  employmentGroupIds: ['industryFieldRow', 'employmentRateFieldRow'],
  prefectureRowId: 'prefectureFieldRow',
  healthTypeId: 'healthInsuranceType',
  prefectureSelectId: 'prefecture',
  healthRateId: 'healthRate',
  careRateId: 'careRate',
  childLevyRateId: 'childLevyRate',
  healthRateLabelId: 'healthRateLabel',
  careRateLabelId: 'careRateLabel',
  childLevyRateLabelId: 'childLevyRateLabel',
};
const BONUS_INSURANCE_VISIBILITY_CONFIG = {
  employmentTypeId: 'bonusEmploymentType',
  healthGroupIds: ['bonusRateSectionHeader', 'bonusHealthTypeFieldRow', 'bonusRateGrid', 'bonusHealthCumulativeRow', 'bonusPensionCumulativeRow'],
  employmentGroupIds: ['bonusIndustryFieldRow', 'bonusEmploymentRateFieldRow'],
  prefectureRowId: 'bonusPrefectureFieldRow',
  healthTypeId: 'bonusHealthInsuranceType',
  prefectureSelectId: 'bonusPrefecture',
  healthRateId: 'bonusHealthRate',
  careRateId: 'bonusCareRate',
  childLevyRateId: 'bonusChildLevyRate',
  healthRateLabelId: 'bonusHealthRateLabel',
  careRateLabelId: 'bonusCareRateLabel',
  childLevyRateLabelId: 'bonusChildLevyRateLabel',
};

document.getElementById('prefecture').addEventListener('change', () => {
  applyPrefectureRate('prefecture', 'healthRate', 'careRate', 'childLevyRate');
  calculate();
});
document.getElementById('healthInsuranceType').addEventListener('change', () => {
  applyHealthInsuranceType('healthInsuranceType', 'prefectureFieldRow', 'prefecture', 'healthRate', 'careRate', 'childLevyRate', 'healthRateLabel', 'careRateLabel', 'childLevyRateLabel');
  calculate();
});
document.getElementById('industryType').addEventListener('change', () => {
  applyIndustryRate('industryType', 'employmentRate');
  calculate();
});
document.getElementById('employmentType').addEventListener('change', () => {
  applyEmploymentTypeLabel();
  updateInsuranceFieldVisibility(MONTHLY_INSURANCE_VISIBILITY_CONFIG);
  calculate();
});
document.getElementById('ageGroup').addEventListener('change', calculate);
document.getElementById('taxTable').addEventListener('change', calculate);
document.getElementById('calcMethod').addEventListener('change', calculate);
document.getElementById('calcBtn').addEventListener('click', calculate);

document.getElementById('bonusPrefecture').addEventListener('change', () => {
  applyPrefectureRate('bonusPrefecture', 'bonusHealthRate', 'bonusCareRate', 'bonusChildLevyRate');
  calculateBonus();
});
document.getElementById('bonusHealthInsuranceType').addEventListener('change', () => {
  applyHealthInsuranceType('bonusHealthInsuranceType', 'bonusPrefectureFieldRow', 'bonusPrefecture', 'bonusHealthRate', 'bonusCareRate', 'bonusChildLevyRate', 'bonusHealthRateLabel', 'bonusCareRateLabel', 'bonusChildLevyRateLabel');
  calculateBonus();
});
document.getElementById('bonusIndustryType').addEventListener('change', () => {
  applyIndustryRate('bonusIndustryType', 'bonusEmploymentRate');
  calculateBonus();
});
document.getElementById('bonusEmploymentType').addEventListener('change', () => {
  updateInsuranceFieldVisibility(BONUS_INSURANCE_VISIBILITY_CONFIG);
  calculateBonus();
});
document.getElementById('bonusAgeGroup').addEventListener('change', calculateBonus);
document.getElementById('bonusTaxTable').addEventListener('change', calculateBonus);
document.getElementById('bonusCalcMethod').addEventListener('change', calculateBonus);
document.getElementById('bonusCalcPeriod').addEventListener('change', calculateBonus);
document.getElementById('bonusHealthCumulative').addEventListener('change', calculateBonus);
document.getElementById('bonusPensionCumulative').addEventListener('change', calculateBonus);
document.getElementById('calcBonusBtn').addEventListener('click', calculateBonus);

// 「クリア」：金額系の入力項目のみを初期状態に戻す（雇用形態・都道府県等の選択項目は維持）
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('入力した内容をすべてクリアします。よろしいですか？')) return;
  ['baseSalary', 'overtimePay', 'taxableAllowance', 'commuteAllowance'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('dependents').value = '0';
  document.getElementById('residentTax').value = '0';
  calculate();
});
document.getElementById('clearBonusBtn').addEventListener('click', () => {
  if (!confirm('入力した内容をすべてクリアします。よろしいですか？')) return;
  ['bonusAmount', 'prevMonthSalary'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('bonusDependents').value = '0';
  document.getElementById('bonusHealthCumulative').value = '0';
  document.getElementById('bonusPensionCumulative').value = '0';
  calculateBonus();
});

['baseSalary', 'overtimePay', 'taxableAllowance', 'commuteAllowance', 'residentTax', 'bonusAmount', 'prevMonthSalary', 'bonusHealthCumulative', 'bonusPensionCumulative']
  .forEach(attachThousandsFormatting);

document.getElementById('tabMonthlyBtn').addEventListener('click', () => {
  document.getElementById('tabMonthlyBtn').classList.add('active');
  document.getElementById('tabBonusBtn').classList.remove('active');
  document.getElementById('tabMonthly').classList.add('active');
  document.getElementById('tabBonus').classList.remove('active');
});
document.getElementById('tabBonusBtn').addEventListener('click', () => {
  document.getElementById('tabBonusBtn').classList.add('active');
  document.getElementById('tabMonthlyBtn').classList.remove('active');
  document.getElementById('tabBonus').classList.add('active');
  document.getElementById('tabMonthly').classList.remove('active');
});

// 固定幅ではなく、画面幅いっぱいに広がりつつ上限（max-width）で収まるようにする
function setMobileView(isMobile) {
  const pageEl = document.querySelector('.page');
  pageEl.classList.toggle('is-mobile-view', isMobile);
  pageEl.style.width = '100%';
  pageEl.style.maxWidth = isMobile ? '375px' : '900px';
  pageEl.style.minWidth = '';
  // グリッドは @media (max-width:780px) で自動的に1カラム化される仕様のため、
  // PC版強制時はインラインで明示的にデスクトップ用の値を指定してメディアクエリに勝たせる
  document.querySelectorAll('.grid').forEach((g) => {
    g.style.gridTemplateColumns = isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.15fr) minmax(0, 1fr)';
  });
  document.querySelectorAll('.payslip').forEach((p) => {
    p.style.position = isMobile ? 'static' : 'sticky';
  });
  document.querySelectorAll('.masthead .sub').forEach((s) => {
    s.style.maxWidth = isMobile ? '100%' : '46em';
  });
}

document.getElementById('viewPcBtn').addEventListener('click', () => {
  setMobileView(false);
  document.getElementById('viewPcBtn').classList.add('active');
  document.getElementById('viewMobileBtn').classList.remove('active');
});
document.getElementById('viewMobileBtn').addEventListener('click', () => {
  setMobileView(true);
  document.getElementById('viewMobileBtn').classList.add('active');
  document.getElementById('viewPcBtn').classList.remove('active');
});

// 実際の画面幅に応じて初期表示モードを自動判定（スマホなら最初からスマホ版に）
if (window.innerWidth < 700) {
  setMobileView(true);
  document.getElementById('viewMobileBtn').classList.add('active');
  document.getElementById('viewPcBtn').classList.remove('active');
} else {
  setMobileView(false);
}

populatePrefectureSelect('prefecture', 'healthRate', 'careRate', 'childLevyRate');
populateIndustrySelect('industryType', 'employmentRate');
populatePrefectureSelect('bonusPrefecture', 'bonusHealthRate', 'bonusCareRate', 'bonusChildLevyRate');
populateIndustrySelect('bonusIndustryType', 'bonusEmploymentRate');
applyEmploymentTypeLabel();
applyHealthInsuranceType('healthInsuranceType', 'prefectureFieldRow', 'prefecture', 'healthRate', 'careRate', 'childLevyRate', 'healthRateLabel', 'careRateLabel', 'childLevyRateLabel');
applyHealthInsuranceType('bonusHealthInsuranceType', 'bonusPrefectureFieldRow', 'bonusPrefecture', 'bonusHealthRate', 'bonusCareRate', 'bonusChildLevyRate', 'bonusHealthRateLabel', 'bonusCareRateLabel', 'bonusChildLevyRateLabel');
updateInsuranceFieldVisibility(MONTHLY_INSURANCE_VISIBILITY_CONFIG);
updateInsuranceFieldVisibility(BONUS_INSURANCE_VISIBILITY_CONFIG);
calculate();
calculateBonus();

// 結果のPDF出力（ブラウザの印刷機能を利用）
// 印刷対象の内容を専用の印刷用エリアに複製し、他の要素を印刷から完全に除外する
// （visibility:hiddenだけでは要素が高さを占有したままになり、余分な白紙ページが出るため）
function printSection(targetId) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = document.getElementById(targetId).innerHTML;
  // 複製した要素のidを取り除き、元の要素とのid重複（Excel出力・コピーが二重に取得してしまう不具合）を防ぐ
  printArea.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  window.print();
}

function showExportStatus(statusId, message, isError) {
  const el = document.getElementById(statusId);
  el.textContent = message;
  el.classList.toggle('error', !!isError);
}

// 結果のExcel出力（Excelで開けるHTMLテーブル形式の.xlsを生成、格子状の罫線付き）
function exportTableToExcel(tableId, filename, extraRow, statusId) {
  const cellStyle = 'border:1px solid #000;padding:5px 10px;';
  const headStyle = cellStyle + 'background:#eee;font-weight:bold;';
  let rows = '';
  document.getElementById(tableId).querySelectorAll('tbody tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => `<td style="${cellStyle}">${td.textContent.trim()}</td>`).join('');
    rows += `<tr>${cells}</tr>`;
  });
  if (extraRow) {
    rows += `<tr><td style="${cellStyle}font-weight:bold;">${extraRow[0]}</td><td style="${cellStyle}font-weight:bold;">${extraRow[1]}</td></tr>`;
  }
  const html = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;"><thead><tr><th style="${headStyle}">項目</th><th style="${headStyle}">金額</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showExportStatus(statusId, '保存しました。');
}

// 結果を、画面表示と同じ体裁のプレーンテキストとしてクリップボードにコピー
async function copyTextToClipboard(text, statusId) {
  try {
    await navigator.clipboard.writeText(text);
    showExportStatus(statusId, 'コピーしました。Excelなどに貼り付けてください。', false);
  } catch (e) {
    showExportStatus(statusId, 'コピーに失敗しました：' + (e && e.message ? e.message : e), true);
  }
}

document.getElementById('exportPdfBtn').addEventListener('click', () => printSection('resultCard'));
document.getElementById('exportExcelBtn').addEventListener('click', () => exportTableToExcel(
  'resultTable', '給与計算シミュレーション結果.xls',
  ['差引支給額（手取り）', document.getElementById('netValue').textContent.trim()],
  'exportStatus'
));
document.getElementById('exportCopyBtn').addEventListener('click', () => copyTextToClipboard(
  buildMonthlyCopyText(currentMonthlyResult),
  'exportStatus'
));
document.getElementById('bonusExportPdfBtn').addEventListener('click', () => printSection('bonusResultCard'));
document.getElementById('bonusExportExcelBtn').addEventListener('click', () => exportTableToExcel(
  'bonusResultTable', '賞与計算シミュレーション結果.xls',
  ['差引支給額（手取り）', document.getElementById('bonusNetValue').textContent.trim()],
  'bonusExportStatus'
));
document.getElementById('bonusExportCopyBtn').addEventListener('click', () => copyTextToClipboard(
  buildBonusCopyText(currentBonusResult),
  'bonusExportStatus'
));

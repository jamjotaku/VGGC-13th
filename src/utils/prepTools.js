// src/utils/prepTools.js
// T-065 サークル向け便利機能（①準備チェックリスト / ②釣り銭準備プランナー / ③告知ポスト＋直リンク）用の純粋ロジック

export const DEFAULT_PREP_CHECKLIST = [
  { id: 'chk_pass', category: '基本', label: 'サークル通行証・身分証・入場案内', done: false },
  { id: 'chk_money', category: '会計', label: '釣り銭（1,000円札・500円玉・100円玉）＋コイントレー', done: false },
  { id: 'chk_cashless', category: '会計', label: 'スマホ決済用スタンド・充電モバイルバッテリー', done: false },
  { id: 'chk_display', category: '設営', label: '敷き布・ポスタースタンド・値札・お品書きPOP', done: false },
  { id: 'chk_stationery', category: '設営', label: '養生テープ・はさみ・マジック・見本誌シール', done: false },
  { id: 'chk_pack', category: '撤収・宅配搬出', label: 'ガムテープ・緩衝材・宅配搬出用伝票（着払い/元払い）', done: false },
  { id: 'chk_box', category: '撤収・宅配搬出', label: '残部梱包用段ボール・持ち帰り用バッグ', done: false }
];

/**
 * 販売予定価格帯×部数と想定金種比率から必要釣り銭の目安を算出する
 * @param {Array<{label:string, price:number, qty:number}>} rows
 * @param {{ratio1000:number, ratio5000:number, ratio10000:number}} mixPct
 */
export function calculateChangePlan(rows = [], mixPct = { ratio1000: 60, ratio5000: 25, ratio10000: 15 }) {
  const validRows = (rows || []).filter((r) => Number(r?.price) > 0 && Number(r?.qty) > 0);
  const totalSalesQty = validRows.reduce((sum, r) => sum + Number(r.qty), 0);
  const expectedRevenue = validRows.reduce((sum, r) => sum + Number(r.price) * Number(r.qty), 0);

  // 1,000円未満の端数（500円・100円単位）が出る購入回数と、5,000円・10,000円札での支払い回数を概算
  const totalMix = Math.max(1, Number(mixPct.ratio1000 || 0) + Number(mixPct.ratio5000 || 0) + Number(mixPct.ratio10000 || 0));
  const r5000 = Number(mixPct.ratio5000 || 0) / totalMix;
  const r10000 = Number(mixPct.ratio10000 || 0) / totalMix;

  let need1000Bills = 0;
  let need500Coins = 0;
  let need100Coins = 0;

  for (const row of validRows) {
    const price = Number(row.price);
    const qty = Number(row.qty);
    const mod1000 = price % 1000;

    // 1000円単位の端数（例: 500円, 800円, 300円）に対する硬貨の釣り銭需要
    if (mod1000 > 0) {
      const changeCoinPart = 1000 - mod1000;
      // ぴったり払いを差し引き、約60%で小銭釣り銭が発生すると仮定
      const coinEvents = Math.ceil(qty * 0.6);
      need500Coins += Math.floor(changeCoinPart / 500) * coinEvents;
      const rem100 = changeCoinPart % 500;
      need100Coins += Math.ceil(rem100 / 100) * coinEvents;
    }

    // 高額紙幣（5,000円 / 10,000円）に対する 1,000円札の釣り銭需要
    const changeFrom5000 = Math.max(0, Math.floor((5000 - price) / 1000));
    const changeFrom10000 = Math.max(0, Math.floor((10000 - price) / 1000));
    // お釣りの一部は前の客から受け取った1,000円札が循環するため、初期準備は概ね65%を目安にする
    const raw1000Need = qty * (r5000 * changeFrom5000 + r10000 * changeFrom10000) * 0.65;
    need1000Bills += Math.ceil(raw1000Need);
  }

  // 安全バッファ（最小確保数）
  if (totalSalesQty > 0) {
    need1000Bills = Math.max(need1000Bills, 10);
    need500Coins = Math.max(need500Coins, 6);
    need100Coins = Math.max(need100Coins, 10);
  }

  const totalPrepareAmount = need1000Bills * 1000 + need500Coins * 500 + need100Coins * 100;

  return {
    totalSalesQty,
    expectedRevenue,
    need1000Bills,
    need500Coins,
    need100Coins,
    totalPrepareAmount
  };
}

/**
 * サークル直リンク（?circle=...）を生成する
 */
export function buildCircleShareUrl(originAndPath, circleId, extraParams = {}) {
  const url = new URL(originAndPath);
  url.searchParams.set('circle', circleId);
  Object.entries(extraParams || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

/**
 * 告知ポスト用テンプレート文を生成する
 */
export function buildAnnouncementText({ circle, extra, shareUrl, customNote = '', eventHashtag = '#VGGC13th' }) {
  if (!circle) return '';
  const space = `${circle.space_sym}-${circle.space_num}`;
  const items = Array.isArray(extra?.items) ? extra.items : [];
  const itemLines = items.slice(0, 4).map((it) => `・${it.name}（¥${Number(it.price || 0).toLocaleString()}）`);
  const lines = [
    `【おしながき / スペース ${space}】`,
    `サークル「${circle.circle_name}」で参加します！`,
    ...(itemLines.length > 0 ? ['', ...itemLines] : []),
    ...(customNote.trim() ? ['', customNote.trim()] : []),
    '',
    `▼ 買い物リスト・詳細はこちら`,
    shareUrl,
    eventHashtag
  ];
  return lines.join('\n');
}

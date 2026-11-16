// src/utils/registerV2.js
// 簡易POSレジ v2 用純粋ロジック（複数端末イベントログマージ / 決済別集計 / CSV生成）

/**
 * トランザクション配列（または加算イベントログ）から、有効な商品別頒布数と決済別売上を集計する
 * 複数端末で同時レジ打ちした履歴をマージする際の決定論的リデューサー
 *
 * @param {Array} transactions - [{ id, timestamp, items: [{ id, name, price, qty }], total, paymentMethod, voided, deviceLabel }]
 * @returns {{ soldCountsByProductId: Object, cashTotal: number, cashlessTotal: number, grandTotal: number, validTxCount: number }}
 */
export function aggregateTransactions(transactions = []) {
  const soldCountsByProductId = {};
  let cashTotal = 0;
  let cashlessTotal = 0;
  let validTxCount = 0;

  for (const tx of transactions) {
    if (!tx || tx.voided) continue;
    validTxCount++;
    const total = Number(tx.total) || 0;
    if (tx.paymentMethod === 'cashless') {
      cashlessTotal += total;
    } else {
      cashTotal += total;
    }

    for (const item of tx.items || []) {
      if (!item || !item.id) continue;
      soldCountsByProductId[item.id] = (soldCountsByProductId[item.id] || 0) + (Number(item.qty) || 0);
    }
  }

  return {
    soldCountsByProductId,
    cashTotal,
    cashlessTotal,
    grandTotal: cashTotal + cashlessTotal,
    validTxCount
  };
}

/**
 * ローカルのトランザクション履歴とクラウドのイベントログ（checkout / void）を決定論的にマージする
 * オフライン復帰時や複数端末同時レジ打ち時でも、全端末の会計・取消を欠落なく統合する
 *
 * @param {Array} localTransactions
 * @param {Array} cloudEvents - [{ id, event_type, payload, device_label, created_at }]
 * @returns {Array} マージ済みトランザクション配列（新しい順）
 */
export function mergeTransactionsWithCloudEvents(localTransactions = [], cloudEvents = []) {
  const txMap = new Map();

  for (const tx of localTransactions) {
    if (!tx || !tx.id) continue;
    txMap.set(tx.id, {
      ...tx,
      paymentMethod: tx.paymentMethod || 'cash',
      voided: Boolean(tx.voided)
    });
  }

  // 1. checkout イベントを適用
  for (const ev of cloudEvents) {
    if (!ev || ev.event_type !== 'checkout') continue;
    const p = ev.payload || {};
    const txId = p.txId || ev.id;
    if (!txId) continue;
    if (!txMap.has(txId)) {
      txMap.set(txId, {
        id: txId,
        timestamp: p.timestamp || ev.created_at,
        items: Array.isArray(p.items) ? p.items : [],
        total: Number(p.total) || 0,
        deposit: Number(p.deposit) || 0,
        change: Number(p.change) || 0,
        paymentMethod: p.paymentMethod || 'cash',
        deviceLabel: p.deviceLabel || ev.device_label || '',
        voided: false,
        synced: true
      });
    } else {
      txMap.get(txId).synced = true;
    }
  }

  // 2. void（取消）イベントを適用
  for (const ev of cloudEvents) {
    if (!ev || ev.event_type !== 'void') continue;
    const targetTxId = ev.payload?.targetTxId;
    if (targetTxId && txMap.has(targetTxId)) {
      txMap.get(targetTxId).voided = true;
    }
  }

  return Array.from(txMap.values()).sort((a, b) => {
    const ta = Date.parse(a.timestamp || '') || 0;
    const tb = Date.parse(b.timestamp || '') || 0;
    return tb - ta;
  });
}

/**
 * CSV セルの安全なエスケープ
 */
function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * 会計明細＋商品別売上の精算用 CSV 文字列（UTF-8 BOM 付き）を生成する
 *
 * @param {Object} params
 * @param {string} params.circleLabel
 * @param {Array} params.transactions
 * @param {Array} params.products
 * @returns {string}
 */
export function buildRegisterSettlementCsv({ circleLabel = '', transactions = [], products = [] }) {
  const agg = aggregateTransactions(transactions);
  const lines = [];

  lines.push(['# サークル精算レポート', circleLabel].map(escapeCsvCell).join(','));
  lines.push(['有効会計件数', agg.validTxCount, '現金売上合計', agg.cashTotal, 'キャッシュレス売上合計', agg.cashlessTotal, '総売上', agg.grandTotal].map(escapeCsvCell).join(','));
  lines.push('');

  lines.push(['[商品別集計]', '商品名', '担当', '単価', '販売数', '残数', '売上金額'].map(escapeCsvCell).join(','));
  for (const p of products) {
    const sold = Number(p.soldCount) || 0;
    const rem = p.remainingStock === null || p.remainingStock === undefined ? '∞' : p.remainingStock;
    lines.push([
      'ITEM',
      p.name,
      p.seller || '未設定',
      Number(p.price) || 0,
      sold,
      rem,
      (Number(p.price) || 0) * sold
    ].map(escapeCsvCell).join(','));
  }

  lines.push('');
  lines.push(['[会計明細]', '会計ID', '日時', '決済方法', '合計金額', '預り金', 'お釣り', '状態', '端末', '内訳'].map(escapeCsvCell).join(','));
  for (const tx of transactions) {
    const itemsSummary = (tx.items || []).map(i => `${i.name}x${i.qty}`).join(' / ');
    lines.push([
      'TX',
      tx.id,
      tx.timestamp,
      tx.paymentMethod === 'cashless' ? 'キャッシュレス' : '現金',
      Number(tx.total) || 0,
      Number(tx.deposit) || 0,
      Number(tx.change) || 0,
      tx.voided ? '取消済' : '有効',
      tx.deviceLabel || '',
      itemsSummary
    ].map(escapeCsvCell).join(','));
  }

  return '\uFEFF' + lines.join('\r\n');
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateTransactions,
  mergeTransactionsWithCloudEvents,
  buildRegisterSettlementCsv
} from '../src/utils/registerV2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== VGGC 13th 簡易POSレジ v2 自動テスト ===');

// 1. 複数端末イベントログのマージ（親タブレット + 売り子スマホのオフライン復帰同期＋取消）
const localTxs = [
  {
    id: 'tx_tablet_1',
    timestamp: '2027-03-06T12:01:00.000Z',
    items: [{ id: 'base_0', name: '新刊セット', price: 1500, qty: 2 }],
    total: 3000,
    deposit: 5000,
    change: 2000,
    paymentMethod: 'cash',
    deviceLabel: 'PC/タブレット',
    voided: false
  }
];

const cloudEvents = [
  {
    id: 'tx_staff_1',
    event_type: 'checkout',
    device_label: 'スマホ端末',
    created_at: '2027-03-06T12:02:00.000Z',
    payload: {
      txId: 'tx_staff_1',
      timestamp: '2027-03-06T12:02:00.000Z',
      items: [{ id: 'base_0', name: '新刊セット', price: 1500, qty: 1 }, { id: 'base_1', name: '色紙', price: 1000, qty: 1 }],
      total: 2500,
      deposit: 2500,
      change: 0,
      paymentMethod: 'cashless',
      deviceLabel: 'スマホ端末'
    }
  },
  {
    id: 'tx_staff_2',
    event_type: 'checkout',
    device_label: 'スマホ端末',
    created_at: '2027-03-06T12:03:00.000Z',
    payload: {
      txId: 'tx_staff_2',
      timestamp: '2027-03-06T12:03:00.000Z',
      items: [{ id: 'base_1', name: '色紙', price: 1000, qty: 1 }],
      total: 1000,
      deposit: 1000,
      change: 0,
      paymentMethod: 'cash',
      deviceLabel: 'スマホ端末'
    }
  },
  {
    id: 'void_tx_staff_2',
    event_type: 'void',
    created_at: '2027-03-06T12:04:00.000Z',
    payload: { targetTxId: 'tx_staff_2' }
  }
];

const merged = mergeTransactionsWithCloudEvents(localTxs, cloudEvents);
assert.equal(merged.length, 3);
assert.equal(merged.find(t => t.id === 'tx_staff_2').voided, true);
console.log('  ✅ [PASS] 複数端末同時レジ打ちイベントログの決定論的マージ＆取消反映');

// 2. 決済方法別（現金 / キャッシュレス）集計＆商品別販売数再計算
const agg = aggregateTransactions(merged);
assert.equal(agg.validTxCount, 2);
assert.equal(agg.cashTotal, 3000);
assert.equal(agg.cashlessTotal, 2500);
assert.equal(agg.grandTotal, 5500);
assert.equal(agg.soldCountsByProductId['base_0'], 3);
assert.equal(agg.soldCountsByProductId['base_1'], 1);
console.log('  ✅ [PASS] 現金/キャッシュレス別集計＆商品別販売数の正確な再計算');

// 3. 精算 CSV 生成（UTF-8 BOM付）
const csv = buildRegisterSettlementCsv({
  circleLabel: 'M-15-16 Black Stance',
  transactions: merged,
  products: [
    { id: 'base_0', name: '新刊セット', seller: 'BLΔCK', price: 1500, soldCount: 3, remainingStock: 7 },
    { id: 'base_1', name: '色紙', seller: 'きょこち。', price: 1000, soldCount: 1, remainingStock: null }
  ]
});
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('M-15-16 Black Stance'));
assert.ok(csv.includes('キャッシュレス'));
assert.ok(csv.includes('取消済'));
console.log('  ✅ [PASS] 精算用 CSV 出力（UTF-8 BOM付・明細＆集計）');

// 4. SQL 定義チェック
const sql = fs.readFileSync(path.join(rootDir, 'supabase', 'register_v2.sql'), 'utf8');
for (const token of [
  'CREATE TABLE IF NOT EXISTS public.circle_register_states',
  'CREATE TABLE IF NOT EXISTS public.circle_register_events',
  'get_my_circle_demand_stats',
  'ENABLE ROW LEVEL SECURITY'
]) {
  assert.ok(sql.includes(token), `Missing SQL definition: ${token}`);
}
console.log('  ✅ [PASS] supabase/register_v2.sql のテーブル・RLS・RPC 定義検証');

console.log('✅ 全ての簡易POSレジ v2 テストに合格しました！');

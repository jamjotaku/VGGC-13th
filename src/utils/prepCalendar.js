// src/utils/prepCalendar.js
// VGGC 13th サークル向け「準備」ビュー & 入稿目安カレンダーのデータスキーマ・計算ロジック

import { EVENT_CONFIG } from '../eventConfig';

/**
 * 印刷所締切エントリ（printers[]）の標準スキーマ定義:
 * - id: string
 * - name: string (印刷所名)
 * - directDeliveryDeadline: string | null (直接搬入の通常締切 ISO日付例 '2027-03-02' または日時)
 * - normalDeadline: string | null (通常入稿・自宅/宅配搬入の締切 ISO日付)
 * - hasSurcharge: boolean (割増締切の有無)
 * - surchargeDeadline: string | null (割増最終締切 ISO日付)
 * - surchargeRateText: string (割増率表示例 '+10%〜40%')
 * - supportType: 'venue' | 'event' | 'delivery_only' (会場対応 / イベント対応 / 宅配搬入のみ)
 * - notes: string (備考・特殊加工注意点など)
 * - officialUrl: string (公式URL)
 * - accuracy: 'estimate' | 'confirmed' (目安 / 確定)
 * - lastCheckedAt: string | null (最終確認日 'YYYY-MM-DD')
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SUPPORT_TYPE_LABELS = {
  venue: { label: '会場対応（直接搬入）', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  event: { label: 'イベント対応（要確認）', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  delivery_only: { label: '宅配搬入のみ', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
};

/**
 * ISO日付文字列（YYYY-MM-DD または ISO8601）を JST 0:00 の Date に正規化
 */
export function parseJstDate(dateStr) {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00+09:00`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 締切日までの残り日数を JST 暦日基準で算出
 */
export function getDeadlineCountdown(dateStr, now = new Date()) {
  const target = parseJstDate(dateStr);
  if (!target) return null;

  const nowJstDay = Math.floor((now.getTime() + JST_OFFSET_MS) / MS_PER_DAY);
  const targetJstDay = Math.floor((target.getTime() + JST_OFFSET_MS) / MS_PER_DAY);
  const diffDays = targetJstDay - nowJstDay;

  if (diffDays < 0) {
    return { diffDays, label: '締切終了', tone: 'ended' };
  }
  if (diffDays === 0) {
    return { diffDays, label: '本日締切', tone: 'urgent' };
  }
  if (diffDays <= 7) {
    return { diffDays, label: `あと${diffDays}日`, tone: 'warning' };
  }
  return { diffDays, label: `あと${diffDays}日`, tone: 'normal' };
}

/**
 * 安全バッファ日数を引いた「自分の目標入稿日 (YYYY-MM-DD)」を算出
 */
export function calculateSafeTargetDate(dateStr, bufferDays = 3) {
  const target = parseJstDate(dateStr);
  if (!target) return null;
  const safeMs = target.getTime() - Math.max(0, Number(bufferDays) || 0) * MS_PER_DAY;
  const safeJst = new Date(safeMs + JST_OFFSET_MS);
  const y = safeJst.getUTCFullYear();
  const m = String(safeJst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(safeJst.getUTCDate()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const w = weekdays[safeJst.getUTCDay()];
  return {
    iso: `${y}-${m}-${d}`,
    display: `${Number(m)}/${Number(d)}(${w})`
  };
}

/**
 * 日付表示整形 (例: 2027-03-02 -> 3/2(火))
 */
export function formatJstShortDate(dateStr) {
  const d = parseJstDate(dateStr);
  if (!d) return '未定';
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${m}/${day}(${weekdays[jst.getUTCDay()]})`;
}

/**
 * テストモード（?mode=test）専用のダミー印刷所締切データ
 * ※架空の印刷所名を使用し、カレンダー挙動・並び替え・カウントダウン・安全締切計算の検証用
 */
export function getMockPrintDeadlines() {
  return {
    schemaVersion: '1.0.0',
    eventName: EVENT_CONFIG.name,
    eventDate: EVENT_CONFIG.date,
    status: 'test_mock',
    expectedPublishWindow: '2026年12月〜2027年1月',
    lastUpdated: '2026-11-17',
    printers: [
      {
        id: 'mock_hoshikuzu',
        name: '【テスト】星屑印刷株式会社',
        directDeliveryDeadline: '2027-03-02',
        normalDeadline: '2027-02-26',
        hasSurcharge: true,
        surchargeDeadline: '2027-03-03',
        surchargeRateText: '+20%（特急便）',
        supportType: 'venue',
        notes: '会場（TRC）単位での直接搬入に対応。特殊加工・カバー有は5営業日前倒し想定。',
        officialUrl: '',
        accuracy: 'estimate',
        lastCheckedAt: '2026-11-17'
      },
      {
        id: 'mock_tsukiyo',
        name: '【テスト】月夜プリント工房',
        directDeliveryDeadline: '2027-02-26',
        normalDeadline: '2027-02-24',
        hasSurcharge: true,
        surchargeDeadline: '2027-03-03',
        surchargeRateText: '+10%〜40%',
        supportType: 'venue',
        notes: '通常締切は昼12時想定。割増プランで3月頭まで延長できるテストケース。',
        officialUrl: '',
        accuracy: 'confirmed',
        lastCheckedAt: '2026-11-17'
      },
      {
        id: 'mock_gokusai',
        name: '【テスト】極彩プレス',
        directDeliveryDeadline: '2027-02-25',
        normalDeadline: '2027-02-22',
        hasSurcharge: false,
        surchargeDeadline: null,
        surchargeRateText: '',
        supportType: 'event',
        notes: 'イベント単位の提携設定に依存。対象外の場合は宅配搬入扱いになります。',
        officialUrl: '',
        accuracy: 'estimate',
        lastCheckedAt: '2026-11-17'
      },
      {
        id: 'mock_garasu',
        name: '【テスト】硝子製本所',
        directDeliveryDeadline: null,
        normalDeadline: '2027-02-24',
        hasSurcharge: false,
        surchargeDeadline: null,
        surchargeRateText: '',
        supportType: 'delivery_only',
        notes: '直接搬入非対応・宅配搬入または自宅配送のみのテストケース（開催2〜3日前着）。',
        officialUrl: '',
        accuracy: 'estimate',
        lastCheckedAt: '2026-11-17'
      },
      {
        id: 'mock_suisei',
        name: '【テスト】彗星オンデマンド',
        directDeliveryDeadline: '2027-03-01',
        normalDeadline: '2027-02-25',
        hasSurcharge: true,
        surchargeDeadline: '2027-03-04',
        surchargeRateText: '+30%（直前割増）',
        supportType: 'venue',
        notes: '2/23(天皇誕生日)を挟むため営業日換算に注意するテストケース。',
        officialUrl: '',
        accuracy: 'confirmed',
        lastCheckedAt: '2026-11-17'
      }
    ]
  };
}

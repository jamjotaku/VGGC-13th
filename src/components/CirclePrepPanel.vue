<template>
  <div class="p-3 md:p-5 max-w-4xl mx-auto space-y-4 pb-28 md:pb-10">

    <!-- 準備ビュー ヘッダー -->
    <div class="bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 text-white rounded-2xl p-4 md:p-5 shadow-md">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xl">🛠️</span>
            <h2 class="text-base md:text-lg font-black tracking-tight">サークル参加 準備ビュー</h2>
            <span v-if="isTestMode" class="px-2 py-0.5 rounded-full bg-indigo-500/90 border border-white/30 text-[10px] font-black">
              🧪 TEST MOCK DATA
            </span>
          </div>
          <p class="text-xs text-teal-50 mt-1">
            {{ EVENT_CONFIG.name }}（{{ EVENT_CONFIG.dateLabel }}・{{ EVENT_CONFIG.venue }}）に向けた入稿スケジュールと準備の受け皿です（ログイン不要）。
          </p>
        </div>

        <div class="bg-white/15 backdrop-blur-xs border border-white/20 rounded-xl px-3 py-1.5 text-right shrink-0">
          <div class="text-[10px] text-teal-100 font-bold">開催日まで</div>
          <div class="text-sm font-black font-mono">{{ eventCountdown.badge }}</div>
        </div>
      </div>
    </div>

    <!-- サブセクション1: 入稿目安カレンダー -->
    <section class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-3.5 md:p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50/70">
        <div>
          <h3 class="font-extrabold text-sm md:text-base text-gray-900 flex items-center gap-1.5">
            <span>📅</span>
            <span>印刷所 入稿締切カレンダー</span>
          </h3>
          <p class="text-[11px] text-gray-500 mt-0.5">
            <template v-if="printers.length > 0">
              ご自身の余裕日数（安全バッファ）を設定して、目標入稿日の目安を確認できます。
            </template>
            <template v-else>
              各印刷所の正式なイベント別締切表を公開待ちです。
            </template>
          </p>
        </div>

        <span v-if="deadlineData.lastUpdated" class="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
          最終更新: {{ deadlineData.lastUpdated }}
        </span>
      </div>

      <!-- 空状態（正式締切表 公開待ち） -->
      <div v-if="printers.length === 0" class="p-6 md:p-8 text-center space-y-4">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center text-2xl shadow-2xs">
          🗓️
        </div>
        <div class="space-y-1.5 max-w-md mx-auto">
          <h4 class="font-extrabold text-sm md:text-base text-gray-800">
            締切表は {{ deadlineData.expectedPublishWindow || '2026年12月〜2027年1月' }} に公開予定です
          </h4>
          <p class="text-xs text-gray-600 leading-relaxed">
            2027年3月6日（土）開催向けの正式な印刷所別スケジュールは、各社からの発表後に照合・反映されます。<br>
            確定までの間、不正確な日付で誤認を招かないよう現在はデータ未登録（準備枠）としています。
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span class="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[11px] font-bold">
            📌 スキーマ待機中（schema v{{ deadlineData.schemaVersion }}）
          </span>
          <a v-if="enableTestMode && !isTestMode"
             href="?mode=test"
             class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition">
            🧪 テストモードで挙動をプレビューする
          </a>
        </div>
      </div>

      <!-- データ表示時（テストモード / 正式データ投入後） -->
      <div v-else class="p-3.5 md:p-4 space-y-3.5">
        <!-- コントロールバー（安全バッファ・フィルタ・並び順） -->
        <div class="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
              <span>🎯 安全バッファ:</span>
              <select v-model.number="safetyBufferDays"
                      class="h-8 px-2 text-xs font-bold bg-white border border-teal-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
                <option :value="0">0日（締切当日）</option>
                <option :value="2">2日前（推奨）</option>
                <option :value="3">3日前（余裕あり）</option>
                <option :value="5">5日前（安心）</option>
                <option :value="7">7日前（超安全）</option>
              </select>
            </label>

            <select v-model="filterSupportType"
                    class="h-8 px-2 text-xs font-bold bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
              <option value="all">対応種別: すべて ({{ printers.length }})</option>
              <option value="venue">会場対応（直接搬入）</option>
              <option value="event">イベント対応（要確認）</option>
              <option value="delivery_only">宅配搬入のみ</option>
            </select>
          </div>

          <select v-model="sortKey"
                  class="h-8 px-2 text-xs font-bold bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
            <option value="direct">並び: 直接搬入が早い順</option>
            <option value="normal">並び: 通常入稿が早い順</option>
            <option value="name">並び: 印刷所名順</option>
          </select>
        </div>

        <!-- 印刷所カード一覧 -->
        <div class="space-y-2.5">
          <div v-for="p in filteredAndSortedPrinters" :key="p.id"
               class="rounded-xl border border-gray-200 bg-white hover:border-teal-300 p-3.5 shadow-2xs transition space-y-2.5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="font-black text-sm text-gray-900">{{ p.name }}</h4>
                  <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold"
                        :class="SUPPORT_TYPE_LABELS[p.supportType]?.badgeClass || 'bg-gray-100 text-gray-700 border-gray-200'">
                    {{ SUPPORT_TYPE_LABELS[p.supportType]?.label || p.supportType }}
                  </span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded font-bold border"
                        :class="p.accuracy === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'">
                    {{ p.accuracy === 'confirmed' ? '公式確定' : '目安' }}
                  </span>
                </div>
              </div>

              <a v-if="p.officialUrl"
                 :href="p.officialUrl"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="text-[11px] font-bold text-teal-700 hover:underline shrink-0">
                公式サイト ↗
              </a>
            </div>

            <!-- 締切グリッド -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <!-- 直接搬入 -->
              <div class="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div class="text-[10px] font-bold text-slate-500">直接搬入（通常締切）</div>
                  <div class="font-black text-slate-900 font-mono mt-0.5">
                    {{ p.directDeliveryDeadline ? formatJstShortDate(p.directDeliveryDeadline) : '非対応 / 宅配のみ' }}
                  </div>
                  <div v-if="p.directDeliveryDeadline && safetyBufferDays > 0" class="text-[10px] text-teal-700 font-bold mt-0.5">
                    🎯 目標: {{ calculateSafeTargetDate(p.directDeliveryDeadline, safetyBufferDays)?.display }}
                  </div>
                </div>
                <span v-if="getDeadlineCountdown(p.directDeliveryDeadline)"
                      class="px-2 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0"
                      :class="countdownBadgeClass(getDeadlineCountdown(p.directDeliveryDeadline).tone)">
                  {{ getDeadlineCountdown(p.directDeliveryDeadline).label }}
                </span>
              </div>

              <!-- 通常入稿（宅配・自宅） -->
              <div class="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div class="text-[10px] font-bold text-slate-500">通常入稿（宅配搬入・自宅）</div>
                  <div class="font-black text-slate-900 font-mono mt-0.5">
                    {{ p.normalDeadline ? formatJstShortDate(p.normalDeadline) : '要確認' }}
                  </div>
                  <div v-if="p.normalDeadline && safetyBufferDays > 0" class="text-[10px] text-teal-700 font-bold mt-0.5">
                    🎯 目標: {{ calculateSafeTargetDate(p.normalDeadline, safetyBufferDays)?.display }}
                  </div>
                </div>
                <span v-if="getDeadlineCountdown(p.normalDeadline)"
                      class="px-2 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0"
                      :class="countdownBadgeClass(getDeadlineCountdown(p.normalDeadline).tone)">
                  {{ getDeadlineCountdown(p.normalDeadline).label }}
                </span>
              </div>
            </div>

            <!-- 割増・備考 -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
              <div class="space-y-0.5">
                <div v-if="p.hasSurcharge" class="text-amber-800 font-bold">
                  ⚡ 割増締切あり: {{ formatJstShortDate(p.surchargeDeadline) }} {{ p.surchargeRateText }}
                </div>
                <div v-if="p.notes">{{ p.notes }}</div>
              </div>
              <span v-if="p.lastCheckedAt" class="text-[10px] text-gray-400 font-mono shrink-0">
                確認日: {{ p.lastCheckedAt }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- サブセクション2: 今後の拡張スロット（枠） -->
    <section class="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-600 space-y-1.5">
      <div class="font-extrabold text-slate-800 flex items-center gap-1.5">
        <span>🧩</span>
        <span>サークル準備ツール 拡張予定エリア</span>
      </div>
      <p class="leading-relaxed text-[11px]">
        今後、準備チェックリスト・釣り銭準備プランナー・告知補助ツールなどを順次この「準備」ビューへ追加できる設計になっています。
      </p>
    </section>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { EVENT_CONFIG } from '../eventConfig';
import { getEventCountdown } from '../utils/countdown';
import { ENABLE_TEST_MODE } from '../utils/testMode';
import staticPrintDeadlines from '../data/printDeadlines.json';
import {
  SUPPORT_TYPE_LABELS,
  getDeadlineCountdown,
  calculateSafeTargetDate,
  formatJstShortDate,
  getMockPrintDeadlines
} from '../utils/prepCalendar';

const props = defineProps({
  isTestMode: { type: Boolean, default: false }
});

const enableTestMode = ENABLE_TEST_MODE;
const safetyBufferDays = ref(2);
const filterSupportType = ref('all');
const sortKey = ref('direct');

const eventCountdown = computed(() => getEventCountdown());

const deadlineData = computed(() => {
  return props.isTestMode ? getMockPrintDeadlines() : staticPrintDeadlines;
});

const printers = computed(() => deadlineData.value?.printers || []);

const filteredAndSortedPrinters = computed(() => {
  let list = [...printers.value];
  if (filterSupportType.value !== 'all') {
    list = list.filter((p) => p.supportType === filterSupportType.value);
  }

  list.sort((a, b) => {
    if (sortKey.value === 'name') {
      return String(a.name).localeCompare(String(b.name), 'ja');
    }
    const field = sortKey.value === 'normal' ? 'normalDeadline' : 'directDeliveryDeadline';
    const da = a[field] || '9999-12-31';
    const db = b[field] || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return String(a.name).localeCompare(String(b.name), 'ja');
  });

  return list;
});

const countdownBadgeClass = (tone) => {
  if (tone === 'ended') return 'bg-gray-200 text-gray-600';
  if (tone === 'urgent') return 'bg-rose-600 text-white animate-pulse';
  if (tone === 'warning') return 'bg-amber-100 text-amber-900 border border-amber-300';
  return 'bg-teal-100 text-teal-900';
};
</script>

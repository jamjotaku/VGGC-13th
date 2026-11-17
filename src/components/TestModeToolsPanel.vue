<template>
  <div class="bg-gradient-to-br from-indigo-50 via-white to-sky-50 border-2 border-indigo-200 rounded-2xl p-3 shadow-xs space-y-2.5">
    <!-- ヘッダー（折りたたみ可能） -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black shrink-0">TEST PREVIEW</span>
        <span class="text-xs font-extrabold text-indigo-950 truncate">🧪 新機能テストパネル（通常版には非表示）</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button"
                @click="seedSampleItems"
                class="px-2 py-1 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-[10px] font-bold text-indigo-800 cursor-pointer transition"
                title="テスト用にサンプル5サークルをリストに追加します">
          ✨ サンプル5件投入
        </button>
        <button type="button"
                @click="isExpanded = !isExpanded"
                class="px-2 py-1 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-600 cursor-pointer">
          {{ isExpanded ? '▲ 閉じる' : '▼ 開く' }}
        </button>
      </div>
    </div>

    <!-- 巡回・購入進捗サマリー（常時1行表示） -->
    <div class="bg-white/90 border border-indigo-100 rounded-xl px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <div class="flex items-center gap-2 flex-wrap font-bold text-gray-700">
        <span>📋 残り: <strong class="text-pink-600 font-mono">{{ summary.remaining }}件</strong></span>
        <span>✅ 購入済: <strong class="text-emerald-700 font-mono">{{ summary.bought }}件</strong></span>
        <span v-if="summary.soldout > 0">💔 完売: <strong class="text-rose-600 font-mono">{{ summary.soldout }}件</strong></span>
        <span>💴 残予算目安: <strong class="text-indigo-700 font-mono">¥{{ summary.remainingPrice.toLocaleString() }}</strong></span>
      </div>
      <button type="button"
              @click="$emit('open-route-map')"
              :disabled="summary.remaining === 0"
              class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-[10px] font-extrabold cursor-pointer transition">
        🗺️ 巡回ルートで確認
      </button>
    </div>

    <div v-if="isExpanded" class="space-y-3 pt-1">
      <!-- 1. 複数買い物リスト切替 & 共有コード -->
      <div class="bg-white rounded-xl border border-indigo-100 p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="text-[11px] font-extrabold text-gray-800">🗂️ 複数リスト切替（自分用 / 代行用）</div>
          <div class="flex items-center gap-1">
            <button type="button"
                    @click="createNewSlot"
                    class="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold cursor-pointer">
              ＋ リスト追加
            </button>
            <button type="button"
                    @click="copyShareCode"
                    class="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold cursor-pointer">
              📤 共有コードコピー
            </button>
            <button type="button"
                    @click="showImportBox = !showImportBox"
                    class="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer">
              📥 コード取込
            </button>
          </div>
        </div>

        <!-- リストスロットタブ一覧 -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <div v-for="slot in listSlots" :key="slot.id"
               class="inline-flex items-center rounded-lg border text-[11px] overflow-hidden"
               :class="slot.id === activeSlotId ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-2xs' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'">
            <button type="button"
                    @click="switchSlot(slot.id)"
                    class="px-2.5 py-1 cursor-pointer flex items-center gap-1">
              <span>{{ slot.name }}</span>
              <span class="text-[10px] opacity-80 font-mono">({{ countSlotItems(slot.data) }})</span>
            </button>
            <button v-if="listSlots.length > 1"
                    type="button"
                    @click="deleteSlot(slot.id)"
                    class="px-1.5 py-1 hover:bg-black/15 text-[10px] cursor-pointer"
                    title="このリストを削除">
              ✕
            </button>
          </div>
        </div>

        <!-- 共有コードインポート入力 -->
        <div v-if="showImportBox" class="p-2 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
          <div class="text-[10px] font-bold text-amber-900">共有コード（VGGC_LIST_V1:...）を貼り付けて新規リストとして取り込みます：</div>
          <div class="flex gap-1.5">
            <input type="text"
                   v-model="importCodeInput"
                   placeholder="VGGC_LIST_V1:..."
                   class="flex-1 px-2 py-1 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 font-mono">
            <button type="button"
                    @click="importShareCode"
                    class="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold cursor-pointer shrink-0">
              取り込む
            </button>
          </div>
        </div>

        <div v-if="shareNotice" class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
          {{ shareNotice }}
        </div>
      </div>

      <!-- 2. オフライン画像プリフェッチ（事前キャッシュ） -->
      <div class="bg-white rounded-xl border border-indigo-100 p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div class="text-[11px] font-extrabold text-gray-800">📦 オフライン画像プリフェッチ（Wi-Fi事前取得）</div>
            <div class="text-[10px] text-gray-500">買い物リスト内のサークルカット・お品書き画像を端末キャッシュへ事前保存します（対象: {{ targetImageUrls.length }}枚）</div>
          </div>
          <button type="button"
                  @click="runImagePrefetch"
                  :disabled="prefetchState.running || targetImageUrls.length === 0"
                  class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 text-white text-[11px] font-extrabold cursor-pointer transition shrink-0">
            {{ prefetchState.running ? '取得中...' : '📥 一括キャッシュ実行' }}
          </button>
        </div>

        <div v-if="prefetchState.total > 0" class="space-y-1">
          <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div class="h-1.5 bg-sky-500 transition-all duration-200"
                 :style="{ width: Math.round((prefetchState.done / prefetchState.total) * 100) + '%' }"></div>
          </div>
          <div class="text-[10px] font-mono text-gray-700 flex items-center gap-2 flex-wrap">
            <span>進捗: {{ prefetchState.done }}/{{ prefetchState.total }}</span>
            <span class="text-emerald-700">新規: {{ prefetchState.fetched }}</span>
            <span class="text-sky-700">キャッシュ済: {{ prefetchState.cached }}</span>
            <span v-if="prefetchState.failed > 0" class="text-rose-600">失敗/スキップ: {{ prefetchState.failed }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { getTestStorageKey } from '../utils/testMode';

const MULTI_LIST_KEY = getTestStorageKey('multi_lists_v1');

const props = defineProps({
  savedList: { type: Object, default: () => ({}) },
  circles: { type: Array, default: () => [] },
  circleExtraInfo: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['replace-saved-list', 'open-route-map']);

const isExpanded = ref(true);
const listSlots = ref([
  { id: 'main', name: 'メイン（自分用）', data: {} }
]);
const activeSlotId = ref('main');
const showImportBox = ref(false);
const importCodeInput = ref('');
const shareNotice = ref('');

const prefetchState = ref({
  running: false,
  total: 0,
  done: 0,
  fetched: 0,
  cached: 0,
  failed: 0
});

const countSlotItems = (data) => {
  if (!data || typeof data !== 'object') return 0;
  return Object.keys(data).filter((k) => !k.startsWith('__')).length;
};

const summary = computed(() => {
  let remaining = 0;
  let bought = 0;
  let soldout = 0;
  let remainingPrice = 0;

  Object.entries(props.savedList || {}).forEach(([key, item]) => {
    if (key.startsWith('__') || !item || typeof item !== 'object') return;
    if (item.soldout) {
      soldout += 1;
    } else if (item.bought) {
      bought += 1;
    } else {
      remaining += 1;
      remainingPrice += Number(item.price) || 0;
    }
  });

  return { remaining, bought, soldout, remainingPrice };
});

const targetImageUrls = computed(() => {
  const urls = new Set();
  const circleMap = new Map((props.circles || []).map((c) => [c.circle_id, c]));

  Object.keys(props.savedList || {}).forEach((key) => {
    if (key.startsWith('__')) return;
    const circle = circleMap.get(key);
    const extra = props.circleExtraInfo?.[key];
    if (circle?.circlecut) urls.add(circle.circlecut);
    if (extra?.oshinagaki_url) urls.add(extra.oshinagaki_url);
  });

  return Array.from(urls);
});

const persistSlots = () => {
  try {
    localStorage.setItem(MULTI_LIST_KEY, JSON.stringify({
      activeId: activeSlotId.value,
      lists: listSlots.value
    }));
  } catch (e) {
    console.warn('Test multi-list save skipped:', e);
  }
};

onMounted(() => {
  try {
    const raw = localStorage.getItem(MULTI_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.lists) && parsed.lists.length > 0) {
        listSlots.value = parsed.lists;
        activeSlotId.value = parsed.activeId || parsed.lists[0].id;
        return;
      }
    }
  } catch (e) {}

  listSlots.value = [{
    id: 'main',
    name: 'メイン（自分用）',
    data: JSON.parse(JSON.stringify(props.savedList || {}))
  }];
  activeSlotId.value = 'main';
  persistSlots();
});

watch(() => props.savedList, (newVal) => {
  const active = listSlots.value.find((s) => s.id === activeSlotId.value);
  if (active) {
    active.data = JSON.parse(JSON.stringify(newVal || {}));
    persistSlots();
  }
}, { deep: true });

const switchSlot = (slotId) => {
  if (slotId === activeSlotId.value) return;
  const current = listSlots.value.find((s) => s.id === activeSlotId.value);
  if (current) {
    current.data = JSON.parse(JSON.stringify(props.savedList || {}));
  }
  const next = listSlots.value.find((s) => s.id === slotId);
  if (!next) return;
  activeSlotId.value = slotId;
  persistSlots();
  emit('replace-saved-list', JSON.parse(JSON.stringify(next.data || {})));
};

const createNewSlot = () => {
  const name = window.prompt('新しいリスト名を入力してください', `代行リスト${listSlots.value.length}`);
  if (!name || !name.trim()) return;
  const id = `slot_${Date.now()}`;
  listSlots.value.push({ id, name: name.trim(), data: {} });
  switchSlot(id);
};

const deleteSlot = (slotId) => {
  if (listSlots.value.length <= 1) return;
  const target = listSlots.value.find((s) => s.id === slotId);
  if (!target) return;
  if (!window.confirm(`「${target.name}」を削除しますか？`)) return;
  listSlots.value = listSlots.value.filter((s) => s.id !== slotId);
  if (activeSlotId.value === slotId) {
    activeSlotId.value = listSlots.value[0].id;
    emit('replace-saved-list', JSON.parse(JSON.stringify(listSlots.value[0].data || {})));
  }
  persistSlots();
};

const encodeShareCode = (payload) => {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `VGGC_LIST_V1:${btoa(bin)}`;
};

const decodeShareCode = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (trimmed.startsWith('VGGC_LIST_V1:')) {
    const b64 = trimmed.slice('VGGC_LIST_V1:'.length);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  return JSON.parse(trimmed);
};

const copyShareCode = async () => {
  const active = listSlots.value.find((s) => s.id === activeSlotId.value);
  const code = encodeShareCode({
    name: active?.name || '共有リスト',
    data: props.savedList || {}
  });
  try {
    await navigator.clipboard.writeText(code);
    shareNotice.value = `「${active?.name || 'リスト'}」の共有コードをコピーしました！（${countSlotItems(props.savedList)}件）`;
  } catch {
    window.prompt('以下の共有コードをコピーしてください', code);
  }
  setTimeout(() => { shareNotice.value = ''; }, 4000);
};

const importShareCode = () => {
  try {
    const parsed = decodeShareCode(importCodeInput.value);
    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!data || typeof data !== 'object') throw new Error('Invalid format');
    const name = parsed?.name ? `${parsed.name}(取込)` : `共有取込${listSlots.value.length}`;
    const id = `slot_${Date.now()}`;
    listSlots.value.push({ id, name, data });
    importCodeInput.value = '';
    showImportBox.value = false;
    switchSlot(id);
    shareNotice.value = `「${name}」を取り込みました！（${countSlotItems(data)}件）`;
    setTimeout(() => { shareNotice.value = ''; }, 4000);
  } catch {
    window.alert('共有コードの形式が正しくありません。VGGC_LIST_V1:... の形式で入力してください。');
  }
};

const seedSampleItems = () => {
  if (!props.circles || props.circles.length === 0) return;
  const picks = [0, 5, 14, 29, 45]
    .map((idx) => props.circles[idx % props.circles.length])
    .filter(Boolean);

  const next = { ...(props.savedList || {}) };
  const priorities = ['S', 'A', 'A', 'B', ''];
  picks.forEach((c, i) => {
    const items = props.circleExtraInfo?.[c.circle_id]?.items || [];
    const price = items[0]?.price ?? 1000;
    next[c.circle_id] = {
      priority: priorities[i],
      priorityOrder: i < 3 ? i + 1 : null,
      price,
      bought: i === 4,
      soldout: i === 2,
      memo: i === 0 ? 'テスト優先購入' : ''
    };
  });
  emit('replace-saved-list', next);
  shareNotice.value = `テスト用サンプル${picks.length}件をリストへ追加しました！`;
  setTimeout(() => { shareNotice.value = ''; }, 3000);
};

const runImagePrefetch = async () => {
  const urls = targetImageUrls.value;
  if (urls.length === 0 || prefetchState.value.running) return;

  prefetchState.value = {
    running: true,
    total: urls.length,
    done: 0,
    fetched: 0,
    cached: 0,
    failed: 0
  };

  let cache = null;
  try {
    if (typeof caches !== 'undefined') {
      cache = await caches.open('vggc-remote-images');
    }
  } catch (e) {}

  for (const url of urls) {
    try {
      if (cache) {
        const hit = await cache.match(url);
        if (hit) {
          prefetchState.value.cached += 1;
          prefetchState.value.done += 1;
          continue;
        }
      }
      const res = await fetch(url, { mode: 'cors' });
      if (res && res.ok) {
        if (cache) await cache.put(url, res.clone());
        prefetchState.value.fetched += 1;
      } else {
        prefetchState.value.failed += 1;
      }
    } catch {
      prefetchState.value.failed += 1;
    } finally {
      prefetchState.value.done += 1;
    }
  }

  prefetchState.value.running = false;
};
</script>

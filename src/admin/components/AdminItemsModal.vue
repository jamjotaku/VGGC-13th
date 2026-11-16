<template>
  <div v-if="circle"
       class="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
       @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
      <!-- ヘッダー -->
      <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <span class="px-2.5 py-1 bg-blue-600 text-white font-mono font-black text-xs rounded-lg">
            {{ circle.space_sym }}-{{ circle.space_num }}
          </span>
          <div class="min-w-0">
            <h3 class="font-extrabold text-sm sm:text-base truncate">{{ circle.circle_name }}</h3>
            <p class="text-[11px] text-slate-400">左のお品書きを見ながら右で商品・価格を登録</p>
          </div>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer">
          ✕
        </button>
      </div>

      <!-- 本体 (2カラム) -->
      <div class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
        <!-- 左: お品書きライブプレビュー -->
        <div class="lg:col-span-6 bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col overflow-hidden max-h-[40vh] lg:max-h-full">
          <div class="p-3 bg-white border-b border-slate-200 space-y-2 shrink-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-extrabold text-slate-700">🖼️ お品書きプレビュー</span>
              <div v-if="oshinagakiList.length > 1" class="flex gap-1">
                <button v-for="item in oshinagakiList" :key="item.index"
                        @click="activeIndex = item.index"
                        class="px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer"
                        :class="activeIndex === item.index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'">
                  {{ item.label }}
                </button>
              </div>
            </div>
            <input type="text"
                   :value="oshinagakiUrl"
                   @input="$emit('update:oshinagakiUrl', $event.target.value)"
                   placeholder="お品書きURL (Xポスト / Pixiv / 複数改行可)"
                   class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="flex-1 overflow-y-auto p-3 flex flex-col items-center justify-start">
            <div v-if="!activeOshinagaki" class="text-center text-slate-400 text-xs py-12">
              お品書きURLが未登録です
            </div>
            <div v-else-if="activeOshinagaki.type === 'pixiv'" class="w-full flex flex-col items-center gap-2">
              <img :src="`https://embed.pixiv.net/decorate.php?illust_id=${activeOshinagaki.id}`"
                   class="max-w-full rounded-xl shadow border border-slate-200 bg-white"
                   alt="Pixivお品書き">
              <a :href="activeOshinagaki.url" target="_blank" class="text-xs text-blue-600 hover:underline font-bold">Pixivで開く ↗</a>
            </div>
            <div v-else-if="activeOshinagaki.type === 'x'" class="w-full flex flex-col items-center gap-2">
              <div ref="tweetPreviewRef" class="w-full flex justify-center"></div>
              <a :href="activeOshinagaki.url" target="_blank" class="text-xs text-blue-600 hover:underline font-bold">Xポストを開く ↗</a>
            </div>
            <div v-else class="text-center py-8 space-y-2">
              <a :href="activeOshinagaki.url" target="_blank" class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl inline-block">
                外部リンクを開く ↗
              </a>
            </div>
          </div>
        </div>

        <!-- 右: 商品・価格入力 -->
        <div class="lg:col-span-6 flex flex-col overflow-hidden bg-white">
          <div class="p-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div class="flex bg-slate-100 p-0.5 rounded-lg">
              <button @click="inputMode = 'list'"
                      class="px-3 py-1 text-xs font-extrabold rounded-md cursor-pointer"
                      :class="inputMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'">
                行入力 ({{ tempItems.length }})
              </button>
              <button @click="inputMode = 'bulk'"
                      class="px-3 py-1 text-xs font-extrabold rounded-md cursor-pointer"
                      :class="inputMode === 'bulk' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'">
                一括テキスト
              </button>
            </div>
            <button v-if="inputMode === 'list'" @click="addRow" class="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-extrabold cursor-pointer">
              ＋ 行を追加
            </button>
          </div>

          <!-- プリセット -->
          <div v-if="inputMode === 'list'" class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto shrink-0">
            <button v-for="p in quickItemPresets" :key="p.name"
                    @click="addPreset(p)"
                    class="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer">
              + {{ p.name }} (¥{{ p.price }})
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            <template v-if="inputMode === 'list'">
              <div v-for="(item, idx) in tempItems" :key="idx" class="flex items-center gap-2">
                <input type="text" v-model="item.name" placeholder="商品名（例: 新刊セット）"
                       class="flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                <div class="flex items-center border border-slate-300 rounded-xl bg-white px-2 w-28">
                  <span class="text-xs text-slate-400 font-bold">¥</span>
                  <input type="number" v-model.number="item.price" min="0" step="100"
                         class="w-full py-2 text-xs font-mono font-bold text-right outline-none">
                </div>
                <button @click="tempItems.splice(idx, 1)" class="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">🗑️</button>
              </div>
              <div v-if="tempItems.length === 0" class="text-center py-8 text-xs text-slate-400">
                上のプリセットまたは「＋ 行を追加」から商品を登録できます
              </div>
            </template>

            <template v-else>
              <p class="text-[11px] text-slate-500">1行に1商品「商品名 価格」の形式で貼り付けて「変換して反映」を押してください。</p>
              <textarea v-model="bulkText" rows="10"
                        placeholder="新刊セット 1500&#10;アクリルスタンド ¥1,200&#10;既刊 500"
                        class="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              <button @click="applyBulkText" class="px-4 py-2 bg-slate-800 text-white text-xs font-extrabold rounded-xl cursor-pointer">
                変換して行リストへ反映
              </button>
            </template>
          </div>

          <!-- フッター -->
          <div class="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            <button @click="$emit('close')" class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer">
              キャンセル
            </button>
            <button @click="saveAndClose" :disabled="isSaving" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs cursor-pointer">
              {{ isSaving ? '保存中...' : '💾 商品メニューを保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import {
  parseOshinagakiUrls,
  parseOshinagakiUrlType,
  quickItemPresets,
  parseBulkItemsText
} from '../utils/adminHelpers';

const props = defineProps({
  circle: { type: Object, default: null },
  oshinagakiUrl: { type: String, default: '' },
  initialItems: { type: Array, default: () => [] },
  isSaving: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'update:oshinagakiUrl', 'save']);

const inputMode = ref('list');
const tempItems = ref([]);
const bulkText = ref('');
const activeIndex = ref(0);
const tweetPreviewRef = ref(null);

const oshinagakiList = computed(() => {
  const urls = parseOshinagakiUrls(props.oshinagakiUrl);
  return urls.map((u, idx) => {
    const parsed = parseOshinagakiUrlType(u);
    return {
      index: idx,
      url: u,
      type: parsed.type,
      id: parsed.id,
      label: urls.length > 1 ? `お品書き ${idx + 1}` : 'お品書き'
    };
  });
});

const activeOshinagaki = computed(() => {
  if (oshinagakiList.value.length === 0) return null;
  return oshinagakiList.value[activeIndex.value] || oshinagakiList.value[0];
});

const renderTweet = async () => {
  await nextTick();
  if (!tweetPreviewRef.value || activeOshinagaki.value?.type !== 'x') return;
  tweetPreviewRef.value.innerHTML = '';
  if (window.twttr?.widgets?.createTweet) {
    window.twttr.widgets.createTweet(activeOshinagaki.value.id, tweetPreviewRef.value, { lang: 'ja', align: 'center' });
  }
};

watch(() => props.circle, (c) => {
  if (c) {
    tempItems.value = (props.initialItems || []).map(it => ({ name: it.name || '', price: Number(it.price) || 0 }));
    if (tempItems.value.length === 0) tempItems.value.push({ name: '', price: 0 });
    inputMode.value = 'list';
    activeIndex.value = 0;
    renderTweet();
  }
}, { immediate: true });

watch(activeOshinagaki, () => {
  renderTweet();
});

const addRow = () => tempItems.value.push({ name: '', price: 0 });

const addPreset = (preset) => {
  const last = tempItems.value[tempItems.value.length - 1];
  if (last && !last.name.trim() && !last.price) {
    last.name = preset.name;
    last.price = preset.price;
  } else {
    tempItems.value.push({ name: preset.name, price: preset.price });
  }
};

const applyBulkText = () => {
  const parsed = parseBulkItemsText(bulkText.value);
  if (parsed.length > 0) {
    tempItems.value = parsed;
    inputMode.value = 'list';
  }
};

const saveAndClose = () => {
  const cleaned = tempItems.value
    .filter(it => String(it.name || '').trim())
    .map(it => ({ name: String(it.name).trim(), price: Number(it.price) || 0 }));
  emit('save', cleaned);
};
</script>

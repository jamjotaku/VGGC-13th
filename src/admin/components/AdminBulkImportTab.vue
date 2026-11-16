<template>
  <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
    <div>
      <h2 class="text-base font-black text-slate-900">📥 お品書き・サークル情報 一括インポート</h2>
      <p class="text-xs text-slate-500 mt-1">
        CSV / JSON 形式でまとめたサークル情報（`circle_id` または `space` 例: `M-15-16`）を貼り付けてプレビュー・一括反映できます。
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold text-slate-700">インポートデータ（JSON配列 または カンマ区切りCSV）</span>
          <button @click="loadSample" class="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">サンプル形式を挿入</button>
        </div>
        <textarea v-model="rawInput" rows="10"
                  placeholder="space,twitter_id,oshinagaki_url,members,tags&#10;M-15-16,@Jamj__Otaku,https://x.com/...,花芽すみれ,新刊"
                  class="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        <button @click="parseInput" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold rounded-xl cursor-pointer">
          🔍 解析してプレビュー
        </button>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold text-slate-700">プレビュー ({{ matchedRows.length }}件マッチ)</span>
          <button v-if="matchedRows.length > 0"
                  @click="applyImport"
                  class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl cursor-pointer">
            ✅ 編集データへ反映（未保存キューに追加）
          </button>
        </div>

        <div v-if="parseError" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
          ⚠️ {{ parseError }}
        </div>

        <div class="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div v-for="row in matchedRows" :key="row.circle_id" class="p-2.5 text-xs space-y-0.5">
            <div class="font-extrabold text-slate-900">
              <span class="font-mono text-blue-700 mr-1">[{{ row.spaceLabel }}]</span>
              {{ row.circle_name }}
            </div>
            <div class="text-[11px] text-slate-600 truncate">
              X: {{ row.twitterId || '-' }} / URL: {{ row.url || '-' }}
            </div>
          </div>
          <div v-if="matchedRows.length === 0" class="p-6 text-center text-xs text-slate-400">
            左の入力欄にデータを貼り付けて「解析してプレビュー」を押してください
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  circles: { type: Array, default: () => [] }
});

const emit = defineEmits(['apply-import']);

const rawInput = ref('');
const matchedRows = ref([]);
const parseError = ref('');

const loadSample = () => {
  rawInput.value = JSON.stringify([
    {
      space: 'M-15-16',
      twitter_id: '@Jamj__Otaku',
      oshinagaki_url: 'https://x.com/Jamj__Otaku/status/123456',
      members: ['オールキャラ'],
      tags: ['新刊', 'グッズセット']
    }
  ], null, 2);
};

const parseInput = () => {
  parseError.value = '';
  matchedRows.value = [];
  const text = rawInput.value.trim();
  if (!text) return;

  let records = [];
  try {
    if (text.startsWith('[') || text.startsWith('{')) {
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSVはヘッダー行＋データ行の2行以上が必要です。');
      const headers = lines[0].split(',').map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
        records.push(obj);
      }
    }

    const results = [];
    for (const r of records) {
      const target = props.circles.find(c =>
        (r.circle_id && c.circle_id === r.circle_id) ||
        (r.space && `${c.space_sym}-${c.space_num}`.toLowerCase() === String(r.space).trim().toLowerCase())
      );
      if (!target) continue;
      results.push({
        circle_id: target.circle_id,
        circle_name: target.circle_name,
        spaceLabel: `${target.space_sym}-${target.space_num}`,
        twitterId: r.twitter_id || '',
        staffTwitter: r.staff_twitter || '',
        url: r.oshinagaki_url || r.url || '',
        membersInput: Array.isArray(r.members) ? r.members.join(', ') : (r.members || ''),
        tagsInput: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || ''),
        items: Array.isArray(r.items) ? r.items : undefined
      });
    }
    matchedRows.value = results;
    if (results.length === 0) {
      parseError.value = 'circle_id または space (例: M-15-16) に一致するサークルが見つかりませんでした。';
    }
  } catch (e) {
    parseError.value = e.message || 'データ形式の解析に失敗しました。';
  }
};

const applyImport = () => {
  emit('apply-import', matchedRows.value);
  matchedRows.value = [];
  rawInput.value = '';
};
</script>

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
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span class="text-xs font-extrabold text-slate-700">
            プレビュー ({{ matchedRows.length }}件マッチ<template v-if="unmatchedRows.length > 0"> / 未マッチ {{ unmatchedRows.length }}件</template>)
          </span>
          <button v-if="matchedRows.length > 0"
                  @click="applyImport"
                  class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl cursor-pointer">
            ✅ 編集データへ反映（未保存キューに追加）
          </button>
        </div>

        <div v-if="parseError" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
          ⚠️ {{ parseError }}
        </div>

        <!-- 未マッチレコード一覧（件数と space / circle_id） -->
        <div v-if="unmatchedRows.length > 0" class="p-3 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1.5 text-xs">
          <div class="font-extrabold text-rose-900">
            ⚠️ サークル未マッチ ({{ unmatchedRows.length }}件):
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="u in unmatchedRows" :key="u.key"
                  class="px-2 py-0.5 rounded bg-white border border-rose-300 text-rose-800 font-mono text-[11px] font-bold">
              {{ u.label }}
            </span>
          </div>
        </div>

        <!-- 未マッチレコードの統制語彙チェック警告（別枠表示） -->
        <div v-if="unmatchedVocabWarnings.length > 0" class="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-[11px] text-amber-950">
          <div class="font-extrabold">
            ⚠️ 未マッチ分の統制語彙チェック警告 ({{ unmatchedVocabWarnings.length }}件):
          </div>
          <div v-for="(uw, uwIdx) in unmatchedVocabWarnings" :key="uwIdx">
            ・<span class="font-mono font-bold">[{{ uw.recordLabel }}]</span> {{ uw.message }}
          </div>
        </div>

        <div class="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div v-for="row in matchedRows" :key="row.circle_id" class="p-2.5 text-xs space-y-1">
            <div class="flex items-start gap-2.5">
              <img v-if="row.cutImageUrl"
                   :src="row.cutImageUrl"
                   alt="カット"
                   class="w-11 h-14 object-cover rounded border border-slate-200 bg-slate-100 shrink-0" />
              <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-extrabold text-slate-900 truncate">
                    <span class="font-mono text-blue-700 mr-1">[{{ row.spaceLabel }}]</span>
                    {{ row.circle_name }}
                  </div>
                  <span v-if="row.items?.length" class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] shrink-0">
                    品目 {{ row.items.length }}件
                  </span>
                </div>
                <div class="text-[11px] text-slate-600 truncate">
                  X: {{ row.twitterId || '-' }} / URL: {{ row.url || '-' }}
                </div>
                <div v-if="row.membersInput || row.tagsInput" class="text-[11px] text-slate-700">
                  <span v-if="row.membersInput" class="mr-2">👤 {{ row.membersInput }}</span>
                  <span v-if="row.tagsInput">🏷️ {{ row.tagsInput }}</span>
                </div>
              </div>
            </div>
            <div v-if="row.warnings?.length" class="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
              <div class="font-extrabold">⚠️ 統制語彙チェック警告 ({{ row.warnings.length }}件):</div>
              <div v-for="(w, wIdx) in row.warnings" :key="wIdx">・{{ w }}</div>
            </div>
          </div>
          <div v-if="matchedRows.length === 0 && unmatchedRows.length === 0" class="p-6 text-center text-xs text-slate-400">
            左の入力欄にデータを貼り付けて「解析してプレビュー」を押してください
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { vspoDict } from '../../constants';
import {
  normalizeItemRecord,
  aggregateCircleTagsFromItems,
  validateItemsVocabulary
} from '../../utils/itemTags';

const props = defineProps({
  circles: { type: Array, default: () => [] }
});

const emit = defineEmits(['apply-import']);

const rawInput = ref('');
const matchedRows = ref([]);
const unmatchedRows = ref([]);
const unmatchedVocabWarnings = ref([]);
const parseError = ref('');
const validCharacterNames = vspoDict.map((m) => m.name);

const loadSample = () => {
  rawInput.value = JSON.stringify([
    {
      space: 'H-31',
      twitter_id: '@PqsU23',
      oshinagaki_url: 'https://x.com/PqsU23/status/2117524168648675761',
      items: [
        {
          name: 'BIGアクリルスタンド＆チェキ風箔カードset',
          price: 2000,
          note: 'BIGアクリルスタンド（約18cm）とチェキ風箔カードのセット',
          characters: ['夜乃くろむ'],
          units: [],
          goods_types: ['アクリルスタンド', 'カード'],
          attributes: ['セット']
        }
      ]
    }
  ], null, 2);
};

const parseInput = () => {
  parseError.value = '';
  matchedRows.value = [];
  unmatchedRows.value = [];
  unmatchedVocabWarnings.value = [];
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
    const unmatched = [];
    const unmatchedWarnings = [];

    records.forEach((r, idx) => {
      const recordLabel = r.space
        ? String(r.space).trim()
        : (r.circle_id ? String(r.circle_id).trim() : `行#${idx + 1}`);

      // マッチの成否にかかわらず全レコードの items に統制語彙チェックを先行実行
      const normalizedItems = Array.isArray(r.items) ? r.items.map(normalizeItemRecord) : undefined;
      const warnings = normalizedItems
        ? validateItemsVocabulary(normalizedItems, validCharacterNames)
        : [];

      const target = props.circles.find(c =>
        (r.circle_id && c.circle_id === r.circle_id) ||
        (r.space && `${c.space_sym}-${c.space_num}`.toLowerCase() === String(r.space).trim().toLowerCase())
      );

      if (!target) {
        unmatched.push({
          key: `unmatched_${idx}_${recordLabel}`,
          label: recordLabel,
          space: r.space || '',
          circleId: r.circle_id || ''
        });
        warnings.forEach((msg) => {
          unmatchedWarnings.push({ recordLabel, message: msg });
        });
        return;
      }

      const aggregated = normalizedItems
        ? aggregateCircleTagsFromItems(normalizedItems)
        : { members: [], tags: [] };

      const explicitMembers = Array.isArray(r.members) ? r.members : (r.members ? String(r.members).split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
      const explicitTags = Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
      const mergedMembers = Array.from(new Set([...aggregated.members, ...explicitMembers]));
      const mergedTags = Array.from(new Set([...aggregated.tags, ...explicitTags]));

      results.push({
        circle_id: target.circle_id,
        circle_name: target.circle_name,
        spaceLabel: `${target.space_sym}-${target.space_num}`,
        twitterId: r.twitter_id || '',
        staffTwitter: r.staff_twitter || '',
        url: r.oshinagaki_url || r.url || '',
        cutImageUrl: r.cut_image_url || r.circlecut || '',
        membersInput: mergedMembers.join(', '),
        tagsInput: mergedTags.join(', '),
        items: normalizedItems,
        warnings
      });
    });

    matchedRows.value = results;
    unmatchedRows.value = unmatched;
    unmatchedVocabWarnings.value = unmatchedWarnings;
    if (results.length === 0 && unmatched.length === 0) {
      parseError.value = '解析できるレコードが見つかりませんでした。';
    } else if (results.length === 0 && unmatched.length > 0) {
      parseError.value = `全${unmatched.length}件とも circle_id または space に一致するサークルが見つかりませんでした。`;
    }
  } catch (e) {
    parseError.value = e.message || 'データ形式の解析に失敗しました。';
  }
};

const applyImport = () => {
  emit('apply-import', matchedRows.value);
  matchedRows.value = [];
  unmatchedRows.value = [];
  unmatchedVocabWarnings.value = [];
  rawInput.value = '';
};
</script>

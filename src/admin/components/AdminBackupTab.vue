<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- エクスポート -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <h2 class="text-base font-black text-slate-900">💾 全件バックアップをエクスポート</h2>
      <p class="text-xs text-slate-500 leading-relaxed">
        現在の全サークル情報（Xアカウント、お品書きURL、商品メニュー、メンバー・タグ設定、欠席フラグ）を JSON ファイルとして保存します。
      </p>
      <button @click="$emit('export-json')"
              class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl cursor-pointer transition">
        📥 JSON バックアップをダウンロード
      </button>
    </div>

    <!-- インポート（復元） -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <h2 class="text-base font-black text-slate-900">♻️ バックアップ JSON から復元</h2>
      <p class="text-xs text-slate-500 leading-relaxed">
        エクスポートした JSON バックアップを選択すると、内容を確認して編集データへ復元できます。
      </p>
      <input type="file" accept=".json" @change="onFileChange" class="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
      <div v-if="previewCount > 0" class="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-blue-900">{{ previewCount }}件のデータを読み込みました</span>
        <button @click="executeRestore" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-extrabold rounded-lg cursor-pointer">
          編集データへ適用
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['export-json', 'restore-json', 'toast']);

const previewCount = ref(0);
const parsedBackup = ref(null);

const onFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json) ? json : (Array.isArray(json.circle_info) ? json.circle_info : []);
    parsedBackup.value = rows;
    previewCount.value = rows.length;
  } catch (err) {
    emit('toast', 'JSONファイルの読み込みに失敗しました', 'error');
  }
};

const executeRestore = () => {
  if (!parsedBackup.value) return;
  emit('restore-json', parsedBackup.value);
  parsedBackup.value = null;
  previewCount.value = 0;
};
</script>

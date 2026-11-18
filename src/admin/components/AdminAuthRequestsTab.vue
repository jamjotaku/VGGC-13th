<template>
  <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-base font-black text-slate-900 flex items-center gap-2">
          <span>🔐 サークル個別認証申請（鍵垢・フォールバック受け皿）</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">未対応 {{ pendingCount }}件</span>
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          アプリ内から送信された個別申請を確認し、「直接オーナー付与」または「VO-コード発行」で承認できます。
        </p>
      </div>
      <button @click="$emit('refresh')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer">
        🔄 再読込
      </button>
    </div>

    <!-- 検索＆状態フィルタ -->
    <div class="flex flex-col sm:flex-row gap-2">
      <input type="text"
             v-model="searchQuery"
             placeholder="受付番号 (REQ-...) / @Xアカウント / サークル名で検索"
             class="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400">
      <select v-model="statusFilter"
              class="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer">
        <option value="all">すべて ({{ requests.length }})</option>
        <option value="pending">未対応 ({{ pendingCount }})</option>
        <option value="approved">承認済</option>
        <option value="rejected">却下</option>
      </select>
    </div>

    <div v-if="filteredRequests.length === 0" class="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
      {{ requests.length === 0 ? '現在、個別認証申請はありません。' : '検索条件に一致する申請はありません。' }}
    </div>

    <div v-else class="space-y-2.5">
      <div v-for="req in filteredRequests" :key="req.id"
           class="rounded-xl border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
           :class="req.status === 'pending' ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-slate-50/50 opacity-75'">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-black font-mono"
                  :class="req.status === 'pending' ? 'bg-rose-100 text-rose-800' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'">
              {{ req.status === 'pending' ? '未対応' : req.status === 'approved' ? '承認済' : '却下' }}
            </span>
            <span class="font-mono font-black text-xs text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">{{ req.request_code }}</span>
            <span class="font-extrabold text-xs text-blue-800">{{ getCircleLabel(req.circle_id) }}</span>
            <a :href="`https://x.com/${String(req.x_handle || '').replace(/^@/, '')}`"
               target="_blank"
               rel="noopener noreferrer"
               class="font-mono text-xs text-slate-700 hover:text-blue-600 underline font-bold">
              @{{ String(req.x_handle || '').replace(/^@/, '') }} ↗
            </a>
          </div>
          <div v-if="req.note" class="text-xs text-slate-600">メモ: {{ req.note }}</div>
          <div v-if="req.issued_code" class="text-xs font-mono font-black text-indigo-700">発行済コード: {{ req.issued_code }}</div>
        </div>

        <div v-if="req.status === 'pending'" class="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button @click="$emit('resolve', req.id, 'approve_direct')"
                  class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer">
            ✅ 直接オーナー付与
          </button>
          <button @click="$emit('resolve', req.id, 'approve_code')"
                  class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer">
            🎟️ VO-コード発行
          </button>
          <button @click="$emit('resolve', req.id, 'reject')"
                  class="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer">
            ✕ 却下
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  requests: { type: Array, default: () => [] },
  circles: { type: Array, default: () => [] }
});

defineEmits(['refresh', 'resolve']);

const searchQuery = ref('');
const statusFilter = ref('all');

const pendingCount = computed(() => props.requests.filter(r => r.status === 'pending').length);

const getCircleLabel = (cid) => {
  const c = props.circles.find(item => item.circle_id === cid);
  return c ? `${c.space_sym}-${c.space_num} ${c.circle_name}` : cid;
};

const filteredRequests = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return props.requests.filter((req) => {
    if (statusFilter.value !== 'all' && req.status !== statusFilter.value) {
      return false;
    }
    if (!q) return true;
    const circleLabel = getCircleLabel(req.circle_id).toLowerCase();
    return (
      String(req.request_code || '').toLowerCase().includes(q) ||
      String(req.x_handle || '').toLowerCase().includes(q) ||
      String(req.note || '').toLowerCase().includes(q) ||
      circleLabel.includes(q)
    );
  });
});
</script>

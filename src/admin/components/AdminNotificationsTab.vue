<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- 左: 新規お知らせ投稿 -->
    <div class="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <h2 class="text-base font-black text-slate-900">📢 お知らせを配信</h2>
      <div class="space-y-2.5 text-xs">
        <div>
          <label class="font-bold text-slate-600 block mb-1">タイトル</label>
          <input type="text" v-model="form.title" placeholder="例: お品書き一括登録を更新しました"
                 class="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="font-bold text-slate-600 block mb-1">種別</label>
          <select v-model="form.type" class="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold">
            <option value="info">お知らせ (info)</option>
            <option value="update">アップデート (update)</option>
            <option value="warning">注意 (warning)</option>
            <option value="urgent">緊急バナー表示 (urgent)</option>
          </select>
        </div>
        <div>
          <label class="font-bold text-slate-600 block mb-1">本文</label>
          <textarea v-model="form.content" rows="4" placeholder="参加者へのお知らせ内容を入力..."
                    class="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <label class="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
          <input type="checkbox" v-model="form.is_pinned" class="w-4 h-4 accent-blue-600">
          <span>上部固定（ピン留め）にする</span>
        </label>
        <button @click="createNotification"
                :disabled="isSubmitting || !form.title.trim() || !form.content.trim()"
                class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold cursor-pointer transition">
          {{ isSubmitting ? '配信中...' : '📢 お知らせを投稿する' }}
        </button>
      </div>
    </div>

    <!-- 右: 配信済み一覧 -->
    <div class="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-black text-slate-800">配信済みお知らせ一覧 ({{ notifications.length }}件)</h3>
        <button @click="fetchNotifications" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer">
          🔄 再読込
        </button>
      </div>

      <div class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        <div v-for="n in notifications" :key="n.id" class="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span v-if="n.is_pinned" class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">📌 固定</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-black uppercase"
                    :class="n.type === 'urgent' ? 'bg-rose-600 text-white' : 'bg-blue-100 text-blue-800'">
                {{ n.type }}
              </span>
              <span class="font-extrabold text-xs text-slate-900">{{ n.title }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="togglePin(n)" class="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg font-bold cursor-pointer">
                {{ n.is_pinned ? '固定解除' : 'ピン留め' }}
              </button>
              <button @click="deleteNotification(n.id)" class="px-2 py-1 text-[11px] bg-white border border-rose-200 text-rose-600 rounded-lg font-bold cursor-pointer">
                削除
              </button>
            </div>
          </div>
          <p class="text-xs text-slate-600 whitespace-pre-line">{{ n.content }}</p>
        </div>
        <div v-if="notifications.length === 0" class="text-center py-8 text-xs text-slate-400">
          配信済みのお知らせはありません
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabaseClient } from '../../supabase';

const emit = defineEmits(['toast']);

const notifications = ref([]);
const isSubmitting = ref(false);
const form = ref({ title: '', content: '', type: 'info', is_pinned: false });

const fetchNotifications = async () => {
  const { data, error } = await supabaseClient
    .from('notifications')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (!error && Array.isArray(data)) {
    notifications.value = data;
  }
};

const createNotification = async () => {
  isSubmitting.value = true;
  try {
    const { error } = await supabaseClient.from('notifications').insert({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      type: form.value.type,
      is_pinned: form.value.is_pinned
    });
    if (error) throw error;
    form.value = { title: '', content: '', type: 'info', is_pinned: false };
    emit('toast', 'お知らせを配信しました！', 'success');
    await fetchNotifications();
  } catch (err) {
    emit('toast', err.message || '配信に失敗しました', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const togglePin = async (n) => {
  const { error } = await supabaseClient
    .from('notifications')
    .update({ is_pinned: !n.is_pinned })
    .eq('id', n.id);
  if (!error) await fetchNotifications();
};

const deleteNotification = async (id) => {
  if (!window.confirm('このお知らせを削除しますか？')) return;
  const { error } = await supabaseClient.from('notifications').delete().eq('id', id);
  if (!error) {
    emit('toast', 'お知らせを削除しました', 'info');
    await fetchNotifications();
  }
};

onMounted(fetchNotifications);
</script>

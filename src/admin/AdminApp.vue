<template>
  <div class="max-w-[1600px] mx-auto bg-white sm:my-4 sm:rounded-2xl shadow-xl overflow-hidden border border-slate-200 min-h-screen sm:min-h-[calc(100vh-2rem)] flex flex-col">

    <!-- ヘッダー（BGM・ショートカット・本編リンクなしのクリーン構成） -->
    <header class="bg-slate-900 text-white px-4 py-3.5 sm:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div class="flex items-center gap-2.5 flex-wrap">
        <span class="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
          <span>🛡️ {{ EVENT_CONFIG.name }}</span>
          <span class="text-[11px] font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
        </span>
        <a v-if="adminProfile && adminProfile.x_handle"
           :href="'https://x.com/' + adminProfile.x_handle"
           target="_blank"
           rel="noopener noreferrer"
           class="text-xs bg-black text-white border border-slate-700 px-2.5 py-0.5 rounded-md font-mono font-bold hover:bg-slate-800 transition">
          𝕏 @{{ adminProfile.x_handle }}
        </a>
        <span v-if="unsavedSet.size > 0" class="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-md font-bold animate-pulse">
          ● 未保存: {{ unsavedSet.size }}件
        </span>
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
        <button v-if="user && unsavedSet.size > 0"
                @click="saveAllDirty"
                :disabled="isBulkSaving"
                class="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3.5 py-1.5 rounded-xl shadow cursor-pointer transition flex items-center gap-1.5">
          <span>{{ isBulkSaving ? '保存中...' : `💾 一括保存 (${unsavedSet.size}件)` }}</span>
        </button>

        <div v-if="user" class="flex items-center gap-2">
          <span class="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            {{ user.email?.split('@')[0] }}
          </span>
          <button @click="signOut" class="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer transition">
            ログアウト
          </button>
        </div>
      </div>
    </header>

    <!-- 未ログイン時: ログインフォーム -->
    <div v-if="!user" class="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5">
        <div class="text-center space-y-1">
          <div class="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl mx-auto shadow">🔐</div>
          <h2 class="text-lg font-extrabold text-slate-900">管理者ログイン</h2>
          <p class="text-xs text-slate-500">許可された管理者アカウント（Jamj__Otaku 等）でログインしてください</p>
        </div>

        <div v-if="authError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
          ⚠️ {{ authError }}
        </div>

        <form @submit.prevent="handleAuth" class="space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">管理者 ID</label>
            <input type="text" v-model="authId" required placeholder="Jamj__Otaku"
                   class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">パスワード</label>
            <input type="password" v-model="authPassword" required placeholder="6文字以上"
                   class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <button type="submit" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-sm cursor-pointer transition">
            ログインして管理画面を開く
          </button>
        </form>
      </div>
    </div>

    <!-- ログイン済みメインエリア -->
    <template v-else>
      <!-- タブナビゲーション -->
      <nav class="bg-slate-50 border-b border-slate-200 px-3 sm:px-6 flex gap-1 overflow-x-auto shrink-0">
        <button v-for="tab in adminTabs" :key="tab.id"
                @click="activeTab = tab.id"
                class="px-4 py-3 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                :class="activeTab === tab.id ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'">
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span v-if="tab.id === 'auth_requests' && pendingAuthRequestsCount > 0"
                class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white">
            {{ pendingAuthRequestsCount }}
          </span>
        </button>
      </nav>

      <main class="flex-1 p-3 sm:p-5 md:p-6 bg-slate-50/50 space-y-4">
        <div v-if="loading" class="text-center py-20 text-slate-500 font-bold space-y-3">
          <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-sm">サークルデータ & Supabase情報を読み込み中...</p>
        </div>

        <template v-else>
          <!-- タブ1: サークル編集 -->
          <div v-show="activeTab === 'circles'" class="space-y-4">
            <!-- 統計カード -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                <div class="text-[11px] font-bold text-slate-500">全サークル数</div>
                <div class="text-xl font-black text-slate-900 mt-0.5">{{ circles.length }}</div>
              </div>
              <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 shadow-2xs">
                <div class="text-[11px] font-bold text-emerald-800">📸 お品書きURL登録</div>
                <div class="text-xl font-black text-emerald-950 mt-0.5">{{ countHasUrl }} <span class="text-xs font-normal">/ {{ circles.length }}</span></div>
              </div>
              <div class="bg-sky-50/70 border border-sky-200 rounded-xl p-3 shadow-2xs">
                <div class="text-[11px] font-bold text-sky-800">𝕏 サークル主X登録</div>
                <div class="text-xl font-black text-sky-950 mt-0.5">{{ countHasAuthorTwitter }} <span class="text-xs font-normal">/ {{ circles.length }}</span></div>
              </div>
              <div class="bg-violet-50/70 border border-violet-200 rounded-xl p-3 shadow-2xs">
                <div class="text-[11px] font-bold text-violet-800">🛍️ 商品メニュー登録</div>
                <div class="text-xl font-black text-violet-950 mt-0.5">{{ circlesWithItemsCount }} <span class="text-xs font-normal">/ {{ circles.length }}</span></div>
              </div>
            </div>

            <!-- 検索・ブロック・フィルターバー -->
            <div class="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
              <div class="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                <input type="text" v-model="searchQuery" placeholder="スペース (M-15)、サークル名、ペンネーム、X IDで検索..."
                       class="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                <div class="flex items-center gap-2 flex-wrap">
                  <button v-for="f in filterOptions" :key="f.id"
                          @click="activeFilter = f.id"
                          class="px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer"
                          :class="activeFilter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'">
                    {{ f.label }}
                  </button>
                </div>
              </div>

              <!-- ブロック別タブ -->
              <div class="flex gap-1.5 overflow-x-auto pb-1">
                <button @click="selectedBlock = ''"
                        class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
                        :class="!selectedBlock ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
                  全ブロック ({{ filteredCircles.length }})
                </button>
                <button v-for="b in availableBlocks" :key="'blk_' + b"
                        @click="selectedBlock = selectedBlock === b ? '' : b"
                        class="px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer"
                        :class="selectedBlock === b ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'">
                  {{ b }}
                </button>
              </div>
            </div>

            <!-- サークル一覧 (2カラムグリッド) -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div v-for="c in filteredCircles" :key="c.circle_id"
                   class="bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition"
                   :class="unsavedSet.has(c.circle_id) ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'">
                <!-- 上段 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0 flex-wrap">
                    <span class="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                      {{ c.space_sym }}-{{ c.space_num }}
                    </span>
                    <h3 class="font-extrabold text-sm text-slate-900 truncate">{{ c.circle_name }}</h3>
                    <span v-if="c.penname" class="text-xs text-slate-500">({{ c.penname }})</span>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <button @click="toggleAbsent(c.circle_id)"
                            class="px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer"
                            :class="editData[c.circle_id]?.isAbsent ? 'bg-rose-600 text-white border-rose-700' : 'bg-white text-slate-600 border-slate-200'">
                      {{ editData[c.circle_id]?.isAbsent ? '🚫 欠席中' : '参加' }}
                    </button>
                    <button @click="openItemsModal(c)"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100 cursor-pointer">
                      🛍️ 商品 ({{ (editData[c.circle_id]?.items || []).length }})
                    </button>
                    <button @click="saveCircle(c.circle_id)"
                            class="px-3 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition"
                            :class="unsavedSet.has(c.circle_id) ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-blue-600 hover:bg-blue-700 text-white'">
                      💾 保存
                    </button>
                  </div>
                </div>

                <!-- 入力フィールド -->
                <div v-if="editData[c.circle_id]" class="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div class="space-y-2">
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 block mb-0.5">サークル主 X ID</label>
                      <input type="text" v-model="editData[c.circle_id].twitterId" @input="markDirty(c.circle_id)"
                             placeholder="@handle (複数はカンマ区切り)"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 block mb-0.5">お品書き URL（自動X抽出対応）</label>
                      <input type="text" v-model="editData[c.circle_id].url" @input="onUrlInput(c.circle_id)"
                             placeholder="https://x.com/... / pixiv.net/..."
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div>
                      <div class="flex items-center justify-between mb-0.5">
                        <label class="text-[11px] font-bold text-slate-500">ぶいすぽメンバー</label>
                        <button @click="togglePalette(c.circle_id, 'members')" class="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
                          パレット選択
                        </button>
                      </div>
                      <input type="text" v-model="editData[c.circle_id].membersInput" @input="markDirty(c.circle_id)"
                             placeholder="花芽すみれ, オールキャラ"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                      <div class="flex items-center justify-between mb-0.5">
                        <label class="text-[11px] font-bold text-slate-500">頒布物タグ</label>
                        <button @click="togglePalette(c.circle_id, 'tags')" class="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
                          パレット選択
                        </button>
                      </div>
                      <input type="text" v-model="editData[c.circle_id].tagsInput" @input="markDirty(c.circle_id)"
                             placeholder="新刊, アクスタ"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                  </div>
                </div>

                <!-- ワンクリック選択パレット -->
                <div v-if="activePaletteCircleId === c.circle_id" class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div class="flex items-center justify-between text-[11px] font-extrabold text-slate-600">
                    <span>{{ activePaletteType === 'members' ? 'メンバーを選択' : 'タグを選択' }}</span>
                    <button @click="activePaletteCircleId = null" class="text-slate-400 hover:text-slate-700 cursor-pointer">閉じる ✕</button>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <template v-if="activePaletteType === 'members'">
                      <button v-for="m in vspoMembersPalette" :key="m.name"
                              @click="toggleMemberToken(c.circle_id, m.name)"
                              class="px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer"
                              :class="isTokenSelected(editData[c.circle_id].membersInput, m.name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'">
                        {{ m.mark }}{{ m.name }}
                      </button>
                    </template>
                    <template v-else>
                      <button v-for="t in presetTags" :key="t"
                              @click="toggleTagToken(c.circle_id, t)"
                              class="px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer"
                              :class="isTokenSelected(editData[c.circle_id].tagsInput, t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'">
                        {{ t }}
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- タブ2: 一括インポート -->
          <AdminBulkImportTab v-show="activeTab === 'import'" :circles="circles" @apply-import="applyBulkImport" />

          <!-- タブ3: お知らせ配信管理 -->
          <AdminNotificationsTab v-show="activeTab === 'notifications'" @toast="showToast" />

          <!-- タブ4: 認証申請 -->
          <AdminAuthRequestsTab v-show="activeTab === 'auth_requests'"
                                :requests="authRequests"
                                :circles="circles"
                                :last-issued-code="lastIssuedAdminCode"
                                @refresh="fetchAuthRequests"
                                @resolve="resolveAuthRequest"
                                @issue-code="issueAdminInviteCode"
                                @reassign-membership="reassignCircleMembership" />

          <!-- タブ5: バックアップ -->
          <AdminBackupTab v-show="activeTab === 'backup'"
                          @export-json="exportBackupJson"
                          @restore-json="restoreBackupJson"
                          @toast="showToast" />
        </template>
      </main>
    </template>

    <!-- 商品登録モーダル -->
    <AdminItemsModal
      :circle="activeCircleForItems"
      :oshinagaki-url="activeCircleForItems ? (editData[activeCircleForItems.circle_id]?.url || '') : ''"
      :initial-items="activeCircleForItems ? (editData[activeCircleForItems.circle_id]?.items || []) : []"
      :is-saving="isSavingItems"
      @update:oshinagaki-url="val => { if (activeCircleForItems && editData[activeCircleForItems.circle_id]) { editData[activeCircleForItems.circle_id].url = val; markDirty(activeCircleForItems.circle_id); } }"
      @close="activeCircleForItems = null"
      @save="saveItemsFromModal"
    />

    <!-- トースト通知 -->
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      <div v-for="t in toasts" :key="t.id"
           class="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold text-white"
           :class="t.type === 'error' ? 'bg-rose-900 border-rose-700' : (t.type === 'info' ? 'bg-slate-800 border-slate-600' : 'bg-slate-900 border-slate-700')">
        <span>{{ t.type === 'error' ? '❌' : (t.type === 'info' ? 'ℹ️' : '✅') }}</span>
        <span>{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { supabaseClient } from '../supabase';
import { EVENT_CONFIG } from '../eventConfig';
import {
  vspoMembersPalette,
  presetTags,
  parseCommaTokens,
  extractTwitterIdFromUrl
} from './utils/adminHelpers';
import AdminItemsModal from './components/AdminItemsModal.vue';
import AdminBulkImportTab from './components/AdminBulkImportTab.vue';
import AdminNotificationsTab from './components/AdminNotificationsTab.vue';
import AdminAuthRequestsTab from './components/AdminAuthRequestsTab.vue';
import AdminBackupTab from './components/AdminBackupTab.vue';

const DRAFT_STORAGE_KEY = EVENT_CONFIG.storageKey('admin_draft_edits_v1');

const adminTabs = [
  { id: 'circles', icon: '📝', label: 'サークル編集' },
  { id: 'import', icon: '📥', label: '一括インポート' },
  { id: 'notifications', icon: '📢', label: 'お知らせ配信' },
  { id: 'auth_requests', icon: '🔐', label: '認証申請' },
  { id: 'backup', icon: '💾', label: 'バックアップ' }
];

const filterOptions = [
  { id: 'all', label: 'すべて' },
  { id: 'has_url', label: 'お品書き有' },
  { id: 'no_url', label: 'お品書き未' },
  { id: 'needs_items', label: '商品未登録' },
  { id: 'absent', label: '欠席' }
];

const user = ref(null);
const adminProfile = ref(null);
const authId = ref('Jamj__Otaku');
const authPassword = ref('');
const authError = ref('');

const activeTab = ref('circles');
const loading = ref(true);
const circles = ref([]);
const editData = ref({});
const searchQuery = ref('');
const selectedBlock = ref('');
const activeFilter = ref('all');
const unsavedSet = ref(new Set());
const isBulkSaving = ref(false);
const toasts = ref([]);

const activePaletteCircleId = ref(null);
const activePaletteType = ref('members');
const activeCircleForItems = ref(null);
const isSavingItems = ref(false);
const authRequests = ref([]);

const pendingAuthRequestsCount = computed(() => authRequests.value.filter(r => r.status === 'pending').length);

const showToast = (message, type = 'success', duration = 3000) => {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, duration);
};

const isAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return (
    lower === `admin@${EVENT_CONFIG.dummyEmailDomain}` ||
    lower === `jamj__otaku@${EVENT_CONFIG.dummyEmailDomain}` ||
    lower === 'admin@vggc.dummy.local' ||
    lower === 'jamj__otaku@vggc.dummy.local'
  );
};

const normalizeEmail = (input) => {
  const raw = (input || '').trim();
  if (!raw) return `admin@${EVENT_CONFIG.dummyEmailDomain}`;
  if (raw.includes('@')) return raw;
  return `${raw}@${EVENT_CONFIG.dummyEmailDomain}`;
};

const handleAuth = async () => {
  authError.value = '';
  const email = normalizeEmail(authId.value);
  if (!isAdminEmail(email)) {
    authError.value = 'このアカウントには管理者権限が設定されていません。';
    return;
  }
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: authPassword.value });
    if (error) throw error;
    if (data?.session) {
      user.value = data.user;
      await loadData();
    }
  } catch (err) {
    authError.value = err.message === 'Invalid login credentials' ? 'IDまたはパスワードが間違っています。' : err.message;
  }
};

const signOut = async () => {
  await supabaseClient.auth.signOut();
  user.value = null;
  adminProfile.value = null;
};

const saveDraft = () => {
  try {
    const dirty = {};
    unsavedSet.value.forEach(id => {
      if (editData.value[id]) dirty[id] = editData.value[id];
    });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(dirty));
  } catch (e) {}
};

const markDirty = (circleId) => {
  unsavedSet.value.add(circleId);
  saveDraft();
};

const fetchAuthRequests = async () => {
  const { data, error } = await supabaseClient
    .from('circle_auth_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error && Array.isArray(data)) authRequests.value = data;
};

const resolveAuthRequest = async (reqId, action) => {
  try {
    const { data, error } = await supabaseClient.rpc('resolve_circle_auth_request', {
      p_request_id: reqId,
      p_action: action
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || '処理に失敗しました');
    if (data.issued_code) {
      try { await navigator.clipboard.writeText(data.issued_code); } catch (e) {}
      showToast(`VO-コードを発行＆コピーしました: ${data.issued_code}`, 'success');
    } else if (action === 'approve_direct') {
      showToast('申請者のアカウントへオーナー権限を直接付与しました！', 'success');
    } else {
      showToast('申請を却下しました', 'info');
    }
    await fetchAuthRequests();
  } catch (err) {
    showToast(err.message || '申請処理エラー', 'error');
  }
};

const lastIssuedAdminCode = ref('');

const issueAdminInviteCode = async ({ circleId, targetRole }) => {
  try {
    const { data, error } = await supabaseClient.rpc('admin_create_circle_invite_code', {
      p_circle_id: circleId,
      p_target_role: targetRole,
      p_max_uses: targetRole === 'staff' ? 5 : 1
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'コード発行に失敗しました');
    lastIssuedAdminCode.value = data.code;
    try { await navigator.clipboard.writeText(data.code); } catch (e) {}
    showToast(`コードを発行＆コピーしました: ${data.code}`, 'success');
  } catch (err) {
    showToast(err.message || 'コード発行エラー', 'error');
  }
};

const reassignCircleMembership = async ({ circleId, targetAccount, role, revokeExistingOwners }) => {
  try {
    const { data, error } = await supabaseClient.rpc('admin_reassign_circle_membership', {
      p_circle_id: circleId,
      p_target_account: targetAccount,
      p_role: role,
      p_revoke_existing_owners: revokeExistingOwners
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || '緊急再紐づけに失敗しました');
    showToast(`緊急再紐づけを完了しました (${data.target_email} / ${data.role})`, 'success');
  } catch (err) {
    showToast(err.message || '緊急再紐づけエラー', 'error');
  }
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await fetch('/data.json');
    const data = await res.json();
    circles.value = data.circles || [];

    const initial = {};
    circles.value.forEach(c => {
      initial[c.circle_id] = {
        twitterId: c.twitter_id || '',
        staffTwitter: '',
        tagsInput: '',
        membersInput: '',
        url: '',
        items: [],
        isAbsent: false
      };
    });

    const { data: dbData } = await supabaseClient.from('circle_info').select('*');
    if (Array.isArray(dbData)) {
      dbData.forEach(info => {
        if (!initial[info.circle_id]) return;
        const rawTags = Array.isArray(info.tags) ? info.tags : [];
        initial[info.circle_id].isAbsent = Boolean(info.is_absent) || rawTags.includes('__ABSENT__');
        initial[info.circle_id].tagsInput = rawTags.filter(t => !String(t).startsWith('__')).join(', ');
        initial[info.circle_id].membersInput = (info.members || []).join(', ');
        initial[info.circle_id].url = info.oshinagaki_url || '';
        initial[info.circle_id].items = Array.isArray(info.items) ? info.items : [];
        if (info.twitter_id) initial[info.circle_id].twitterId = info.twitter_id;
        if (info.staff_twitter) initial[info.circle_id].staffTwitter = info.staff_twitter;
      });
    }

    try {
      const draftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        Object.entries(draft).forEach(([id, val]) => {
          if (initial[id]) {
            initial[id] = { ...initial[id], ...val };
            unsavedSet.value.add(id);
          }
        });
      }
    } catch (e) {}

    editData.value = initial;

    if (user.value?.id) {
      const { data: adminRow } = await supabaseClient
        .from('admin_users')
        .select('*')
        .eq('user_id', user.value.id)
        .maybeSingle();
      if (adminRow) adminProfile.value = adminRow;
    }

    await fetchAuthRequests();
  } catch (e) {
    showToast('データ読み込みに失敗しました', 'error');
  } finally {
    loading.value = false;
  }
};

const buildCircleUpsertPayload = (circleId) => {
  const d = editData.value[circleId];
  const tags = parseCommaTokens(d.tagsInput);
  if (d.isAbsent && !tags.includes('__ABSENT__')) tags.push('__ABSENT__');
  return {
    circle_id: circleId,
    twitter_id: d.twitterId || '',
    staff_twitter: d.staffTwitter || '',
    oshinagaki_url: d.url || '',
    members: parseCommaTokens(d.membersInput),
    tags,
    items: Array.isArray(d.items) ? d.items : [],
    is_absent: Boolean(d.isAbsent),
    updated_at: new Date().toISOString()
  };
};

const saveCircle = async (circleId) => {
  try {
    const payload = buildCircleUpsertPayload(circleId);
    const { error } = await supabaseClient.from('circle_info').upsert(payload, { onConflict: 'circle_id' });
    if (error) throw error;
    unsavedSet.value.delete(circleId);
    saveDraft();
    showToast('保存しました');
  } catch (err) {
    showToast(err.message || '保存エラー', 'error');
  }
};

const saveAllDirty = async () => {
  if (unsavedSet.value.size === 0) return;
  isBulkSaving.value = true;
  try {
    const payloads = Array.from(unsavedSet.value).map(buildCircleUpsertPayload);
    const { error } = await supabaseClient.from('circle_info').upsert(payloads, { onConflict: 'circle_id' });
    if (error) throw error;
    unsavedSet.value.clear();
    saveDraft();
    showToast(`${payloads.length}件を一括保存しました！`);
  } catch (err) {
    showToast(err.message || '一括保存エラー', 'error');
  } finally {
    isBulkSaving.value = false;
  }
};

const onUrlInput = (circleId) => {
  const d = editData.value[circleId];
  if (d && !d.twitterId.trim()) {
    const extracted = extractTwitterIdFromUrl(d.url);
    if (extracted) d.twitterId = `@${extracted}`;
  }
  markDirty(circleId);
};

const toggleAbsent = (circleId) => {
  if (!editData.value[circleId]) return;
  editData.value[circleId].isAbsent = !editData.value[circleId].isAbsent;
  markDirty(circleId);
};

const togglePalette = (circleId, type) => {
  if (activePaletteCircleId.value === circleId && activePaletteType.value === type) {
    activePaletteCircleId.value = null;
  } else {
    activePaletteCircleId.value = circleId;
    activePaletteType.value = type;
  }
};

const isTokenSelected = (str, token) => parseCommaTokens(str).includes(token);

const toggleMemberToken = (circleId, name) => {
  const d = editData.value[circleId];
  const cur = parseCommaTokens(d.membersInput);
  const idx = cur.indexOf(name);
  if (idx >= 0) cur.splice(idx, 1); else cur.push(name);
  d.membersInput = cur.join(', ');
  markDirty(circleId);
};

const toggleTagToken = (circleId, tag) => {
  const d = editData.value[circleId];
  const cur = parseCommaTokens(d.tagsInput);
  const idx = cur.indexOf(tag);
  if (idx >= 0) cur.splice(idx, 1); else cur.push(tag);
  d.tagsInput = cur.join(', ');
  markDirty(circleId);
};

const openItemsModal = (circle) => {
  activeCircleForItems.value = circle;
};

const saveItemsFromModal = async (cleanedItems) => {
  if (!activeCircleForItems.value) return;
  const cid = activeCircleForItems.value.circle_id;
  isSavingItems.value = true;
  editData.value[cid].items = cleanedItems;
  await saveCircle(cid);
  isSavingItems.value = false;
  activeCircleForItems.value = null;
};

const applyBulkImport = (rows) => {
  rows.forEach(r => {
    const d = editData.value[r.circle_id];
    if (!d) return;
    if (r.twitterId) d.twitterId = r.twitterId;
    if (r.staffTwitter) d.staffTwitter = r.staffTwitter;
    if (r.url) d.url = r.url;
    if (r.membersInput) d.membersInput = r.membersInput;
    if (r.tagsInput) d.tagsInput = r.tagsInput;
    if (Array.isArray(r.items)) d.items = r.items;
    markDirty(r.circle_id);
  });
  activeTab.value = 'circles';
  showToast(`${rows.length}件を編集キューへ取り込みました。「一括保存」でDBへ反映できます。`);
};

const exportBackupJson = () => {
  const rows = Object.keys(editData.value).map(buildCircleUpsertPayload);
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), circle_info: rows }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${EVENT_CONFIG.slug}_circle_info_backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('バックアップJSONをダウンロードしました');
};

const restoreBackupJson = (rows) => {
  let count = 0;
  rows.forEach(r => {
    const d = editData.value[r.circle_id];
    if (!d) return;
    d.twitterId = r.twitter_id || '';
    d.staffTwitter = r.staff_twitter || '';
    d.url = r.oshinagaki_url || '';
    d.membersInput = Array.isArray(r.members) ? r.members.join(', ') : '';
    d.tagsInput = Array.isArray(r.tags) ? r.tags.filter(t => !String(t).startsWith('__')).join(', ') : '';
    d.items = Array.isArray(r.items) ? r.items : [];
    d.isAbsent = Boolean(r.is_absent);
    markDirty(r.circle_id);
    count++;
  });
  activeTab.value = 'circles';
  showToast(`${count}件を復元しました。「一括保存」でDBへ反映できます。`);
};

const availableBlocks = computed(() => {
  const set = new Set();
  circles.value.forEach(c => { if (c.space_sym) set.add(c.space_sym); });
  return Array.from(set);
});

const countHasUrl = computed(() => circles.value.filter(c => (editData.value[c.circle_id]?.url || '').trim()).length);
const countHasAuthorTwitter = computed(() => circles.value.filter(c => (editData.value[c.circle_id]?.twitterId || '').trim()).length);
const circlesWithItemsCount = computed(() => circles.value.filter(c => (editData.value[c.circle_id]?.items || []).length > 0).length);

const filteredCircles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return circles.value.filter(c => {
    if (selectedBlock.value && c.space_sym !== selectedBlock.value) return false;
    const d = editData.value[c.circle_id] || {};
    if (activeFilter.value === 'has_url' && !(d.url || '').trim()) return false;
    if (activeFilter.value === 'no_url' && (d.url || '').trim()) return false;
    if (activeFilter.value === 'needs_items' && (d.items || []).length > 0) return false;
    if (activeFilter.value === 'absent' && !d.isAbsent) return false;
    if (!q) return true;
    const space = `${c.space_sym}-${c.space_num}`.toLowerCase();
    return (
      space.includes(q) ||
      String(c.circle_name || '').toLowerCase().includes(q) ||
      String(c.penname || '').toLowerCase().includes(q) ||
      String(d.twitterId || '').toLowerCase().includes(q)
    );
  });
});

const onKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveAllDirty();
  }
};

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user && isAdminEmail(session.user.email)) {
    user.value = session.user;
    await loadData();
  } else {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

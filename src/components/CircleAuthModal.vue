<template>
  <teleport to="body">
    <div v-if="show"
         @click.self="$emit('close')"
         class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 md:p-4">
      <div class="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <!-- ヘッダー -->
        <div class="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-amber-50 to-white">
          <div class="flex items-center gap-2">
            <span class="text-lg">🏪</span>
            <div>
              <h2 class="font-extrabold text-sm md:text-base text-gray-900">サークル認証・売り子連携</h2>
              <p class="text-[11px] text-gray-500">サークル参加者向けPOSレジ・管理機能の有効化</p>
            </div>
          </div>
          <button @click="$emit('close')"
                  class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold cursor-pointer">
            ✕
          </button>
        </div>

        <!-- 本体 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

          <!-- エラー / 成功メッセージ -->
          <div v-if="errorMsg" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            ⚠️ {{ errorMsg }}
          </div>
          <div v-if="successMsg" class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            ✅ {{ successMsg }}
          </div>

          <!-- 1. 未ログイン時 -->
          <div v-if="!user" class="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p class="text-xs text-slate-700 leading-relaxed font-medium">
              サークル機能の有効化には、まずアカウントへのログインが必要です。<br>
              売り子として招待コードを使う場合は、通常の「IDログイン／新規登録」でログインした後にここを開いてください。
            </p>
            <div class="flex flex-col gap-2">
              <button @click="loginWithXOAuth"
                      :disabled="!isOnline || isProcessing"
                      type="button"
                      class="w-full min-h-[44px] px-4 py-2.5 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition">
                <span>𝕏</span>
                <span>X (Twitter) で最小権限ログイン</span>
              </button>
              <button @click="$emit('open-standard-auth')"
                      type="button"
                      class="w-full min-h-[40px] px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition">
                通常のユーザーIDでログイン／新規登録
              </button>
            </div>
          </div>

          <!-- 2. ログイン済み時 -->
          <template v-else>
            <!-- 紐付け済みサークル一覧（監査ログ・解除・売り子コード発行） -->
            <div v-if="memberships.length > 0" class="space-y-2.5">
              <div class="text-xs font-extrabold text-gray-700 flex items-center justify-between">
                <span>認証済みサークル ({{ memberships.length }}件)</span>
              </div>

              <div v-for="m in memberships" :key="m.circle_id"
                   class="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-600 text-white">
                        {{ m.role === 'owner' ? 'サークル主' : '売り子' }}
                      </span>
                      <span class="font-extrabold text-sm text-gray-900 truncate">
                        {{ getCircleLabel(m.circle_id) }}
                      </span>
                    </div>
                    <!-- 監査ログ表示（認証方式・日時） -->
                    <div class="text-[11px] text-gray-600 mt-1 space-y-0.5">
                      <div>認証方式: <span class="font-bold">{{ getAuthMethodLabel(m.auth_method) }}</span>
                        <span v-if="m.verified_x_handle" class="font-mono text-gray-700">(@{{ m.verified_x_handle }})</span>
                      </div>
                      <div>認証日時: <span class="font-mono">{{ formatDateTime(m.verified_at) }}</span></div>
                    </div>
                  </div>

                  <button @click="revokeMembership(m.circle_id)"
                          :disabled="!isOnline || isProcessing"
                          type="button"
                          class="px-2.5 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-bold shrink-0 cursor-pointer">
                    紐付け解除
                  </button>
                </div>

                <!-- 売り子用招待コード ワンタップ発行（サークル主のみ） -->
                <div v-if="m.role === 'owner'" class="pt-2 border-t border-amber-200/70 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-bold text-amber-900">🎟️ 売り子用招待コード（7日間・最大5名）</span>
                    <button @click="generateInviteCode(m.circle_id)"
                            :disabled="!isOnline || isProcessing"
                            type="button"
                            class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-2xs cursor-pointer transition">
                      ＋ コードを発行
                    </button>
                  </div>

                  <div v-if="generatedCode && generatedCodeCircleId === m.circle_id"
                       class="p-2.5 bg-white border border-amber-300 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-mono font-black text-sm text-gray-900 tracking-wider">{{ generatedCode }}</span>
                    <button @click="copyCode(generatedCode)"
                            type="button"
                            class="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold cursor-pointer">
                      {{ copied ? '✓ コピー済' : 'コピー' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- モード切替タブ（サークル主認証 / 売り子参加） -->
            <div class="border-t border-gray-200 pt-3 space-y-3">
              <div class="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button @click="mode = 'owner'"
                        type="button"
                        class="py-2 rounded-lg text-xs font-extrabold transition cursor-pointer"
                        :class="mode === 'owner' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'">
                  👑 サークル主認証
                </button>
                <button @click="mode = 'staff'"
                        type="button"
                        class="py-2 rounded-lg text-xs font-extrabold transition cursor-pointer"
                        :class="mode === 'staff' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'">
                  🎟️ 売り子コード参加
                </button>
              </div>

              <!-- タブA：サークル主として X OAuth 認証 -->
              <div v-if="mode === 'owner'" class="space-y-3">
                <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950 space-y-1 leading-relaxed">
                  <div class="font-extrabold">🔒 最小権限・安心設計について</div>
                  <ul class="list-disc list-inside space-y-0.5 text-blue-900">
                    <li>取得するのは <strong>X のユーザー名（読み取りのみ）</strong> で、投稿やDM権限は一切要求しません。</li>
                    <li>認証完了後は <strong>X 側でアプリ連携をすぐ解除しても</strong> サークル機能をそのまま利用できます。</li>
                  </ul>
                </div>

                <!-- 現在の X OAuth 連携状態 -->
                <div class="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                  <div class="text-xs">
                    <span class="text-gray-500 font-bold">X 連携状態: </span>
                    <span v-if="currentXHandle" class="font-mono font-extrabold text-emerald-700">@{{ currentXHandle }} 連携済</span>
                    <span v-else class="font-bold text-gray-600">未連携</span>
                  </div>
                  <button v-if="!currentXHandle"
                          @click="linkOrLoginWithX"
                          :disabled="!isOnline || isProcessing"
                          type="button"
                          class="px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-extrabold cursor-pointer">
                    𝕏 連携する
                  </button>
                </div>

                <!-- サークル検索＆選択 -->
                <div class="space-y-1.5">
                  <label class="text-xs font-extrabold text-gray-700 block">自分のサークルを選択</label>
                  <input type="text"
                         v-model="circleSearch"
                         placeholder="スペース番号やサークル名で検索 (例: M-15, Black)"
                         class="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                  <div v-if="filteredCircles.length > 0"
                       class="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    <button v-for="c in filteredCircles"
                            :key="c.circle_id"
                            @click="selectedCircleId = c.circle_id"
                            type="button"
                            class="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-blue-50 transition cursor-pointer"
                            :class="selectedCircleId === c.circle_id ? 'bg-blue-50 font-extrabold text-blue-900' : 'text-gray-800'">
                      <span class="truncate">
                        <span class="font-mono font-bold mr-1.5">[{{ c.space_sym }}-{{ c.space_num }}]</span>
                        {{ c.circle_name }}
                      </span>
                      <span v-if="selectedCircleId === c.circle_id" class="text-blue-600 font-bold shrink-0">✓ 選択中</span>
                    </button>
                  </div>
                </div>

                <button @click="verifyOwnerByX"
                        :disabled="!isOnline || isProcessing || !currentXHandle || !selectedCircleId"
                        type="button"
                        class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs md:text-sm font-extrabold shadow-sm cursor-pointer transition">
                  {{ isProcessing ? '照合中...' : '選択したサークルで本人確認を実行' }}
                </button>
              </div>

              <!-- タブB：売り子招待コードで参加 -->
              <div v-else class="space-y-3">
                <p class="text-xs text-gray-600 leading-relaxed">
                  サークル主が発行した招待コード（例：<span class="font-mono font-bold">VC-A1B2-C3D4</span>）を入力すると、X連携なしで即座に売り子としてレジ機能を利用できます。
                </p>
                <div class="flex gap-2">
                  <input type="text"
                         v-model="inviteCodeInput"
                         placeholder="VC-XXXX-XXXX"
                         class="flex-1 px-3 py-2.5 text-sm font-mono uppercase bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">
                  <button @click="redeemInviteCode"
                          :disabled="!isOnline || isProcessing || !inviteCodeInput.trim()"
                          type="button"
                          class="px-4 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-xs font-extrabold cursor-pointer transition shrink-0">
                    参加する
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { supabaseClient } from '../supabase';
import { extractXHandleFromUser, normalizeInviteCode, getAuthMethodLabel } from '../utils/circleAuth';

const props = defineProps({
  show: { type: Boolean, default: false },
  user: { type: Object, default: null },
  isOnline: { type: Boolean, default: true },
  circles: { type: Array, default: () => [] },
  memberships: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'open-standard-auth', 'memberships-updated']);

const mode = ref('owner');
const circleSearch = ref('');
const selectedCircleId = ref('');
const inviteCodeInput = ref('');
const isProcessing = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const generatedCode = ref('');
const generatedCodeCircleId = ref('');
const copied = ref(false);

const currentXHandle = computed(() => extractXHandleFromUser(props.user));

const filteredCircles = computed(() => {
  const q = circleSearch.value.trim().toLowerCase();
  if (!q) return props.circles.slice(0, 30);
  return props.circles
    .filter(c => {
      const space = `${c.space_sym}-${c.space_num}`.toLowerCase();
      return (
        space.includes(q) ||
        String(c.circle_name || '').toLowerCase().includes(q) ||
        String(c.penname || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 30);
});

const getCircleLabel = (circleId) => {
  const c = props.circles.find(item => item.circle_id === circleId);
  if (!c) return circleId;
  return `${c.space_sym}-${c.space_num} ${c.circle_name}`;
};

const formatDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('ja-JP');
  } catch (e) {
    return iso;
  }
};

const loginWithXOAuth = async () => {
  errorMsg.value = '';
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        scopes: 'users.read',
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  } catch (err) {
    errorMsg.value = err.message || 'X OAuth ログインの開始に失敗しました。';
  }
};

const linkOrLoginWithX = async () => {
  errorMsg.value = '';
  try {
    if (supabaseClient.auth.linkIdentity) {
      const { error } = await supabaseClient.auth.linkIdentity({
        provider: 'twitter',
        options: {
          scopes: 'users.read',
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } else {
      await loginWithXOAuth();
    }
  } catch (err) {
    errorMsg.value = err.message || 'X 連携の開始に失敗しました。';
  }
};

const verifyOwnerByX = async () => {
  if (!selectedCircleId.value) return;
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('verify_circle_owner_by_x', {
      p_circle_id: selectedCircleId.value
    });
    if (error) throw error;
    if (!data?.ok) {
      if (data?.error === 'X_HANDLE_MISMATCH') {
        throw new Error(`連携中の X アカウント (@${data.verified_x_handle}) が、このサークルの登録アカウントと一致しません。`);
      }
      throw new Error(data?.error || '本人確認に失敗しました。');
    }
    successMsg.value = `サークル主として認証されました！(@${data.verified_x_handle})`;
    emit('memberships-updated');
  } catch (err) {
    errorMsg.value = err.message || '認証処理でエラーが発生しました。';
  } finally {
    isProcessing.value = false;
  }
};

const generateInviteCode = async (circleId) => {
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('create_staff_invite_code', {
      p_circle_id: circleId,
      p_max_uses: 5
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || '招待コードの発行に失敗しました。');
    generatedCode.value = data.code;
    generatedCodeCircleId.value = circleId;
    copied.value = false;
    successMsg.value = '売り子用の招待コードを発行しました！';
  } catch (err) {
    errorMsg.value = err.message || '招待コード発行に失敗しました。';
  } finally {
    isProcessing.value = false;
  }
};

const redeemInviteCode = async () => {
  const normalized = normalizeInviteCode(inviteCodeInput.value);
  if (!normalized) {
    errorMsg.value = '招待コードの形式が正しくありません（例: VC-XXXX-XXXX）。';
    return;
  }
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('redeem_staff_invite_code', {
      p_code: normalized
    });
    if (error) throw error;
    if (!data?.ok) {
      throw new Error('招待コードが無効、または有効期限切れ・利用上限に達しています。');
    }
    inviteCodeInput.value = '';
    successMsg.value = '売り子としてサークルに参加しました！レジ機能が利用可能です。';
    emit('memberships-updated');
  } catch (err) {
    errorMsg.value = err.message || 'コードの適用に失敗しました。';
  } finally {
    isProcessing.value = false;
  }
};

const revokeMembership = async (circleId) => {
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;
  try {
    const { error } = await supabaseClient.rpc('revoke_my_circle_membership', {
      p_circle_id: circleId
    });
    if (error) throw error;
    successMsg.value = 'サークルの紐付けを解除しました。';
    emit('memberships-updated');
  } catch (err) {
    errorMsg.value = err.message || '紐付け解除に失敗しました。';
  } finally {
    isProcessing.value = false;
  }
};

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
  } catch (e) {}
};
</script>

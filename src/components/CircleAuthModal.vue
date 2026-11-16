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
              <p class="text-[11px] text-gray-500">完全無料・X連携権限不要の本人確認</p>
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
          <div v-if="errorMsg" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold whitespace-pre-line">
            ⚠️ {{ errorMsg }}
          </div>
          <div v-if="successMsg" class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold whitespace-pre-line">
            ✅ {{ successMsg }}
          </div>

          <!-- 1. 未ログイン時 -->
          <div v-if="!user" class="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p class="text-xs text-slate-700 leading-relaxed font-medium">
              サークル認証や売り子参加を行うには、まず通常のアカウント（ユーザーID＋パスワード）でログインしてください。<br>
              X アカウントとのアプリ連携（OAuth）は不要です。
            </p>
            <button @click="$emit('open-standard-auth')"
                    type="button"
                    class="w-full min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-xs">
              ユーザーIDでログイン / 新規登録
            </button>
          </div>

          <!-- 2. ログイン済み時 -->
          <template v-else>
            <!-- 現在の紐付けステータスバナー -->
            <div v-if="memberships.length === 0"
                 class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between gap-2">
              <span class="font-bold">状態：<span class="text-rose-600">未紐付け</span>（下のタブから認証できます）</span>
            </div>

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
                    <button @click="copyText(generatedCode, 'code')"
                            type="button"
                            class="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold cursor-pointer">
                      {{ copiedKey === 'code' ? '✓ コピー済' : 'コピー' }}
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

              <!-- タブA：確認コード付きポストURLによる完全無料本人確認 -->
              <div v-if="mode === 'owner'" class="space-y-3">
                <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-950 space-y-1 leading-relaxed">
                  <div class="font-extrabold">🔒 アプリ連携なし・0円本人確認の手順</div>
                  <ol class="list-decimal list-inside space-y-0.5 text-blue-900">
                    <li>下の「確認コード」を含めて自分の X でポスト（認証後は削除OK）</li>
                    <li>自分のサークルを選択し、そのポストの URL を貼って確認</li>
                  </ol>
                  <p class="text-[10px] text-blue-700 pt-0.5">※ 非公開（鍵）アカウントの場合は運営へ個別申請ください。</p>
                </div>

                <!-- Step 1: ワンタイム確認コード -->
                <div class="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-extrabold text-gray-700">Step 1. 確認コード</span>
                    <button @click="refreshVerifyCode"
                            type="button"
                            class="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                      再生成
                    </button>
                  </div>
                  <div class="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2">
                    <span class="font-mono font-black text-sm text-gray-900 flex-1 tracking-wider">{{ verifyCode }}</span>
                    <button @click="copyText(verifyCode, 'verify')"
                            type="button"
                            class="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] font-bold cursor-pointer">
                      {{ copiedKey === 'verify' ? '✓ コピー済' : 'コピー' }}
                    </button>
                  </div>
                  <a :href="xPostIntentUrl"
                     target="_blank"
                     rel="noopener noreferrer"
                     class="w-full min-h-[38px] px-3 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition">
                    <span>𝕏</span>
                    <span>確認用ポストを作成する</span>
                  </a>
                </div>

                <!-- Step 2: サークル検索＆選択 -->
                <div class="space-y-1.5">
                  <label class="text-xs font-extrabold text-gray-700 block">Step 2. 自分のサークルを選択</label>
                  <input type="text"
                         v-model="circleSearch"
                         placeholder="スペース番号やサークル名で検索 (例: M-15, Black)"
                         class="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                  <div v-if="filteredCircles.length > 0"
                       class="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
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

                <!-- Step 3: ポストURL入力＆検証 -->
                <div class="space-y-1.5">
                  <label class="text-xs font-extrabold text-gray-700 block">Step 3. ポストのURLを貼り付け</label>
                  <input type="url"
                         v-model="postUrlInput"
                         placeholder="https://x.com/your_id/status/123456789..."
                         class="w-full px-3 py-2.5 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                </div>

                <button @click="verifyOwnerByPostUrl"
                        :disabled="!isOnline || isProcessing || !postUrlInput.trim() || !selectedCircleId"
                        type="button"
                        class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs md:text-sm font-extrabold shadow-sm cursor-pointer transition">
                  {{ isProcessing ? '公開ポストを確認中...' : 'ポストURLで本人確認を実行' }}
                </button>
              </div>

              <!-- タブB：売り子招待コードで参加 -->
              <div v-else class="space-y-3">
                <p class="text-xs text-gray-600 leading-relaxed">
                  サークル主が発行した招待コード（例：<span class="font-mono font-bold">VC-A1B2-C3D4</span>）を入力すると、即座に売り子としてレジ機能を利用できます。
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
import { EVENT_CONFIG } from '../eventConfig';
import {
  generatePostVerifyCode,
  normalizeXPostUrl,
  normalizeInviteCode,
  getAuthMethodLabel
} from '../utils/circleAuth';

const props = defineProps({
  show: { type: Boolean, default: false },
  user: { type: Object, default: null },
  isOnline: { type: Boolean, default: true },
  circles: { type: Array, default: () => [] },
  memberships: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'open-standard-auth', 'memberships-updated']);

const mode = ref('owner');
const verifyCode = ref(generatePostVerifyCode());
const circleSearch = ref('');
const selectedCircleId = ref('');
const postUrlInput = ref('');
const inviteCodeInput = ref('');
const isProcessing = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const generatedCode = ref('');
const generatedCodeCircleId = ref('');
const copiedKey = ref('');

const refreshVerifyCode = () => {
  verifyCode.value = generatePostVerifyCode();
};

const xPostIntentUrl = computed(() => {
  const text = `${EVENT_CONFIG.name} サークル認証用確認コード: ${verifyCode.value}\n${EVENT_CONFIG.hashtag}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
});

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

const verifyOwnerByPostUrl = async () => {
  const normalizedUrl = normalizeXPostUrl(postUrlInput.value);
  if (!normalizedUrl) {
    errorMsg.value = '有効な X (Twitter) のポストURL（例: https://x.com/user/status/123...）を入力してください。';
    return;
  }
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('/api/verify-x-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        postUrl: normalizedUrl,
        expectedCode: verifyCode.value,
        circleId: selectedCircleId.value
      })
    });

    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || data?.error || 'ポストの検証に失敗しました。');
    }

    if (data.mode === 'persisted') {
      successMsg.value = `サークル主として認証されました！(@${data.authorHandle})\n確認用ポストは削除して問題ありません。`;
      postUrlInput.value = '';
      refreshVerifyCode();
      emit('memberships-updated');
    } else {
      successMsg.value = `oEmbed 疎通テスト成功！\n投稿者: @${data.authorHandle}\n確認コード一致を確認しました。（※DB永続化には Vercel 側の SUPABASE_SERVICE_ROLE_KEY 設定が必要です）`;
    }
  } catch (err) {
    errorMsg.value = err.message || 'ポスト確認処理でエラーが発生しました。';
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
    copiedKey.value = '';
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

const copyText = async (text, key) => {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
  } catch (e) {}
};
</script>

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

          <!-- 1. 未ログイン時（Step 1: アプリ登録＝人の鍵 → 登録後自動で Step 2: 紐づけへ復帰） -->
          <div v-if="!user" class="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div class="text-[11px] font-extrabold text-blue-700">STEP 1 / 2：アプリ登録・ログイン（人の鍵）</div>
            <p class="text-xs text-slate-700 leading-relaxed font-medium">
              サークルの名義紐づけや売り子参加を行うには、まずアプリのアカウントを作成・ログインしてください。<br>
              登録・ログイン完了後は自動的にこの画面へ戻り、そのまま紐づけ（STEP 2）へ進めます（X OAuth不要）。
            </p>
            <button @click="$emit('open-standard-auth')"
                    type="button"
                    class="w-full min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-xs">
              登録 / ログインして紐づけへ進む
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

                <!-- 売り子用招待コード ワンタップ発行＆参加メンバー管理（サークル主のみ） -->
                <div v-if="m.role === 'owner'" class="pt-2 border-t border-amber-200/70 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-bold text-amber-900">
                      🎟️ 売り子招待コード（{{ EVENT_CONFIG.circleAuth?.inviteExpireLabel || 'イベント終了翌日まで有効' }}・最大5名）
                    </span>
                    <button @click="generateInviteCode(m.circle_id)"
                            :disabled="!isOnline || isProcessing"
                            type="button"
                            class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-2xs cursor-pointer transition">
                      ＋ コードを発行
                    </button>
                  </div>

                  <div v-if="generatedCode && generatedCodeCircleId === m.circle_id"
                       class="p-2.5 bg-white border border-amber-300 rounded-xl flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="font-mono font-black text-sm text-gray-900 tracking-wider">{{ generatedCode }}</div>
                      <div class="text-[10px] font-bold text-amber-800 mt-0.5">
                        期限: {{ EVENT_CONFIG.circleAuth?.inviteExpireLabel || 'イベント終了翌日まで有効' }}
                      </div>
                    </div>
                    <button @click="copyText(generatedCode, 'code')"
                            type="button"
                            class="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold shrink-0 cursor-pointer">
                      {{ copiedKey === 'code' ? '✓ コピー済' : 'コピー' }}
                    </button>
                  </div>

                  <!-- 構造変更2-A: 代表による売り子解除パネル -->
                  <div v-if="EVENT_CONFIG.circleAuth?.enableStaffRevokeByOwner !== false" class="pt-1">
                    <button @click="toggleCircleMembers(m.circle_id)"
                            :disabled="!isOnline || loadingMembersCircleId === m.circle_id"
                            type="button"
                            class="text-[11px] font-extrabold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer">
                      <span>👥 参加メンバー管理</span>
                      <span>{{ expandedMembersCircleId === m.circle_id ? '▲' : '▼' }}</span>
                    </button>

                    <div v-if="expandedMembersCircleId === m.circle_id" class="mt-2 space-y-1.5 bg-white border border-amber-200 rounded-xl p-2.5">
                      <div v-if="loadingMembersCircleId === m.circle_id" class="text-[11px] text-gray-500">読み込み中...</div>
                      <div v-else-if="!(membersByCircle[m.circle_id]?.length)" class="text-[11px] text-gray-500">メンバー情報がありません。</div>
                      <div v-else v-for="mem in membersByCircle[m.circle_id]" :key="mem.user_id"
                           class="flex items-center justify-between gap-2 text-[11px] py-1 border-b last:border-b-0 border-gray-100">
                        <div class="min-w-0">
                          <span class="px-1.5 py-0.5 rounded font-extrabold mr-1"
                                :class="mem.role === 'owner' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'">
                            {{ mem.role === 'owner' ? '代表' : '売り子' }}
                          </span>
                          <span class="font-mono font-bold text-gray-800">{{ mem.verified_x_handle ? `@${mem.verified_x_handle}` : mem.account_label }}</span>
                          <span v-if="mem.is_self" class="text-[10px] text-gray-400 ml-1">(自分)</span>
                        </div>
                        <button v-if="mem.role === 'staff' && !mem.is_self"
                                @click="revokeStaffMember(m.circle_id, mem)"
                                :disabled="isProcessing"
                                type="button"
                                class="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold shrink-0 cursor-pointer">
                          解除
                        </button>
                      </div>
                    </div>
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
                  👑 サークル紐づけ（代表）
                </button>
                <button @click="mode = 'staff'"
                        type="button"
                        class="py-2 rounded-lg text-xs font-extrabold transition cursor-pointer"
                        :class="mode === 'staff' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'">
                  🎟️ 招待コード入力（VC-/VO-）
                </button>
              </div>

              <!-- タブA：サークル主認証（DM確認・ポストURL認証の対等な2択） -->
              <div v-if="mode === 'owner'" class="space-y-3">
                <!-- Step 1: サークル検索＆選択（両ルート共通） -->
                <div class="space-y-1.5">
                  <label class="text-xs font-extrabold text-gray-700 block">Step 1. 自分のサークルを選択</label>
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

                <!-- Step 2: 認証方法の2択カード（対等な正規ルート） -->
                <div class="space-y-1.5">
                  <div class="text-xs font-extrabold text-gray-700">Step 2. 本人確認の方法を選択</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button"
                            @click="ownerAuthMethod = 'dm'"
                            class="text-left p-3 rounded-2xl border-2 transition cursor-pointer space-y-1"
                            :class="ownerAuthMethod === 'dm' ? 'border-emerald-500 bg-emerald-50/70 shadow-xs' : 'border-gray-200 bg-white hover:border-gray-300'">
                      <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-black text-gray-900">💬 DMで運営確認</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">ポスト不要</span>
                      </div>
                      <p class="text-[11px] text-gray-600 leading-snug">
                        受付番号を発行し、運営XへDMで送るだけ（鍵垢OK・TLに残りません）
                      </p>
                    </button>

                    <button type="button"
                            @click="ownerAuthMethod = 'post'"
                            class="text-left p-3 rounded-2xl border-2 transition cursor-pointer space-y-1"
                            :class="ownerAuthMethod === 'post' ? 'border-blue-500 bg-blue-50/70 shadow-xs' : 'border-gray-200 bg-white hover:border-gray-300'">
                      <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-black text-gray-900">📝 ポストURLで認証</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">即時自動</span>
                      </div>
                      <p class="text-[11px] text-gray-600 leading-snug">
                        確認コード付きポストURLを貼って即時認証（任意・認証後は削除可）
                      </p>
                    </button>
                  </div>
                </div>

                <!-- 方法A：DM＋運営確認ルート（正規ルート） -->
                <div v-if="ownerAuthMethod === 'dm'" class="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
                  <div class="text-[11px] text-emerald-950 font-bold leading-relaxed">
                    公開ポストは不要です。申請して受付番号（<span class="font-mono">REQ-...</span>）を発行し、運営X<span v-if="EVENT_CONFIG.adminContactX">（{{ EVENT_CONFIG.adminContactX }}）</span>へ DM でお伝えください。
                  </div>

                  <input type="text"
                         v-model="fallbackXHandle"
                         placeholder="あなたの X ID (例: @your_circle_x)"
                         class="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  <input type="text"
                         v-model="fallbackNote"
                         placeholder="補足メモ（任意：別名義、複数スペースなど）"
                         class="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">

                  <button type="button"
                          @click="submitFallbackRequest"
                          :disabled="!isOnline || isProcessing || !selectedCircleId || !fallbackXHandle.trim()"
                          class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs md:text-sm font-extrabold shadow-sm cursor-pointer transition">
                    {{ isProcessing ? '申請送信中...' : '受付番号（REQ-）を発行して申請する' }}
                  </button>

                  <div v-if="submittedRequestCode" class="p-3 rounded-xl bg-white border-2 border-emerald-400 text-[11px] text-emerald-950 space-y-2 shadow-2xs">
                    <div class="font-extrabold text-emerald-800">✅ 申請を受け付けました！次の2ステップで完了します</div>

                    <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <div class="flex-1 min-w-0">
                        <div class="text-[10px] text-emerald-700 font-bold">受付番号</div>
                        <div class="font-mono font-black text-sm text-gray-900">{{ submittedRequestCode }}</div>
                      </div>
                      <button type="button"
                              @click="copyText(submittedRequestCode, 'req_code')"
                              class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer shrink-0">
                        {{ copiedKey === 'req_code' ? '✓ コピー済' : '番号コピー' }}
                      </button>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-2">
                      <button type="button"
                              @click="copyText(dmTemplateText, 'dm_msg')"
                              class="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-[11px] font-bold cursor-pointer transition">
                        {{ copiedKey === 'dm_msg' ? '✓ DM用文面をコピー済' : '📋 DM用文面をコピー' }}
                      </button>
                      <a v-if="adminXProfileUrl"
                         :href="adminXProfileUrl"
                         target="_blank"
                         rel="noopener noreferrer"
                         class="flex-1 py-2 px-3 rounded-xl bg-black hover:bg-neutral-800 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition">
                        <span>𝕏</span>
                        <span>{{ EVENT_CONFIG.adminContactX }} へDMを送る ↗</span>
                      </a>
                    </div>

                    <p class="text-[10px] text-gray-600">
                      ※ 運営がDMと受付番号を確認して承認すると、自動でサークルレジ権限が付与されます。
                    </p>
                  </div>
                </div>

                <!-- 方法B：公式リスト掲載Xアカウントの支配証明（確認コード付きポストURL検証） -->
                <div v-else class="p-3.5 rounded-2xl bg-blue-50/40 border border-blue-200 space-y-2.5">
                  <div class="text-[11px] text-blue-950 leading-relaxed">
                    <span class="font-extrabold">⚡ 紐づけ時のXアカウント支配証明:</span> 公式リストに掲載されているサークルのXアカウントで下の一時確認コードをポストし、URLを貼ると即座に紐づけできます（確認後はポスト削除OK／既に別代表が登録済みの場合は競合確認へ回ります）。
                  </div>

                  <!-- Step 1: ワンタイム確認コード -->
                  <div class="p-3 rounded-xl border border-gray-200 bg-white space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-extrabold text-gray-700">確認コード</span>
                      <button @click="refreshVerifyCode"
                              type="button"
                              class="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                        再生成
                      </button>
                    </div>
                    <div class="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2">
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

                  <!-- Step 3: ポストURL入力＆検証 -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-extrabold text-gray-700 block">ポストのURLを貼り付け</label>
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
              </div>

              <!-- タブB：招待コードで参加 (売り子 VC- / オーナー VO-) -->
              <div v-else class="space-y-3">
                <p class="text-xs text-gray-600 leading-relaxed">
                  サークル主から受け取った売り子コード（<span class="font-mono font-bold">VC-...</span>）または運営発行のオーナーコード（<span class="font-mono font-bold">VO-...</span>）を入力してください。
                </p>
                <div class="flex gap-2">
                  <input type="text"
                         v-model="inviteCodeInput"
                         placeholder="VC-XXXX-XXXX / VO-XXXX-XXXX"
                         class="flex-1 px-3 py-2.5 text-sm font-mono uppercase bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">
                  <button @click="redeemInviteCode"
                          :disabled="!isOnline || isProcessing || !inviteCodeInput.trim()"
                          type="button"
                          class="px-4 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-xs font-extrabold cursor-pointer transition shrink-0">
                    参加する
                  </button>
                </div>
                <p class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium">
                  ※ 招待コード（VC-/VO-）は <span class="font-bold">{{ EVENT_CONFIG.circleAuth?.inviteExpireLabel || 'イベント終了翌日まで有効' }}</span> です。
                </p>
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
const ownerAuthMethod = ref('dm');
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
const showFallbackRequest = ref(false);
const fallbackXHandle = ref('');
const fallbackNote = ref('');
const submittedRequestCode = ref('');

const refreshVerifyCode = () => {
  verifyCode.value = generatePostVerifyCode();
};

const xPostIntentUrl = computed(() => {
  const text = `${EVENT_CONFIG.name} サークル認証用確認コード: ${verifyCode.value}\n${EVENT_CONFIG.hashtag}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
});

const adminXProfileUrl = computed(() => {
  const raw = String(EVENT_CONFIG.adminContactX || '').replace(/^@/, '').trim();
  return raw ? `https://x.com/${raw}` : '';
});

const dmTemplateText = computed(() => {
  const label = selectedCircleId.value ? getCircleLabel(selectedCircleId.value) : '';
  return `${EVENT_CONFIG.name} サークル認証申請\n受付番号: ${submittedRequestCode.value}\nサークル: ${label}`;
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
    errorMsg.value = '招待コードの形式が正しくありません（例: VC-XXXX-XXXX / VO-XXXX-XXXX）。';
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
      if (data?.error === 'OWNER_CONFLICT') {
        throw new Error(`このサークルは既に別の代表アカウントで紐づけ済みのため自動確定を保留しました（受付番号: ${data.request_code}）。運営側で確認・裁定します。`);
      }
      throw new Error('招待コードが無効、または有効期限切れ・利用上限に達しています。');
    }
    inviteCodeInput.value = '';
    successMsg.value =
      data.role === 'owner'
        ? 'オーナー結合コード（VO-）でサークル主として紐づけされました！'
        : '売り子招待コード（VC-）でサークルに参加しました！レジ機能が利用可能です。';
    emit('memberships-updated');
  } catch (err) {
    errorMsg.value = err.message || 'コードの適用に失敗しました。';
  } finally {
    isProcessing.value = false;
  }
};

// 構造変更2-A: 代表による参加メンバー管理・売り子解除
const expandedMembersCircleId = ref('');
const loadingMembersCircleId = ref('');
const membersByCircle = ref({});

const toggleCircleMembers = async (circleId) => {
  if (expandedMembersCircleId.value === circleId) {
    expandedMembersCircleId.value = '';
    return;
  }
  expandedMembersCircleId.value = circleId;
  loadingMembersCircleId.value = circleId;
  errorMsg.value = '';
  try {
    const { data, error } = await supabaseClient.rpc('get_my_circle_members', { p_circle_id: circleId });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'メンバー一覧の取得に失敗しました。');
    membersByCircle.value = { ...membersByCircle.value, [circleId]: data.members || [] };
  } catch (err) {
    errorMsg.value = err.message || 'メンバー一覧の取得に失敗しました。';
  } finally {
    loadingMembersCircleId.value = '';
  }
};

const revokeStaffMember = async (circleId, member) => {
  errorMsg.value = '';
  successMsg.value = '';
  isProcessing.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('owner_revoke_staff_membership', {
      p_circle_id: circleId,
      p_target_user_id: member.user_id
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || '売り子権限の解除に失敗しました。');
    successMsg.value = `売り子 (${member.verified_x_handle ? '@' + member.verified_x_handle : member.account_label}) の権限を解除しました。`;
    membersByCircle.value = {
      ...membersByCircle.value,
      [circleId]: (membersByCircle.value[circleId] || []).filter((m) => m.user_id !== member.user_id)
    };
  } catch (err) {
    errorMsg.value = err.message || '売り子権限の解除に失敗しました。';
  } finally {
    isProcessing.value = false;
  }
};

const submitFallbackRequest = async () => {
  if (!selectedCircleId.value || !fallbackXHandle.value.trim()) return;
  errorMsg.value = '';
  successMsg.value = '';
  submittedRequestCode.value = '';
  isProcessing.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('submit_circle_auth_request', {
      p_circle_id: selectedCircleId.value,
      p_x_handle: fallbackXHandle.value.trim(),
      p_note: fallbackNote.value.trim()
    });
    if (error) throw error;
    if (!data?.ok) {
      throw new Error(data?.error || '申請の送信に失敗しました。');
    }
    submittedRequestCode.value = data.request_code;
    fallbackNote.value = '';
  } catch (err) {
    errorMsg.value = err.message || '個別認証申請の送信に失敗しました。';
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

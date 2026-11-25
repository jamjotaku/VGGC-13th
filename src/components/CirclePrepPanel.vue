<template>
  <div class="p-3 md:p-5 max-w-4xl mx-auto space-y-4 pb-28 md:pb-10">

    <!-- 準備ビュー ヘッダー -->
    <div class="bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 text-white rounded-2xl p-4 md:p-5 shadow-md">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xl">🛠️</span>
            <h2 class="text-base md:text-lg font-black tracking-tight">サークル参加 準備ビュー</h2>
            <span v-if="isTestMode" class="px-2 py-0.5 rounded-full bg-indigo-500/90 border border-white/30 text-[10px] font-black">
              🧪 TEST MOCK DATA
            </span>
          </div>
          <p class="text-xs text-teal-50 mt-1">
            {{ EVENT_CONFIG.name }}（{{ EVENT_CONFIG.dateLabel }}・{{ EVENT_CONFIG.venue }}）に向けた入稿スケジュールと準備の受け皿です（ログイン不要）。
          </p>
        </div>

        <div class="bg-white/15 backdrop-blur-xs border border-white/20 rounded-xl px-3 py-1.5 text-right shrink-0">
          <div class="text-[10px] text-teal-100 font-bold">開催日まで</div>
          <div class="text-sm font-black font-mono">{{ eventCountdown.badge }}</div>
        </div>
      </div>
    </div>

    <!-- P3 当日自己点検カード（ログイン・紐づけ・オフラインキャッシュ確認） -->
    <section class="bg-white rounded-2xl border border-emerald-200 shadow-xs p-3.5 md:p-4 space-y-2.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <span class="text-base">🩺</span>
          <h3 class="font-extrabold text-xs md:text-sm text-slate-900">当日・前日 準備自己点検（P3チェック）</h3>
        </div>
        <button @click="$emit('open-circle-auth')"
                type="button"
                class="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold shadow-2xs cursor-pointer transition">
          🏪 サークル紐づけ / 招待コード
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div class="rounded-xl border p-2.5 flex items-center gap-2"
             :class="user ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'">
          <span class="text-sm shrink-0">{{ user ? '✅' : '⚪' }}</span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold opacity-80">1. アプリログイン（人の鍵）</div>
            <div class="font-extrabold truncate">{{ user ? userDisplayLabel : '未ログイン（紐づけ時に登録可）' }}</div>
          </div>
        </div>

        <div class="rounded-xl border p-2.5 flex items-center gap-2"
             :class="circleMemberships.length > 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'">
          <span class="text-sm shrink-0">{{ circleMemberships.length > 0 ? '✅' : '⚪' }}</span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold opacity-80">2. サークル名義の紐づけ</div>
            <div class="font-extrabold truncate">
              {{ circleMemberships.length > 0 ? `${circleMemberships.length}件 紐づけ済` : '未紐づけ（配置発表後／VC-）' }}
            </div>
          </div>
        </div>

        <div class="rounded-xl border p-2.5 flex items-center gap-2"
             :class="hasLocalOfflineReady ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'">
          <span class="text-sm shrink-0">{{ hasLocalOfflineReady ? '✅' : '⚠️' }}</span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold opacity-80">3. オフライン端末準備</div>
            <div class="font-extrabold truncate">
              {{ hasLocalOfflineReady ? (isOnline ? '端末保存済（オンライン）' : '圏外稼働OK（端末保存済）') : '初回データ保存待ち' }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- サブセクション1: 入稿目安カレンダー -->
    <section class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-3.5 md:p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50/70">
        <div>
          <h3 class="font-extrabold text-sm md:text-base text-gray-900 flex items-center gap-1.5">
            <span>📅</span>
            <span>印刷所 入稿締切カレンダー</span>
          </h3>
          <p class="text-[11px] text-gray-500 mt-0.5">
            <template v-if="printers.length > 0">
              ご自身の余裕日数（安全バッファ）を設定して、目標入稿日の目安を確認できます。
            </template>
            <template v-else>
              各印刷所の正式なイベント別締切表を公開待ちです。
            </template>
          </p>
        </div>

        <span v-if="deadlineData.lastUpdated" class="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg">
          最終更新: {{ deadlineData.lastUpdated }}
        </span>
      </div>

      <!-- 空状態（正式締切表 公開待ち） -->
      <div v-if="printers.length === 0" class="p-6 md:p-8 text-center space-y-4">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center text-2xl shadow-2xs">
          🗓️
        </div>
        <div class="space-y-1.5 max-w-md mx-auto">
          <h4 class="font-extrabold text-sm md:text-base text-gray-800">
            締切表は {{ deadlineData.expectedPublishWindow || '2026年12月〜2027年1月' }} に公開予定です
          </h4>
          <p class="text-xs text-gray-600 leading-relaxed">
            2027年3月6日（土）開催向けの正式な印刷所別スケジュールは、各社からの発表後に照合・反映されます。<br>
            確定までの間、不正確な日付で誤認を招かないよう現在はデータ未登録（準備枠）としています。
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span class="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[11px] font-bold">
            📌 スキーマ待機中（schema v{{ deadlineData.schemaVersion }}）
          </span>
        </div>
      </div>

      <!-- データ表示時（テストモード / 正式データ投入後） -->
      <div v-else class="p-3.5 md:p-4 space-y-3.5">
        <!-- コントロールバー（安全バッファ・フィルタ・並び順） -->
        <div class="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
              <span>🎯 安全バッファ:</span>
              <select v-model.number="safetyBufferDays"
                      class="h-8 px-2 text-xs font-bold bg-white border border-teal-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
                <option :value="0">0日（締切当日）</option>
                <option :value="2">2日前（推奨）</option>
                <option :value="3">3日前（余裕あり）</option>
                <option :value="5">5日前（安心）</option>
                <option :value="7">7日前（超安全）</option>
              </select>
            </label>

            <select v-model="filterSupportType"
                    class="h-8 px-2 text-xs font-bold bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
              <option value="all">対応種別: すべて ({{ printers.length }})</option>
              <option value="venue">会場対応（直接搬入）</option>
              <option value="event">イベント対応（要確認）</option>
              <option value="delivery_only">宅配搬入のみ</option>
            </select>
          </div>

          <select v-model="sortKey"
                  class="h-8 px-2 text-xs font-bold bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
            <option value="direct">並び: 直接搬入が早い順</option>
            <option value="normal">並び: 通常入稿が早い順</option>
            <option value="name">並び: 印刷所名順</option>
          </select>
        </div>

        <!-- 印刷所カード一覧 -->
        <div class="space-y-2.5">
          <div v-for="p in filteredAndSortedPrinters" :key="p.id"
               class="rounded-xl border border-gray-200 bg-white hover:border-teal-300 p-3.5 shadow-2xs transition space-y-2.5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="font-black text-sm text-gray-900">{{ p.name }}</h4>
                  <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold"
                        :class="SUPPORT_TYPE_LABELS[p.supportType]?.badgeClass || 'bg-gray-100 text-gray-700 border-gray-200'">
                    {{ SUPPORT_TYPE_LABELS[p.supportType]?.label || p.supportType }}
                  </span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded font-bold border"
                        :class="p.accuracy === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'">
                    {{ p.accuracy === 'confirmed' ? '公式確定' : '目安' }}
                  </span>
                </div>
              </div>

              <a v-if="p.officialUrl"
                 :href="p.officialUrl"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="text-[11px] font-bold text-teal-700 hover:underline shrink-0">
                公式サイト ↗
              </a>
            </div>

            <!-- 締切グリッド -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <!-- 直接搬入 -->
              <div class="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div class="text-[10px] font-bold text-slate-500">直接搬入（通常締切）</div>
                  <div class="font-black text-slate-900 font-mono mt-0.5">
                    {{ p.directDeliveryDeadline ? formatJstShortDate(p.directDeliveryDeadline) : '非対応 / 宅配のみ' }}
                  </div>
                  <div v-if="p.directDeliveryDeadline && safetyBufferDays > 0" class="text-[10px] text-teal-700 font-bold mt-0.5">
                    🎯 目標: {{ calculateSafeTargetDate(p.directDeliveryDeadline, safetyBufferDays)?.display }}
                  </div>
                </div>
                <span v-if="getDeadlineCountdown(p.directDeliveryDeadline)"
                      class="px-2 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0"
                      :class="countdownBadgeClass(getDeadlineCountdown(p.directDeliveryDeadline).tone)">
                  {{ getDeadlineCountdown(p.directDeliveryDeadline).label }}
                </span>
              </div>

              <!-- 通常入稿（宅配・自宅） -->
              <div class="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div class="text-[10px] font-bold text-slate-500">通常入稿（宅配搬入・自宅）</div>
                  <div class="font-black text-slate-900 font-mono mt-0.5">
                    {{ p.normalDeadline ? formatJstShortDate(p.normalDeadline) : '要確認' }}
                  </div>
                  <div v-if="p.normalDeadline && safetyBufferDays > 0" class="text-[10px] text-teal-700 font-bold mt-0.5">
                    🎯 目標: {{ calculateSafeTargetDate(p.normalDeadline, safetyBufferDays)?.display }}
                  </div>
                </div>
                <span v-if="getDeadlineCountdown(p.normalDeadline)"
                      class="px-2 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0"
                      :class="countdownBadgeClass(getDeadlineCountdown(p.normalDeadline).tone)">
                  {{ getDeadlineCountdown(p.normalDeadline).label }}
                </span>
              </div>
            </div>

            <!-- 割増・備考 -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
              <div class="space-y-0.5">
                <div v-if="p.hasSurcharge" class="text-amber-800 font-bold">
                  ⚡ 割増締切あり: {{ formatJstShortDate(p.surchargeDeadline) }} {{ p.surchargeRateText }}
                </div>
                <div v-if="p.notes">{{ p.notes }}</div>
              </div>
              <span v-if="p.lastCheckedAt" class="text-[10px] text-gray-400 font-mono shrink-0">
                確認日: {{ p.lastCheckedAt }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- サブセクション2: 無効化設定時のみ拡張予定スロットを表示 -->
    <section v-if="!showPrepTools" class="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-600 space-y-1.5">
      <div class="font-extrabold text-slate-800 flex items-center gap-1.5">
        <span>🧩</span>
        <span>サークル準備ツール 拡張予定エリア</span>
      </div>
      <p class="leading-relaxed text-[11px]">
        今後、準備チェックリスト・釣り銭準備プランナー・告知補助ツールなどを順次この「準備」ビューへ追加できる設計になっています。
      </p>
    </section>

    <!-- =========================================================
         T-065 P0 サークル準備便利機能群（端末内ローカル完結）
    ========================================================== -->
    <template v-else>

      <!-- ① 準備チェックリスト（撤収・宅配搬出メモ内包） -->
      <section class="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">
        <div class="p-3.5 md:p-4 border-b border-indigo-100 bg-indigo-50/60 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-extrabold text-sm md:text-base text-indigo-950 flex items-center gap-1.5">
              <span>✅</span>
              <span>① 準備チェックリスト（撤収・宅配搬出メモ内包）</span>
              <span v-if="isTestMode" class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">TEST先行</span>
            </h3>
            <p class="text-[11px] text-indigo-700 mt-0.5">持ち物・設営・撤収（宅配搬出）をこの端末内のみに保存します（ログイン不要）。</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-black text-indigo-900 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg">
              {{ checkedCount }} / {{ checklist.length }} 完了
            </span>
            <button @click="resetChecklist" class="text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer">初期化</button>
          </div>
        </div>

        <div class="p-3.5 md:p-4 space-y-3">
          <!-- 進捗バー -->
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-600 transition-all duration-300" :style="{ width: checklistProgress + '%' }"></div>
          </div>

          <!-- チェック項目 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label v-for="item in checklist" :key="item.id"
                   class="flex items-start gap-2 p-2.5 rounded-xl border transition cursor-pointer"
                   :class="item.done ? 'bg-indigo-50/40 border-indigo-200 text-slate-400' : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800'">
              <input type="checkbox" v-model="item.done" @change="saveChecklistState" class="mt-0.5 rounded text-indigo-600 cursor-pointer" />
              <div class="flex-1 min-w-0">
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-1">{{ item.category }}</span>
                <span class="text-xs font-bold" :class="item.done ? 'line-through' : ''">{{ item.label }}</span>
              </div>
              <button v-if="item.custom" @click.prevent="removeChecklistItem(item.id)" class="text-xs text-slate-400 hover:text-rose-600 px-1 cursor-pointer">×</button>
            </label>
          </div>

          <!-- 項目追加 -->
          <form @submit.prevent="addChecklistItem" class="flex gap-2">
            <input v-model="newChecklistText" type="text" placeholder="持ち物・撤収タスクを追加..."
                   class="flex-1 h-9 px-3 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" class="px-3.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl cursor-pointer">追加</button>
          </form>

          <!-- 撤収・宅配搬出メモ -->
          <div class="pt-2 border-t border-slate-100 space-y-1.5">
            <label class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <span>📦 撤収・宅配搬出メモ</span>
              <span class="text-[10px] font-normal text-slate-400">（集荷締切・伝票控え・梱包個数など）</span>
            </label>
            <textarea v-model="shippingMemo" @input="saveChecklistState" rows="2"
                      placeholder="例：ヤマト宅配搬出 16:00受付締切／着払い伝票は机左下／2箱予定"
                      class="w-full p-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"></textarea>
          </div>
        </div>
      </section>

      <!-- ② 釣り銭準備プランナー -->
      <section class="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
        <div class="p-3.5 md:p-4 border-b border-amber-100 bg-amber-50/70 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-extrabold text-sm md:text-base text-amber-950 flex items-center gap-1.5">
              <span>🪙</span>
              <span>② 釣り銭準備プランナー</span>
              <span v-if="isTestMode" class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">TEST先行</span>
            </h3>
            <p class="text-[11px] text-amber-800 mt-0.5">頒布価格と予定部数から、用意しておくべき釣り銭枚数・準備金額を試算します。</p>
          </div>
          <button v-if="selectedTestCircle" @click="importItemsFromSelectedCircle"
                  class="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-[11px] font-extrabold cursor-pointer">
            ↓ 選択サークルの品目を反映
          </button>
        </div>

        <div class="p-3.5 md:p-4 space-y-3.5">
          <div class="space-y-2">
            <div v-for="(row, idx) in plannerRows" :key="'plan_' + idx" class="flex flex-wrap items-center gap-2">
              <input v-model="row.label" @input="savePlannerState" type="text" placeholder="頒布物名"
                     class="flex-1 min-w-[120px] h-8 px-2.5 text-xs border border-slate-300 rounded-lg" />
              <div class="flex items-center gap-1">
                <input v-model.number="row.price" @input="savePlannerState" type="number" min="0" step="100"
                       class="w-20 h-8 px-2 text-xs font-mono text-right border border-slate-300 rounded-lg" />
                <span class="text-xs text-slate-500">円 ×</span>
              </div>
              <div class="flex items-center gap-1">
                <input v-model.number="row.qty" @input="savePlannerState" type="number" min="0" step="1"
                       class="w-16 h-8 px-2 text-xs font-mono text-right border border-slate-300 rounded-lg" />
                <span class="text-xs text-slate-500">部</span>
              </div>
              <button @click="removePlannerRow(idx)" class="text-xs text-slate-400 hover:text-rose-600 px-1.5 cursor-pointer">削除</button>
            </div>
            <button @click="addPlannerRow" class="text-xs font-extrabold text-amber-700 hover:text-amber-900 cursor-pointer">+ 価格帯を追加</button>
          </div>

          <!-- 想定支払い金種比率 -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center gap-3 text-xs">
            <span class="font-extrabold text-slate-700">想定支払い割合:</span>
            <label class="flex items-center gap-1">1,000円札 <input v-model.number="paymentMix.ratio1000" @input="savePlannerState" type="number" min="0" max="100" class="w-12 h-7 px-1 text-center font-mono border rounded bg-white" />%</label>
            <label class="flex items-center gap-1">5,000円札 <input v-model.number="paymentMix.ratio5000" @input="savePlannerState" type="number" min="0" max="100" class="w-12 h-7 px-1 text-center font-mono border rounded bg-white" />%</label>
            <label class="flex items-center gap-1">10,000円札 <input v-model.number="paymentMix.ratio10000" @input="savePlannerState" type="number" min="0" max="100" class="w-12 h-7 px-1 text-center font-mono border rounded bg-white" />%</label>
          </div>

          <!-- 試算結果 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div class="text-[10px] font-bold text-amber-800">1,000円札</div>
              <div class="text-base font-black font-mono text-amber-950">{{ changePlan.need1000Bills }} 枚</div>
            </div>
            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div class="text-[10px] font-bold text-amber-800">500円玉</div>
              <div class="text-base font-black font-mono text-amber-950">{{ changePlan.need500Coins }} 枚</div>
            </div>
            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div class="text-[10px] font-bold text-amber-800">100円玉</div>
              <div class="text-base font-black font-mono text-amber-950">{{ changePlan.need100Coins }} 枚</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900 text-white text-center">
              <div class="text-[10px] font-bold text-amber-300">釣り銭準備合計</div>
              <div class="text-base font-black font-mono">¥{{ changePlan.totalPrepareAmount.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ③ ワンタップ告知ポスト＋直リンク（?circle=...） & ⑤ 見え方プレビュー（サークルデータ公開後またはテストモード時に有効） -->
      <section v-if="selectableCircles.length > 0" class="bg-white rounded-2xl border border-sky-200 shadow-xs overflow-hidden">
        <div class="p-3.5 md:p-4 border-b border-sky-100 bg-sky-50/70 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-extrabold text-sm md:text-base text-sky-950 flex items-center gap-1.5">
              <span>📣</span>
              <span>③ ワンタップ告知ポスト＋直リンク ＆ ⑤ 見え方プレビュー</span>
              <span v-if="isTestMode" class="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">TEST先行</span>
            </h3>
            <p class="text-[11px] text-sky-800 mt-0.5">サークルを選んで直リンク告知文の生成と、一般側（オンライン／圏外）の見え方を確認できます。</p>
          </div>
        </div>

        <div class="p-3.5 md:p-4 space-y-3.5">
          <!-- サークル選択 -->
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-xs font-extrabold text-slate-700">対象サークル:</label>
            <select v-model="selectedCircleId" class="flex-1 min-w-[200px] h-9 px-2.5 text-xs font-bold bg-white border border-slate-300 rounded-xl">
              <option v-for="c in selectableCircles" :key="c.circle_id" :value="c.circle_id">
                {{ c.space_sym }}-{{ c.space_num }} {{ c.circle_name }}
              </option>
            </select>
          </div>

          <!-- ⑤ 見え方プレビュー起動ボタン -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs">
              <div class="font-extrabold text-slate-800">👁️ ⑤ 自分のサークルの一般側見え方プレビュー</div>
              <div class="text-[11px] text-slate-500">詳細モーダルを開いて、オンライン時・圏外（オフライン）時の表示を確認します。</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button @click="triggerPreview(false)" :disabled="!selectedTestCircle"
                      class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">
                🌐 オンラインで見る
              </button>
              <button @click="triggerPreview(true)" :disabled="!selectedTestCircle"
                      class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">
                📡 圏外表示を見る
              </button>
            </div>
          </div>

          <!-- ③ 直リンク＋告知文 -->
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <input :value="circleShareUrl" readonly type="text"
                     class="flex-1 min-w-[200px] h-8 px-2.5 text-[11px] font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-700" />
              <button @click="copyText(circleShareUrl, '直リンクURLをコピーしました')"
                      class="px-3 h-8 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer">
                🔗 URLコピー
              </button>
            </div>

            <input v-model="announcementNote" type="text" placeholder="告知への一言コメント（例：新刊委託あります／先着ノベルティあり）"
                   class="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg" />

            <textarea :value="announcementText" readonly rows="6"
                      class="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-sans leading-relaxed"></textarea>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] font-bold text-emerald-700">{{ copyFeedback }}</span>
              <div class="flex gap-2">
                <button @click="copyText(announcementText, '告知文をコピーしました')"
                        class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold rounded-xl cursor-pointer">
                  📋 告知文コピー
                </button>
                <a :href="xIntentUrl" target="_blank" rel="noopener noreferrer"
                   class="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl inline-flex items-center gap-1">
                  <span>𝕏 ポスト画面を開く</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ④ お釣り早見表（テストモード用プレビュー：本体はレジ画面内） -->
      <section v-if="isTestMode" class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <div class="text-xs font-extrabold text-slate-700">
            💴 ④ お釣り早見表（本体はレジ画面に搭載／未ログインテスト用プレビュー）
          </div>
          <button @click="showInlineChangeTable = !showInlineChangeTable"
                  class="text-xs font-extrabold text-amber-700 hover:text-amber-900 cursor-pointer">
            {{ showInlineChangeTable ? '▲ 閉じる' : '▼ 早見表を開く' }}
          </button>
        </div>
        <ChangeTableWidget v-if="showInlineChangeTable" :products="selectedTestCircleItems" />
      </section>

    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { EVENT_CONFIG } from '../eventConfig';
import { getEventCountdown } from '../utils/countdown';
import { ENABLE_TEST_MODE, getTestStorageKey } from '../utils/testMode';
import staticPrintDeadlines from '../data/printDeadlines.json';
import {
  SUPPORT_TYPE_LABELS,
  getDeadlineCountdown,
  calculateSafeTargetDate,
  formatJstShortDate,
  getMockPrintDeadlines
} from '../utils/prepCalendar';
import {
  DEFAULT_PREP_CHECKLIST,
  calculateChangePlan,
  buildCircleShareUrl,
  buildAnnouncementText
} from '../utils/prepTools';
import ChangeTableWidget from './ChangeTableWidget.vue';

const props = defineProps({
  isTestMode: { type: Boolean, default: false },
  circles: { type: Array, default: () => [] },
  circleExtraInfo: { type: Object, default: () => ({}) },
  user: { type: Object, default: null },
  circleMemberships: { type: Array, default: () => [] },
  isOnline: { type: Boolean, default: true }
});

const emit = defineEmits(['preview-circle', 'open-circle-auth']);

const showPrepTools = computed(() => props.isTestMode || Boolean(EVENT_CONFIG.circleAuth?.enableP0PrepToolsPublic));

const userDisplayLabel = computed(() => {
  const email = props.user?.email || '';
  if (!email) return 'ログイン中';
  return `@${email.split('@')[0]}`;
});

const hasLocalOfflineReady = computed(() => {
  try {
    if (props.isTestMode) return true;
    return Boolean(
      localStorage.getItem(EVENT_CONFIG.storageKey('data_cache')) ||
      localStorage.getItem(EVENT_CONFIG.storageKey('circle_memberships_cache')) ||
      localStorage.getItem(EVENT_CONFIG.storageKey('prep_checklist_v1'))
    );
  } catch {
    return false;
  }
});

const enableTestMode = ENABLE_TEST_MODE;
const safetyBufferDays = ref(2);
const filterSupportType = ref('all');
const sortKey = ref('direct');

const eventCountdown = computed(() => getEventCountdown());

const deadlineData = computed(() => {
  return props.isTestMode ? getMockPrintDeadlines() : staticPrintDeadlines;
});

const printers = computed(() => deadlineData.value?.printers || []);

const filteredAndSortedPrinters = computed(() => {
  let list = [...printers.value];
  if (filterSupportType.value !== 'all') {
    list = list.filter((p) => p.supportType === filterSupportType.value);
  }

  list.sort((a, b) => {
    if (sortKey.value === 'name') {
      return String(a.name).localeCompare(String(b.name), 'ja');
    }
    const field = sortKey.value === 'normal' ? 'normalDeadline' : 'directDeliveryDeadline';
    const da = a[field] || '9999-12-31';
    const db = b[field] || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return String(a.name).localeCompare(String(b.name), 'ja');
  });

  return list;
});

const countdownBadgeClass = (tone) => {
  if (tone === 'ended') return 'bg-gray-200 text-gray-600';
  if (tone === 'urgent') return 'bg-rose-600 text-white animate-pulse';
  if (tone === 'warning') return 'bg-amber-100 text-amber-900 border border-amber-300';
  return 'bg-teal-100 text-teal-900';
};

// =========================================================
// T-065 準備ツール ロジック（通常/テストでストレージ分離）
// =========================================================
const CHECKLIST_STORAGE_KEY = props.isTestMode
  ? getTestStorageKey('prep_checklist_v1')
  : EVENT_CONFIG.storageKey('prep_checklist_v1');
const PLANNER_STORAGE_KEY = props.isTestMode
  ? getTestStorageKey('change_planner_v1')
  : EVENT_CONFIG.storageKey('change_planner_v1');

const loadInitialChecklist = () => {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.items)) return parsed;
    }
  } catch {}
  return {
    items: DEFAULT_PREP_CHECKLIST.map((x) => ({ ...x })),
    shippingMemo: ''
  };
};

const initialChecklist = loadInitialChecklist();
const checklist = ref(initialChecklist.items);
const shippingMemo = ref(initialChecklist.shippingMemo || '');
const newChecklistText = ref('');

const checkedCount = computed(() => checklist.value.filter((i) => i.done).length);
const checklistProgress = computed(() => {
  if (checklist.value.length === 0) return 0;
  return Math.round((checkedCount.value / checklist.value.length) * 100);
});

const saveChecklistState = () => {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify({
      items: checklist.value,
      shippingMemo: shippingMemo.value
    }));
  } catch {}
};

const addChecklistItem = () => {
  const text = newChecklistText.value.trim();
  if (!text) return;
  checklist.value.push({
    id: `chk_custom_${Date.now()}`,
    category: 'メモ追加',
    label: text,
    done: false,
    custom: true
  });
  newChecklistText.value = '';
  saveChecklistState();
};

const removeChecklistItem = (id) => {
  checklist.value = checklist.value.filter((i) => i.id !== id);
  saveChecklistState();
};

const resetChecklist = () => {
  checklist.value = DEFAULT_PREP_CHECKLIST.map((x) => ({ ...x }));
  shippingMemo.value = '';
  saveChecklistState();
};

// ② 釣り銭準備プランナー
const loadInitialPlanner = () => {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.rows)) return parsed;
    }
  } catch {}
  return {
    rows: [
      { label: '新刊イラスト本', price: 1000, qty: 30 },
      { label: '既刊／グッズ', price: 500, qty: 20 },
      { label: 'アクスタ等', price: 1500, qty: 15 }
    ],
    mix: { ratio1000: 60, ratio5000: 25, ratio10000: 15 }
  };
};

const initialPlanner = loadInitialPlanner();
const plannerRows = ref(initialPlanner.rows);
const paymentMix = ref(initialPlanner.mix);
const changePlan = computed(() => calculateChangePlan(plannerRows.value, paymentMix.value));

const savePlannerState = () => {
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({
      rows: plannerRows.value,
      mix: paymentMix.value
    }));
  } catch {}
};

const addPlannerRow = () => {
  plannerRows.value.push({ label: '追加頒布物', price: 1000, qty: 10 });
  savePlannerState();
};

const removePlannerRow = (idx) => {
  plannerRows.value.splice(idx, 1);
  savePlannerState();
};

// ③ 告知ポスト & ⑤ プレビュー用サークル選択
const selectableCircles = computed(() => (props.circles || []).slice(0, 20));
const selectedCircleId = ref('');

watch(selectableCircles, (list) => {
  if (!selectedCircleId.value && list.length > 0) {
    selectedCircleId.value = list[2]?.circle_id || list[0].circle_id;
  }
}, { immediate: true });

const selectedTestCircle = computed(() => {
  return (props.circles || []).find((c) => c.circle_id === selectedCircleId.value) || null;
});

const selectedTestCircleExtra = computed(() => {
  if (!selectedCircleId.value) return null;
  return props.circleExtraInfo?.[selectedCircleId.value] || null;
});

const selectedTestCircleItems = computed(() => selectedTestCircleExtra.value?.items || []);

const importItemsFromSelectedCircle = () => {
  const items = selectedTestCircleItems.value.filter((i) => Number(i.price) > 0);
  if (items.length === 0) return;
  plannerRows.value = items.slice(0, 8).map((i) => ({
    label: i.name,
    price: Number(i.price),
    qty: 15
  }));
  savePlannerState();
};

const announcementNote = ref('');
const copyFeedback = ref('');
const showInlineChangeTable = ref(false);

const circleShareUrl = computed(() => {
  if (!selectedTestCircle.value || typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const currentParams = new URLSearchParams(window.location.search);
  const extraParams = {};
  if (props.isTestMode && currentParams.get('mode') === 'test') {
    extraParams.mode = 'test';
    if (currentParams.get('key')) extraParams.key = currentParams.get('key');
  }
  return buildCircleShareUrl(base, selectedTestCircle.value.circle_id, extraParams);
});

const announcementText = computed(() => buildAnnouncementText({
  circle: selectedTestCircle.value,
  extra: selectedTestCircleExtra.value,
  shareUrl: circleShareUrl.value,
  customNote: announcementNote.value
}));

const xIntentUrl = computed(() => {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(announcementText.value)}`;
});

const copyText = async (text, msg) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyFeedback.value = msg;
    setTimeout(() => { copyFeedback.value = ''; }, 2500);
  } catch {
    copyFeedback.value = 'コピーに失敗しました';
  }
};

const triggerPreview = (offlineMode) => {
  if (!selectedTestCircle.value) return;
  emit('preview-circle', {
    circle: selectedTestCircle.value,
    offline: Boolean(offlineMode)
  });
};
</script>

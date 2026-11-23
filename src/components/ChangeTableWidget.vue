<template>
  <div class="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
    <div class="px-3.5 py-2.5 bg-amber-50/90 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-1.5">
        <span class="text-base">💴</span>
        <span class="font-extrabold text-xs md:text-sm text-amber-950">お釣り早見表</span>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">通信ゼロ</span>
      </div>
      <div class="flex items-center gap-1.5">
        <label class="text-[11px] font-bold text-amber-900">お会計額:</label>
        <input
          v-model.number="customAmount"
          type="number"
          min="0"
          step="50"
          placeholder="任意金額"
          class="w-24 h-7 px-2 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
        />
        <span class="text-xs font-bold text-amber-900">円</span>
      </div>
    </div>

    <!-- 任意金額の即時お釣りカード -->
    <div v-if="Number(customAmount) > 0" class="px-3.5 py-2.5 bg-amber-50/40 border-b border-amber-100 grid grid-cols-3 gap-2 text-center">
      <div v-for="bill in [1000, 5000, 10000]" :key="'custom_' + bill"
           class="rounded-xl border p-2"
           :class="Number(customAmount) <= bill ? 'bg-white border-amber-200' : 'bg-gray-50 border-gray-200 opacity-50'">
        <div class="text-[10px] font-bold text-gray-500">{{ bill.toLocaleString() }}円札</div>
        <div class="text-sm font-black font-mono mt-0.5"
             :class="Number(customAmount) <= bill ? 'text-amber-800' : 'text-gray-400'">
          {{ Number(customAmount) <= bill ? `¥${(bill - Number(customAmount)).toLocaleString()}` : '不足' }}
        </div>
        <div v-if="Number(customAmount) < bill" class="text-[10px] text-gray-500 mt-0.5 leading-tight">
          {{ formatChangeBreakdown(bill - Number(customAmount)) }}
        </div>
      </div>
    </div>

    <!-- 早見表テーブル -->
    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse">
        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px]">
          <tr>
            <th class="px-3 py-2 font-extrabold">品目 / 合計額</th>
            <th class="px-2.5 py-2 font-extrabold text-right">1,000円札</th>
            <th class="px-2.5 py-2 font-extrabold text-right">5,000円札</th>
            <th class="px-2.5 py-2 font-extrabold text-right">10,000円札</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="row in tableRows" :key="row.key"
              @click="customAmount = row.price"
              class="hover:bg-amber-50/50 cursor-pointer transition">
            <td class="px-3 py-2">
              <div class="font-bold text-slate-800 truncate max-w-[160px] sm:max-w-[220px]">{{ row.label }}</div>
              <div class="text-[11px] font-mono font-black text-slate-600">¥{{ row.price.toLocaleString() }}</div>
            </td>
            <td v-for="bill in [1000, 5000, 10000]" :key="row.key + '_' + bill" class="px-2.5 py-2 text-right align-top">
              <template v-if="row.price <= bill">
                <div class="font-mono font-black text-slate-900">¥{{ (bill - row.price).toLocaleString() }}</div>
                <div v-if="bill - row.price > 0" class="text-[10px] text-slate-500 whitespace-nowrap">
                  {{ formatChangeBreakdown(bill - row.price) }}
                </div>
              </template>
              <span v-else class="text-[10px] text-slate-300">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  products: {
    type: Array,
    default: () => []
  }
});

const customAmount = ref(1500);

const DEFAULT_PRESETS = [
  { key: 'p_500', label: '定番 500円', price: 500 },
  { key: 'p_800', label: '定番 800円', price: 800 },
  { key: 'p_1000', label: '定番 1,000円', price: 1000 },
  { key: 'p_1500', label: '定番 1,500円', price: 1500 },
  { key: 'p_2000', label: '定番 2,000円', price: 2000 },
  { key: 'p_2500', label: '定番 2,500円', price: 2500 },
  { key: 'p_3000', label: '定番 3,000円', price: 3000 },
  { key: 'p_5000', label: 'セット 5,000円', price: 5000 }
];

const tableRows = computed(() => {
  const validProducts = (props.products || [])
    .filter((p) => Number(p?.price) > 0)
    .slice(0, 10)
    .map((p, idx) => ({
      key: `prod_${idx}_${p.name}`,
      label: p.name,
      price: Number(p.price)
    }));

  if (validProducts.length > 0) {
    return validProducts;
  }
  return DEFAULT_PRESETS;
});

function formatChangeBreakdown(change) {
  let rem = Math.max(0, Math.floor(change));
  if (rem === 0) return 'お釣りなし';
  const denoms = [
    [5000, '5千'],
    [1000, '千'],
    [500, '500'],
    [100, '100'],
    [50, '50'],
    [10, '10']
  ];
  const parts = [];
  for (const [val, label] of denoms) {
    const cnt = Math.floor(rem / val);
    if (cnt > 0) {
      parts.push(`${label}×${cnt}`);
      rem %= val;
    }
  }
  if (rem > 0) parts.push(`1×${rem}`);
  return parts.join(' ');
}
</script>

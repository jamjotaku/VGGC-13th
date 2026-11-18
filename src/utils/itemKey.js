// src/utils/itemKey.js
// お品書き品目の個体キー生成・後方互換解決ヘルパー
// 同サークル内に同名・価格違いの品目が複数あっても独立して選択・集計できるようにする。

const KEY_SEP = '::';

/**
 * 品目ごとの一意な個体キーを生成する
 * - item.id がある場合はそれを使用
 * - 無い場合は配列インデックス + 品名 + 価格で一意化
 */
export function getCircleItemKey(item, idx) {
  if (!item) return String(idx ?? '');
  if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') {
    return String(item.id);
  }
  const safeName = String(item.name || '');
  const safePrice = Number(item.price) || 0;
  return `${idx}${KEY_SEP}${safeName}${KEY_SEP}${safePrice}`;
}

/**
 * 保存済みキーから表示用の品目名を復元する
 * - 新形式（"idx::品名::価格"）は品名部分を抽出
 * - 旧形式（品名そのまま）や item.id 形式はそのまま返す（items配列があれば名前引当も可能）
 */
export function getCircleItemDisplayName(savedKey, items = []) {
  const raw = String(savedKey || '');
  if (raw.includes(KEY_SEP)) {
    const parts = raw.split(KEY_SEP);
    if (parts.length >= 2) return parts.slice(1, parts.length - 1).join(KEY_SEP) || parts[1];
  }
  if (Array.isArray(items) && items.length > 0) {
    const matched = items.find((it, idx) => getCircleItemKey(it, idx) === raw);
    if (matched?.name) return matched.name;
  }
  return raw;
}

/**
 * savedList エントリ内から対象品目の保存キーを解決する（新キー優先、旧名前キー後方互換）
 */
export function resolveSavedItemKey(saved, item, idx) {
  if (!saved || !Array.isArray(saved.selectedItems) || !item) return null;
  const newKey = getCircleItemKey(item, idx);
  if (saved.selectedItems.includes(newKey)) return newKey;
  if (item.name && saved.selectedItems.includes(item.name)) return item.name;
  return null;
}

/**
 * 保存済み数量を取得（未選択時は 0）
 */
export function getSavedItemQuantity(saved, item, idx) {
  const matchedKey = resolveSavedItemKey(saved, item, idx);
  if (!matchedKey) return 0;
  return Number(saved.itemQuantities?.[matchedKey]) || 1;
}

/**
 * 選択済み品目の合計金額を計算（新キー・旧名前キー両対応）
 */
export function calculateSelectedItemsTotal(items, saved) {
  if (!Array.isArray(items) || !saved || !Array.isArray(saved.selectedItems)) return 0;
  return items.reduce((sum, it, idx) => {
    const qty = getSavedItemQuantity(saved, it, idx);
    if (qty <= 0) return sum;
    return sum + (Number(it.price) || 0) * qty;
  }, 0);
}

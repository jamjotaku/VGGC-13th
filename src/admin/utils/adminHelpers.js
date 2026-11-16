// src/admin/utils/adminHelpers.js
import { vspoDict } from '../../constants';
export { parseOshinagakiUrls, parseOshinagakiUrlType } from '../../utils/xSearch';

export const vspoMembersPalette = vspoDict.map(m => ({
  name: m.name,
  mark: (m.fanmarks || []).join('')
}));

export const presetTags = [
  '新刊', '既刊', 'イラスト本', '漫画', '小説', '合同誌', '新刊セット', 'グッズセット',
  'アクスタ', 'アクキー', 'ステッカー', '缶バッジ', 'タペストリー', '色紙', 'ポストカード',
  'クリアファイル', 'チェキ風カード', 'Tシャツ', 'トートバッグ', 'プレイマット', 'スリーブ',
  'キーキャップ', 'デスクマット', 'ぬいぐるみ', 'コースター', 'グラス'
];

export const quickItemPresets = [
  { name: '新刊', price: 500 },
  { name: '新刊（フルカラーイラスト本）', price: 1000 },
  { name: '新刊セット', price: 2000 },
  { name: '既刊', price: 500 },
  { name: 'アクリルスタンド', price: 1500 },
  { name: 'アクリルキーホルダー', price: 800 },
  { name: 'ステッカー', price: 300 },
  { name: '缶バッジ', price: 500 },
  { name: 'タペストリー', price: 3000 },
  { name: 'チェキ風カード', price: 300 }
];

export const parseCommaTokens = (str) => {
  if (!str) return [];
  return String(str).split(/[,、]+/).map(s => s.trim()).filter(Boolean);
};

export const cleanTwitterId = (id) => {
  if (!id) return '';
  return String(id).trim().replace(/^@+/, '');
};

export const parseSingleAccount = (token) => {
  if (!token) return null;
  const s = String(token).trim();
  if (!s) return null;
  const colonMatch = s.match(/^([^:：]+)[:：]\s*@?([A-Za-z0-9_]+)$/);
  if (colonMatch) {
    return { name: colonMatch[1].trim(), handle: colonMatch[2] };
  }
  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
  if (urlMatch && !['i', 'intent', 'search', 'hashtag'].includes(urlMatch[1].toLowerCase())) {
    return { name: null, handle: urlMatch[1] };
  }
  const handle = cleanTwitterId(s);
  if (handle && /^[A-Za-z0-9_]+$/.test(handle)) {
    return { name: null, handle };
  }
  return null;
};

export const parseAccounts = (str) => {
  if (!str) return [];
  const tokens = String(str).split(/[,、\s/]+/).map(t => t.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();
  for (const t of tokens) {
    const parsed = parseSingleAccount(t);
    if (parsed && parsed.handle && !seen.has(parsed.handle.toLowerCase())) {
      seen.add(parsed.handle.toLowerCase());
      results.push(parsed);
    }
  }
  return results;
};

export const extractTwitterIdFromUrl = (url) => {
  if (!url) return null;
  const match = String(url).match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)\/status\//i);
  if (match && match[1] && !['i', 'web'].includes(match[1].toLowerCase())) {
    return match[1];
  }
  return null;
};

/**
 * 一括テキスト入力 ("新刊セット ¥1,500" 等) を商品配列へパース
 */
export const parseBulkItemsText = (bulkText) => {
  const lines = String(bulkText || '').split('\n');
  const parsed = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.*?)\s*[¥￥]?\s*([0-9０-９,、]+)\s*円?$/);
    if (match && match[1].trim()) {
      const name = match[1].replace(/[:：\-\s]+$/, '').trim();
      const normalizedNum = match[2].replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/[,、]/g, '');
      const price = parseInt(normalizedNum, 10);
      if (name && !isNaN(price)) {
        parsed.push({ name, price });
        continue;
      }
    }
    parsed.push({ name: trimmed, price: 0 });
  }
  return parsed;
};

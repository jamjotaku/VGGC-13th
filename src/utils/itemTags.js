// src/utils/itemTags.js
// T-076（お品書き品目タグ統制語彙・自動集約・品目単位検索）＆ T-072（かな正規化検索）共通モジュール

export const GOODS_TYPE_VOCAB = [
  // 本・冊子
  '写真集', 'イラスト本', '漫画本', '小説本', '設定資料集', '合同誌',
  // アクリル系
  'アクリルスタンド', 'アクリルキーホルダー', 'アクリルブロック', 'アクリルマグネット',
  'アクリルバッジ', 'アクリルチャーム', 'アクリルコースター',
  // 紙・印刷物
  'ポストカード', 'ステッカー', 'カード', '色紙', 'クリアファイル', 'ポスター', 'カレンダー', 'ペーパー',
  // 小物・雑貨
  '缶バッジ', 'キーホルダー', 'ストラップ・チャーム', 'タペストリー', 'ぬいぐるみ', 'フィギュア',
  'マグカップ', 'コースター', 'うちわ', '文具', 'アクセサリー', '眼鏡クロス', 'キャンバスアート',
  // 布・衣類
  'Tシャツ', 'アパレル', 'バッグ', 'ポーチ', 'タオル', '帽子',
  // TCG・ゲーム
  'プレイマット', 'スリーブ', 'TCG用品', 'ゲーム',
  // メディア
  'CD・映像',
  // その他
  'その他'
];

export const ATTRIBUTE_VOCAB = ['セット', 'ランダム', '購入特典', '無料配布'];

const GOODS_TYPE_SET = new Set(GOODS_TYPE_VOCAB);
const ATTRIBUTE_SET = new Set(ATTRIBUTE_VOCAB);

/**
 * 検索用テキスト正規化（小文字化＋ひらがな→カタカナ変換）
 * T-072: ペンネーム・サークル名・読み仮名の表記ゆれ吸収用
 */
export function normalizeSearchText(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

function toStringArray(val) {
  if (Array.isArray(val)) {
    return val.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return val.split(/[,、/／\n]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 品目レコードを新旧両互換形式で正規化
 */
export function normalizeItemRecord(raw) {
  if (!raw || typeof raw !== 'object') {
    return { name: '', price: 0, note: '', characters: [], goods_types: [], attributes: [] };
  }
  const goodsTypes = raw.goods_types !== undefined
    ? toStringArray(raw.goods_types)
    : toStringArray(raw.goods_type);

  const normalized = {
    name: String(raw.name || '').trim(),
    price: Math.max(0, Number(raw.price) || 0),
    note: String(raw.note || '').trim(),
    characters: toStringArray(raw.characters),
    goods_types: goodsTypes,
    attributes: toStringArray(raw.attributes)
  };
  if (raw.soldout !== undefined) {
    normalized.soldout = Boolean(raw.soldout);
  }
  return normalized;
}

/**
 * items 配列からサークル単位の members / tags を自動集約（二重管理防止）
 */
export function aggregateCircleTagsFromItems(items = []) {
  const memberSet = new Set();
  const tagSet = new Set();

  for (const raw of items || []) {
    const it = normalizeItemRecord(raw);
    it.characters.forEach((c) => memberSet.add(c));
    it.goods_types.forEach((g) => tagSet.add(g));
    it.attributes.forEach((a) => tagSet.add(a));
  }

  return {
    members: Array.from(memberSet),
    tags: Array.from(tagSet)
  };
}

/**
 * 統制語彙チェック（未知のキャラ名・グッズ種類・属性タグを検出して警告を返す）
 */
export function validateItemsVocabulary(items = [], validCharacters = []) {
  const charSet = new Set((validCharacters || []).map((c) => String(c).trim()).filter(Boolean));
  const warnings = [];

  (items || []).forEach((raw, idx) => {
    const it = normalizeItemRecord(raw);
    const label = it.name || `品目#${idx + 1}`;

    if (charSet.size > 0) {
      it.characters.forEach((c) => {
        if (!charSet.has(c)) {
          warnings.push(`[${label}] 未登録キャラ名: "${c}"`);
        }
      });
    }
    it.goods_types.forEach((g) => {
      if (!GOODS_TYPE_SET.has(g)) {
        warnings.push(`[${label}] 統制語彙外のgoods_types: "${g}"`);
      }
    });
    it.attributes.forEach((a) => {
      if (!ATTRIBUTE_SET.has(a)) {
        warnings.push(`[${label}] 統制語彙外のattributes: "${a}"`);
      }
    });
  });

  return warnings;
}

/**
 * サークル単位・品目単位を統合した検索＆絞り込み判定
 */
export function matchesCircleQueryAndTags(circle, extra = {}, { query = '', selectedMembers = [], filterItemTag = '' } = {}) {
  const nq = normalizeSearchText(query);
  const items = Array.isArray(extra?.items) ? extra.items.map(normalizeItemRecord) : [];

  if (nq) {
    const spaceFull = normalizeSearchText(`${circle.space_sym || ''}-${circle.space_num || ''}`);
    const spaceCompact = normalizeSearchText(`${circle.space_sym || ''}${circle.space_num || ''}`);

    const matchBasic =
      normalizeSearchText(circle.circle_name).includes(nq) ||
      normalizeSearchText(circle.circle_kana).includes(nq) ||
      normalizeSearchText(circle.penname).includes(nq) ||
      normalizeSearchText(circle.penname_kana).includes(nq) ||
      spaceFull.includes(nq) ||
      spaceCompact.includes(nq);

    const matchItem = items.some((it) =>
      normalizeSearchText(it.name).includes(nq) ||
      normalizeSearchText(it.note).includes(nq) ||
      it.characters.some((c) => normalizeSearchText(c).includes(nq)) ||
      it.goods_types.some((g) => normalizeSearchText(g).includes(nq)) ||
      it.attributes.some((a) => normalizeSearchText(a).includes(nq))
    );

    if (!matchBasic && !matchItem) return false;
  }

  const hasMemberFilter = Array.isArray(selectedMembers) && selectedMembers.length > 0;
  const hasTagFilter = Boolean(filterItemTag);

  if (!hasMemberFilter && !hasTagFilter) return true;

  const hasTaggedItems = items.some(
    (it) => it.characters.length > 0 || it.goods_types.length > 0 || it.attributes.length > 0
  );

  // キャラ＋グッズ種類の掛け合わせ時、品目タグがあるサークルは「同一品目で両方一致」を厳密判定
  if (hasMemberFilter && hasTagFilter && hasTaggedItems) {
    return items.some((it) => {
      const itemCharOk = selectedMembers.some((m) => it.characters.includes(m));
      const itemTagOk = it.goods_types.includes(filterItemTag) || it.attributes.includes(filterItemTag);
      return itemCharOk && itemTagOk;
    });
  }

  const circleMembers = new Set([
    ...(Array.isArray(extra?.members) ? extra.members : []),
    ...items.flatMap((it) => it.characters)
  ]);
  const circleTags = new Set([
    ...(Array.isArray(extra?.tags) ? extra.tags : []),
    ...items.flatMap((it) => [...it.goods_types, ...it.attributes])
  ]);

  const matchMember = !hasMemberFilter || selectedMembers.some((m) => circleMembers.has(m));
  const matchTag = !hasTagFilter || circleTags.has(filterItemTag);
  return matchMember && matchTag;
}

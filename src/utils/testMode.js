// src/utils/testMode.js
// VGGC 13th テストモード（?mode=test）用の疎結合モジュール
// 本番データ公開時は ENABLE_TEST_MODE を false にするか本モジュールの利用箇所を外すだけで無効化できます。

export const ENABLE_TEST_MODE = true;

const TEST_SESSION_KEY = 'vggc13th_test_mode_active';
const TEST_STORAGE_PREFIX = 'vggc13th_test_';

/**
 * 現在のセッションがテストモードかどうかを判定する
 * - ?mode=test でテストモードを有効化（sessionStorage にも保持）
 * - ?mode=normal または ?mode=exit で通常モードへ復帰
 */
export function isTestModeActive() {
  if (!ENABLE_TEST_MODE || typeof window === 'undefined') {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'test') {
      window.sessionStorage.setItem(TEST_SESSION_KEY, '1');
      return true;
    }
    if (modeParam === 'normal' || modeParam === 'exit') {
      window.sessionStorage.removeItem(TEST_SESSION_KEY);
      return false;
    }
    return window.sessionStorage.getItem(TEST_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * テストモードを終了し、通常モードのURLへリロード遷移する
 */
export function exitTestMode() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(TEST_SESSION_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') === 'test') {
      url.searchParams.delete('mode');
    }
    window.location.assign(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * テストモード専用の localStorage キーを生成する（本番データと完全分離）
 */
export function getTestStorageKey(name) {
  return `${TEST_STORAGE_PREFIX}${name}`;
}

/**
 * シード固定の擬似乱数生成器（Mulberry32）
 */
function createSeededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX_WORDS = [
  'アトリエ', '星屑', '蒼穹', '放課後', '夜明けの', 'まったり', '電脳', '虹色',
  'ぽかぽか', '秘密の', '琥珀', '無重力', 'そよ風', '月見', 'きらめき', 'ねこみみ',
  '終電', 'ふわふわ', '青空', '流星群'
];

const SUFFIX_WORDS = [
  '堂', '屋', '製作所', 'ラボ', '日和', 'クラブ', '支部', '計画', '同盟', 'カフェ',
  '商会', '工房', 'スタジオ', '文庫', '記録室', '喫茶', '横丁', '百貨店', '研究所', '本舗'
];

const ITEM_TYPES = [
  '新刊イラスト本', 'フルカラー合同誌', 'アクリルスタンド', '缶バッジセット',
  'ホログラムステッカー', 'クリアファイル', 'ミニ色紙', '無配ペーパー', 'ラフ画集', 'キーホルダー'
];

const PRICE_POOL = [0, 100, 300, 500, 700, 1000, 1200, 1500, 2000, 2500, 3000];

/**
 * 既存マップ座標 (map_coords.json) とメンバーマスタ (vspoDict) から
 * シード固定でリアルなダミーサークルデータ＆追加情報を自動生成する
 */
export function generateMockEventData({
  mapCoords = {},
  vspoList = [],
  count = 240,
  seed = 20270306
} = {}) {
  const rng = createSeededRng(seed);

  // スペースキー（例: A-01, M-15）を抽出し、ブロック→番号順に整列
  const spaceKeys = Object.keys(mapCoords)
    .filter((key) => /^[A-Z]+-\d+$/.test(key))
    .sort((a, b) => {
      const [ba, na] = a.split('-');
      const [bb, nb] = b.split('-');
      if (ba !== bb) return ba.localeCompare(bb);
      return Number(na) - Number(nb);
    });

  // 決定論的に間引いて count 件を選択し、配置順を保つ
  const indices = spaceKeys.map((_, idx) => idx);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const selectedKeys = indices
    .slice(0, Math.min(count, spaceKeys.length))
    .sort((a, b) => a - b)
    .map((idx) => spaceKeys[idx]);

  const memberNames = vspoList.map((m) => m.name).filter(Boolean);
  const blockSet = new Set();
  const circles = [];
  const extraInfo = {};

  selectedKeys.forEach((spaceKey, idx) => {
    const [spaceSym, spaceNum] = spaceKey.split('-');
    blockSet.add(spaceSym);

    const circleId = `test_circle_${String(idx + 1).padStart(3, '0')}_${spaceSym}_${spaceNum}`;
    const prefix = PREFIX_WORDS[Math.floor(rng() * PREFIX_WORDS.length)];
    const suffix = SUFFIX_WORDS[Math.floor(rng() * SUFFIX_WORDS.length)];

    // エッジケース: 長いサークル名・EN表記混在・標準名
    let circleName = `${prefix}${suffix}`;
    if (idx % 35 === 3) {
      circleName = `【テスト】${prefix}${suffix}＠新刊・アクスタ・限定セット頒布予定（長文表示崩れ確認用）`;
    } else if (idx % 25 === 7) {
      circleName = `${prefix} Studio #${idx + 1}`;
    }

    const penname = `テスト作家${idx + 1}`;

    // 画像パターン: キャッシュ成功確認用(/icons/icon.svg, /map.jpg)、未設定(null)、失敗ケース(missing)
    let circlecut = '/icons/icon.svg';
    let oshinagakiUrl = '';
    if (idx % 9 === 0) {
      circlecut = null;
    } else if (idx % 4 === 1) {
      circlecut = '/map.jpg';
      oshinagakiUrl = '/icons/icon.svg';
    } else if (idx % 29 === 5) {
      // プリフェッチのエラー・スキップ挙動検証用
      oshinagakiUrl = 'https://example.invalid/test-missing-oshinagaki.png';
    }

    circles.push({
      circle_id: circleId,
      space_sym: spaceSym,
      space_num: spaceNum,
      space_count: idx % 12 === 0 ? '2' : '1',
      circle_name: circleName,
      circle_kana: circleName,
      penname,
      penname_kana: penname,
      twitter_id: `vggc_test_${idx + 1}`,
      pixiv_url: null,
      site_url: '',
      circle_link: null,
      circle_comment: idx % 5 === 0 ? 'テストモード用のサンプルコメントです。新刊準備中！' : null,
      circlecut
    });

    // メンバータグ 1〜2名
    const pickedMembers = [];
    if (memberNames.length > 0) {
      pickedMembers.push(memberNames[Math.floor(rng() * memberNames.length)]);
      if (rng() > 0.65) {
        const second = memberNames[Math.floor(rng() * memberNames.length)];
        if (!pickedMembers.includes(second)) pickedMembers.push(second);
      }
    }

    // 頒布物 1〜3点
    const itemCount = 1 + Math.floor(rng() * 3);
    const items = [];
    for (let k = 0; k < itemCount; k++) {
      const itemLabel = ITEM_TYPES[Math.floor(rng() * ITEM_TYPES.length)];
      const price = PRICE_POOL[Math.floor(rng() * PRICE_POOL.length)];
      items.push({
        name: k === 0 ? `${itemLabel}（テスト）` : `${itemLabel} Vol.${k + 1}`,
        price,
        note: price === 0 ? '無料配布' : ''
      });
    }

    const isAbsent = idx % 33 === 10;
    const isSoldoutSample = idx % 14 === 2;
    const tags = [];
    if (isSoldoutSample) tags.push('完売あり');
    if (idx % 6 === 0) tags.push('新刊あり');
    if (idx % 8 === 0) tags.push('グッズ');

    extraInfo[circleId] = {
      tags,
      members: pickedMembers,
      oshinagaki_url: oshinagakiUrl,
      items,
      twitter_id: `vggc_test_${idx + 1}`,
      staff_twitter: '',
      is_absent: isAbsent,
      updated_at: '2027-03-01T12:00:00Z'
    };
  });

  const blocks = Array.from(blockSet).sort();
  return { circles, blocks, extraInfo };
}

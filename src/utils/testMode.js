// src/utils/testMode.js
// VGGC 13th テストモード（?mode=test）用の疎結合モジュール
// ふわのん「ダミーデータ材料プールとエッジケース仕様 v1 (2026-11-17)」準拠
// 本番データ公開時は ENABLE_TEST_MODE を false にするか本モジュールの利用箇所を外すだけで無効化できます。

export const ENABLE_TEST_MODE = true;

const TEST_SESSION_KEY = 'vggc13th_test_mode_active';
const TEST_STORAGE_PREFIX = 'vggc13th_test_';
const TEST_KEY_DIGEST = '5f68309d-05e7a904';

function fnv1a32(str, seed) {
  let hash = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function verifyTestModeKey(rawKey) {
  if (!rawKey) return false;
  const k = String(rawKey).trim();
  const digest = `${fnv1a32(`vggc13:${k}`, 0x811c9dc5)}-${fnv1a32(`${k}:salt2`, 0x9e3779b9)}`;
  return digest === TEST_KEY_DIGEST;
}

export function isTestModeActive() {
  if (!ENABLE_TEST_MODE || typeof window === 'undefined') {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'test') {
      const keyParam = params.get('key');
      if (verifyTestModeKey(keyParam)) {
        window.sessionStorage.setItem(TEST_SESSION_KEY, '1');
        return true;
      }
      window.sessionStorage.removeItem(TEST_SESSION_KEY);
      return false;
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

export function getTestStorageKey(name) {
  return `${TEST_STORAGE_PREFIX}${name}`;
}

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

// ==========================================
// 1. サークル名プール（造語・組み合わせ生成用）
// ==========================================
const PREFIX_POOL = [
  ['星屑', 'ホシクズ'], ['月夜', 'ツキヨ'], ['紙飛行機', 'カミヒコウキ'], ['雨上がり', 'アメアガリ'],
  ['猫又', 'ネコマタ'], ['電子', 'デンシ'], ['夢幻', 'ムゲン'], ['白夜', 'ビャクヤ'],
  ['泡沫', 'ウタカタ'], ['機械仕掛け', 'キカイジカケ'], ['硝子', 'ガラス'], ['深夜', 'シンヤ'],
  ['回転', 'カイテン'], ['砂糖', 'サトウ'], ['塩味', 'シオアジ'], ['真空', 'シンクウ'],
  ['彗星', 'スイセイ'], ['徒然', 'ツレズレ'], ['極彩', 'ゴクサイ'], ['単眼', 'タンガン']
];

const SUFFIX_POOL = [
  ['堂', 'ドウ'], ['工房', 'コウボウ'], ['商店', 'ショウテン'], ['研究所', 'ケンキュウジョ'],
  ['倶楽部', 'クラブ'], ['製作所', 'セイサクジョ'], ['屋', 'ヤ'], ['軒', 'ケン'],
  ['ラボ', 'ラボ'], ['通信社', 'ツウシンシャ'], ['印刷部', 'インサツブ'], ['観測所', 'カンソクジョ'],
  ['喫茶', 'キッサ'], ['文庫', 'ブンコ'], ['社', 'シャ'], ['団', 'ダン'],
  ['ファクトリー', 'ファクトリー'], ['シンドローム', 'シンドローム'], ['計画', 'ケイカク'], ['本舗', 'ホンポ']
];

const STANDALONE_POOL = [
  ['ねこまたぎ', 'ネコマタギ'], ['よるのとばり', 'ヨルノトバリ'], ['かみつぶて', 'カミツブテ'],
  ['ほしあかり', 'ホシアカリ'], ['つきみそう', 'ツキミソウ'], ['あめざいく', 'アメザイク'],
  ['ゆめうつつ', 'ユメウツツ'], ['しろつめくさ', 'シロツメクサ'], ['ひるねこ', 'ヒルネコ'],
  ['よあけまえ', 'ヨアケマエ']
];

const EN_PREFIX_POOL = ['Starlight', 'Midnight', 'Velvet', 'Cyber', 'Azure', 'Pastel', 'Astral', 'Lunar'];
const EN_SUFFIX_POOL = ['Atelier', 'Works', 'Press', 'Studio', 'Garden', 'Archive', 'Lab', 'Factory'];

// ==========================================
// 2. ペンネームプール（造語）
// ==========================================
const PENNAME_POOL = [
  ['あおい', 'アオイ'], ['そらまめ', 'ソラマメ'], ['つきの', 'ツキノ'], ['はるかぜ', 'ハルカゼ'],
  ['みぞれ', 'ミゾレ'], ['ゆきみ', 'ユキミ'], ['らて', 'ラテ'], ['もか', 'モカ'],
  ['すずね', 'スズネ'], ['ことり', 'コトリ'], ['ひなた', 'ヒナタ'], ['しぐれ', 'シグレ'],
  ['あまね', 'アマネ'], ['ほたる', 'ホタル'], ['るり', 'ルリ'], ['かえで', 'カエデ'],
  ['さくら', 'サクラ'], ['ぽてと', 'ポテトラ'], ['まろん', 'マロン'], ['てとら', 'テトラ']
];

// ==========================================
// 3. 頒布物・テーマ語・価格プール
// ==========================================
const BOOK_TYPES = [
  '新刊 イラスト本 (B5/24P)',
  '新刊 漫画本',
  '既刊 イラスト本',
  '新刊 合同誌',
  '既刊再販 コスプレ写真集',
  '無料配布 ペーパー'
];

const GOODS_TYPES = [
  'アクリルスタンド', 'アクリルキーホルダー', '缶バッジ', '色紙', 'ポスター (B2)',
  'クリアファイル', 'ステッカーセット', 'チェキ風カード', 'タペストリー', 'トートバッグ'
];

const THEME_WORDS = [
  'ゆめかわ', 'おでかけ', '制服', 'メイド', '水着',
  'ハロウィン', 'お正月', 'さんぽ', 'ねこみみ', 'お泊まり会'
];

const BOOK_PRICES = [0, 300, 500, 800, 1000, 1200, 1500, 2000];
const GOODS_PRICES = [300, 500, 800, 1000, 1500, 2000, 2500];
const SET_PRICES = [2500, 3000, 4000, 5000];

const PALETTE_COLORS = ['#0f172a', '#1e293b', '#312e81', '#831843', '#134e4a', '#7c2d12', '#1e3a8a'];

/**
 * 外部通信・CORS不要のプレースホルダーお品書きSVG Data URLを生成
 */
function buildMockOshinagakiSvg(spaceLabel, circleName, accentHex) {
  const safeName = String(circleName).slice(0, 16).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">` +
    `<rect width="600" height="420" fill="${accentHex}"/>` +
    `<rect x="18" y="18" width="564" height="384" rx="18" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>` +
    `<text x="36" y="72" fill="#fde047" font-family="sans-serif" font-size="24" font-weight="bold">TEST OSHINAGAKI / ${spaceLabel}</text>` +
    `<text x="36" y="130" fill="#ffffff" font-family="sans-serif" font-size="30" font-weight="bold">${safeName}</text>` +
    `<text x="36" y="210" fill="#e2e8f0" font-family="sans-serif" font-size="20">・新刊 / グッズ テスト頒布サンプル</text>` +
    `<text x="36" y="250" fill="#e2e8f0" font-family="sans-serif" font-size="20">・会場テストモード用プレースホルダー画像</text>` +
    `<text x="36" y="365" fill="#94a3b8" font-family="sans-serif" font-size="16">VGGC 13th Test Mode (No External CDN)</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildLongComment(circleName) {
  return `【${circleName} テスト長文コメント】本日はスペースにお立ち寄りいただきありがとうございます！` +
    `新刊のほかに既刊イラスト本・アクリルスタンド・ステッカーセットなども少量ずつ持ち込んでおります。` +
    `開場直後は混雑する場合がありますので、お釣りが出ないよう千円札や小銭をご用意いただけますと大変助かります。` +
    `完売状況や再販予定については当日の状況次第でお知らせいたします。お取り置き希望の方は事前連絡をご確認ください。`;
}

/**
 * 既存マップ座標 (map_coords.json) とメンバーマスタ (vspoDict) から
 * 仕様 v1 準拠でシード固定ダミーサークルデータ＆追加情報を自動生成する
 */
export function generateMockEventData({
  mapCoords = {},
  vspoList = [],
  count = 240,
  seed = 20270306
} = {}) {
  const rng = createSeededRng(seed);

  const spaceKeys = Object.keys(mapCoords)
    .filter((key) => /^[A-Z]+-\d+$/.test(key))
    .sort((a, b) => {
      const [ba, na] = a.split('-');
      const [bb, nb] = b.split('-');
      if (ba !== bb) return ba.localeCompare(bb);
      return Number(na) - Number(nb);
    });

  // 先頭8件は目玉固定枠用に確保し、残りを全体から決定論的サンプリング
  const fixedSpaceKeys = spaceKeys.slice(0, 8);
  const remainingPool = spaceKeys.slice(8);
  const indices = remainingPool.map((_, idx) => idx);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const randomCount = Math.max(0, Math.min(count, spaceKeys.length) - fixedSpaceKeys.length);
  const randomSpaceKeys = indices
    .slice(0, randomCount)
    .sort((a, b) => a - b)
    .map((idx) => remainingPool[idx]);

  const selectedKeys = [...fixedSpaceKeys, ...randomSpaceKeys];
  const memberNames = vspoList.map((m) => m.name).filter(Boolean);
  const blockSet = new Set();
  const circles = [];
  const extraInfo = {};

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // 人気メンバー偏り再現用（上位6名を厚めに配分）
  const pickMember = () => {
    if (memberNames.length === 0) return 'オールキャラ';
    if (rng() < 0.45) {
      return memberNames[Math.floor(rng() * Math.min(6, memberNames.length))];
    }
    return pick(memberNames);
  };

  selectedKeys.forEach((spaceKey, idx) => {
    const [spaceSym, spaceNum] = spaceKey.split('-');
    blockSet.add(spaceSym);

    const circleId = `test_circle_${String(idx + 1).padStart(3, '0')}_${spaceSym}_${spaceNum}`;
    const [penname, pennameKana] = pick(PENNAME_POOL);

    let circleName = '';
    let circleKana = '';
    let spaceCount = rng() < 0.15 ? '2' : '1';
    let circlecut = idx % 3 === 0 ? '/map.jpg' : '/icons/icon.svg';
    let oshinagakiUrl = '';
    let twitterId = rng() < 0.2 ? null : `vggc_mock_${idx + 1}`;
    let pixivUrl = rng() < 0.35 ? null : `https://www.pixiv.net/users/${90000000 + idx}`;
    let siteUrl = rng() < 0.5 ? '' : `https://example.invalid/circle-${idx + 1}`;
    let circleComment = null;

    const cRoll = rng();
    if (cRoll < 0.4) {
      circleComment = null;
    } else if (cRoll < 0.85) {
      circleComment = '新刊準備中！当日よろしくお願いします。';
    }

    const pickedMembers = [pickMember()];
    if (rng() > 0.65) {
      const m2 = pickMember();
      if (!pickedMembers.includes(m2)) pickedMembers.push(m2);
    }
    const mainMember = pickedMembers[0];

    let items = [];
    const tags = [];
    let isAbsent = idx % 40 === 25;

    // ---------------------------------------------------------
    // 先頭8件：固定の目玉テストサークル
    // ---------------------------------------------------------
    if (idx === 0) {
      circleName = '【目玉01】星屑完売堂';
      circleKana = 'ホシクズカンバイドウ';
      items = [
        { name: `${mainMember} おでかけ 新刊イラスト本`, price: 1000, note: '完売' },
        { name: `${mainMember} アクリルスタンド`, price: 1500, note: '完売' }
      ];
      tags.push('全品完売', '完売');
      oshinagakiUrl = '/icons/icon.svg';
    } else if (idx === 1) {
      circleName = '【目玉02】月夜残りわずか工房';
      circleKana = 'ツキヨノコリワズカコウボウ';
      items = [
        { name: `${mainMember} 制服 ミニイラスト本`, price: 550, note: '残りわずか（端数550円テスト）' },
        { name: `${mainMember} 缶バッジ`, price: 500, note: '残り2点' }
      ];
      tags.push('残りわずか');
      oshinagakiUrl = buildMockOshinagakiSvg(spaceKey, circleName, PALETTE_COLORS[1]);
    } else if (idx === 2) {
      circleName = '【目玉03】極彩大所帯12品ラボ';
      circleKana = 'ゴクサイオオジョタイラボ';
      items = Array.from({ length: 12 }, (_, k) => ({
        name: `${mainMember} ${THEME_WORDS[k % THEME_WORDS.length]} ${GOODS_TYPES[k % GOODS_TYPES.length]}`,
        price: GOODS_PRICES[k % GOODS_PRICES.length],
        note: k === 11 ? '新作' : ''
      }));
      tags.push('新刊あり', 'グッズ');
      oshinagakiUrl = buildMockOshinagakiSvg(spaceKey, circleName, PALETTE_COLORS[2]);
    } else if (idx === 3) {
      circleName = '【目玉04】硝子画像リンク欠落軒';
      circleKana = 'ガラスガゾウケツラクケン';
      circlecut = null;
      oshinagakiUrl = '';
      twitterId = null;
      pixivUrl = null;
      siteUrl = '';
      items = [{ name: `${mainMember} さんぽ 新刊漫画本`, price: 800, note: '' }];
    } else if (idx === 4) {
      circleName = '【目玉05】しろつめくさ無配屋';
      circleKana = 'シロツメクサムハイヤ';
      items = [
        { name: `${mainMember} 無料配布 ペーパー`, price: 0, note: '無料配布' },
        { name: `${mainMember} ポストカード`, price: 0, note: '無料配布' }
      ];
      tags.push('無料配布');
      oshinagakiUrl = '/icons/icon.svg';
    } else if (idx === 5) {
      circleName = '【目玉06】機械仕掛けの超長文表示崩れ検証用特別製作所本舗第拾参回記念';
      circleKana = 'キカイジカケノチョウチョウブンテスト';
      items = [{
        name: `${mainMember} ゆめかわ＆お泊まり会記念の非常に長い40文字級フルカラー特別総集編イラスト本`,
        price: 1500,
        note: ''
      }];
      tags.push('新刊あり');
      circleComment = buildLongComment(circleName);
      oshinagakiUrl = 'https://example.invalid/test-missing-oshinagaki.png'; // プリフェッチ失敗確認用
    } else if (idx === 6) {
      circleName = '【目玉07】紙飛行機合同印刷部';
      circleKana = 'カミヒコウキゴウドウインサツブ';
      spaceCount = '2';
      items = [
        { name: `${mainMember} ハロウィン 新刊 合同誌`, price: 1200, note: '2スペース合同' },
        { name: `${mainMember} チェキ風カード`, price: 300, note: '' }
      ];
      tags.push('合同誌', '新刊あり');
      oshinagakiUrl = buildMockOshinagakiSvg(spaceKey, circleName, PALETTE_COLORS[4]);
    } else if (idx === 7) {
      circleName = '【目玉08】彗星豪華セット本舗';
      circleKana = 'スイセイゴウカセットホンポ';
      items = [
        { name: `${mainMember} お正月 新刊グッズ豪華セット`, price: 5000, note: '新刊+アクスタ+トート' },
        { name: `${mainMember} クリアファイル`, price: 500, note: '' }
      ];
      tags.push('新刊セット', 'グッズ');
      oshinagakiUrl = buildMockOshinagakiSvg(spaceKey, circleName, PALETTE_COLORS[5]);
    } else {
      // ---------------------------------------------------------
      // ランダム生成枠（仕様 v1 の配分・エッジケース準拠）
      // ---------------------------------------------------------
      const isEnCircle = rng() < 0.03;
      const isZeroOnly = !isEnCircle && rng() < 0.02;
      const isHighSet = !isZeroOnly && rng() < 0.03;
      const isLongName = idx === 18;

      if (isEnCircle) {
        const ep = pick(EN_PREFIX_POOL);
        const es = pick(EN_SUFFIX_POOL);
        circleName = `${ep} ${es}`;
        circleKana = circleName;
      } else if (rng() < 0.2) {
        const [stName, stKana] = pick(STANDALONE_POOL);
        circleName = stName;
        circleKana = stKana;
      } else {
        const [pName, pKana] = pick(PREFIX_POOL);
        const [sName, sKana] = pick(SUFFIX_POOL);
        circleName = `${pName}${sName}`;
        circleKana = `${pKana}${sKana}`;
      }

      if (isLongName) {
        circleName = `${circleName}＠長文タイトル＆表示レイアウト確認用特別サークル`;
      }

      if (circleComment === null && rng() < 0.15) {
        circleComment = buildLongComment(circleName);
      }

      // 頒布物数: 基本1〜8件(中央値3前後)、約3%で10〜12件の大所帯
      const isLarge = rng() < 0.03;
      const itemCount = isLarge
        ? 10 + Math.floor(rng() * 3)
        : Math.min(8, Math.max(1, Math.round(1 + (rng() + rng()) * 2.5)));

      const allCircleSoldout = rng() < 0.10;
      if (allCircleSoldout) tags.push('全品完売', '完売');

      for (let k = 0; k < itemCount; k++) {
        const theme = pick(THEME_WORDS);
        let itemName = '';
        let price = 1000;

        if (isZeroOnly) {
          itemName = `${mainMember} ${theme} 無料配布ペーパー`;
          price = 0;
        } else if (isHighSet && k === 0) {
          itemName = `${mainMember} ${theme} 新刊豪華セット`;
          price = 5000;
        } else if (k === 0) {
          itemName = `${mainMember} ${theme} ${pick(BOOK_TYPES)}`;
          price = pick(BOOK_PRICES);
        } else if (rng() < 0.45) {
          itemName = `${mainMember} ${theme} ${pick(BOOK_TYPES)}`;
          price = pick(BOOK_PRICES);
        } else if (rng() < 0.85) {
          itemName = `${mainMember} ${theme} ${pick(GOODS_TYPES)}`;
          price = pick(GOODS_PRICES);
        } else {
          itemName = `${mainMember} ${theme} 新刊グッズセット`;
          price = pick(SET_PRICES);
        }

        if (idx === 22 && k === 0) {
          itemName = `${mainMember} ${theme}の40文字級超長文頒布物タイトル表示テスト用イラスト記念本`;
        }

        const itemSoldout = allCircleSoldout || rng() < 0.15;
        items.push({
          name: itemName,
          price,
          note: itemSoldout ? '完売' : (price === 0 ? '無料配布' : '')
        });
      }

      // お品書き画像: 70%あり / 30%なし
      if (rng() < 0.70) {
        if (idx % 7 === 0) {
          oshinagakiUrl = '/icons/icon.svg';
        } else {
          oshinagakiUrl = buildMockOshinagakiSvg(
            spaceKey,
            circleName,
            PALETTE_COLORS[idx % PALETTE_COLORS.length]
          );
        }
      } else {
        oshinagakiUrl = '';
        if (rng() < 0.4) circlecut = null;
      }

      if (!allCircleSoldout && rng() < 0.35) tags.push('新刊あり');
      if (rng() < 0.25) tags.push('グッズ');
    }

    circles.push({
      circle_id: circleId,
      space_sym: spaceSym,
      space_num: spaceNum,
      space_count: spaceCount,
      circle_name: circleName,
      circle_kana: circleKana,
      penname,
      penname_kana: pennameKana,
      twitter_id: twitterId,
      pixiv_url: pixivUrl,
      site_url: siteUrl,
      circle_link: null,
      circle_comment: circleComment,
      circlecut
    });

    extraInfo[circleId] = {
      tags,
      members: pickedMembers,
      oshinagaki_url: oshinagakiUrl,
      items,
      twitter_id: twitterId || '',
      staff_twitter: '',
      is_absent: isAbsent,
      updated_at: '2027-03-01T12:00:00Z'
    };
  });

  const blocks = Array.from(blockSet).sort();
  return { circles, blocks, extraInfo };
}

// src/utils/circleAuth.js
// サークル本人認証・Xハンドル照合・売り子招待コードの純粋ロジック

/**
 * X (Twitter) のハンドル名やURLから正規化したID（@なし・小文字）を抽出する
 * @param {string} raw
 * @returns {string}
 */
export function normalizeXHandle(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, '');
  s = s.split('?')[0].split('/')[0];
  s = s.replace(/^@+/, '');
  return s.trim().toLowerCase();
}

/**
 * サークル情報（twitter_id / staff_twitter）に指定された X ハンドルが含まれるか判定
 * @param {Object} circleExtra - { twitter_id, staff_twitter }
 * @param {string} xHandle - 認証済み X ハンドル
 * @returns {boolean}
 */
export function isXHandleMatchingCircle(circleExtra, xHandle) {
  const target = normalizeXHandle(xHandle);
  if (!target || !circleExtra) return false;

  const rawFields = [circleExtra.twitter_id, circleExtra.staff_twitter].filter(Boolean);
  for (const field of rawFields) {
    const parts = String(field).split(/[\s,、/]+/);
    for (const part of parts) {
      if (normalizeXHandle(part) === target) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Supabase の auth user オブジェクトから X (Twitter) OAuth のユーザー名を抽出する
 * @param {Object|null} user
 * @returns {string}
 */
export function extractXHandleFromUser(user) {
  if (!user) return '';
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const xIdentity = identities.find(i => i.provider === 'twitter' || i.provider === 'x');
  const data = xIdentity?.identity_data || user.user_metadata || {};

  const raw =
    data.user_name ||
    data.preferred_username ||
    data.screen_name ||
    data.username ||
    '';
  return normalizeXHandle(raw);
}

/**
 * 売り子用招待コードの形式チェック（例: VC-A1B2-C3D4）
 * @param {string} code
 * @returns {string} 正規化済みコード（無効なら空文字）
 */
export function normalizeInviteCode(code) {
  const s = String(code || '').trim().toUpperCase();
  if (/^VC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s)) {
    return s;
  }
  return '';
}

/**
 * 認証方式の日本語表示ラベルを返す
 * @param {string} authMethod
 * @returns {string}
 */
export function getAuthMethodLabel(authMethod) {
  switch (authMethod) {
    case 'x_oauth':
      return 'X (Twitter) 本人確認';
    case 'staff_invite_code':
      return '売り子招待コード';
    case 'post_url':
      return 'X 公開ポスト確認';
    case 'admin_manual':
      return '運営手動紐付け';
    default:
      return '未確認';
  }
}

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
 * 招待コードの形式チェック（VC-XXXX-XXXX: 売り子用 / VO-XXXX-XXXX: オーナー用）
 * @param {string} code
 * @returns {string} 正規化済みコード（無効なら空文字）
 */
export function normalizeInviteCode(code) {
  const s = String(code || '').trim().toUpperCase();
  if (/^(VC|VO)-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s)) {
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
    case 'owner_invite_code':
      return 'オーナー招待コード';
    case 'post_url':
      return 'X 公開ポスト確認';
    case 'admin_manual':
      return '運営承認付与';
    default:
      return '未確認';
  }
}

/**
 * X (Twitter) のポストURLを検証・正規化する
 * 例: https://x.com/user/status/123456789?s=20 -> https://twitter.com/user/status/123456789
 * @param {string} rawUrl
 * @returns {string} 無効なURLなら空文字
 */
export function normalizeXPostUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const u = new URL(String(rawUrl).trim());
    if (!/^(www\.)?(x\.com|twitter\.com)$/i.test(u.hostname)) return '';
    const match = u.pathname.match(/^\/([A-Za-z0-9_]{1,30})\/status\/(\d+)/);
    if (!match) return '';
    return `https://twitter.com/${match[1]}/status/${match[2]}`;
  } catch (e) {
    return '';
  }
}

/**
 * oEmbed HTML 内の <p>...</p> から本文テキストを抽出し、基本的なHTMLエンティティを復元する
 * @param {string} html
 * @returns {string}
 */
export function extractTextFromOembedHtml(html) {
  if (!html) return '';
  const pMatch = String(html).match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const target = pMatch ? pMatch[1] : String(html);
  return target
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ワンタイム確認コードを生成する (例: VGGC13-A9K2M4)
 * @returns {string}
 */
export function generatePostVerifyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VGGC13-${suffix}`;
}

/**
 * oEmbed レスポンスを検証し、投稿者ハンドル・確認コード一致・サークル名簿一致を返す
 * @param {Object} oembedJson
 * @param {string} expectedCode
 * @param {Object|null} circleExtra
 * @returns {{ ok: boolean, authorHandle: string, hasCode: boolean, circleMatched: boolean, postText: string, error?: string }}
 */
export function verifyOembedPayload(oembedJson, expectedCode, circleExtra = null) {
  const authorHandle = normalizeXHandle(oembedJson?.author_url || '');
  const postText = extractTextFromOembedHtml(oembedJson?.html || '');
  const code = String(expectedCode || '').trim().toUpperCase();
  const hasCode = Boolean(code) && postText.toUpperCase().includes(code);
  const circleMatched = circleExtra ? isXHandleMatchingCircle(circleExtra, authorHandle) : true;

  if (!authorHandle) {
    return { ok: false, authorHandle: '', hasCode, circleMatched: false, postText, error: 'AUTHOR_NOT_FOUND' };
  }
  if (!hasCode) {
    return { ok: false, authorHandle, hasCode: false, circleMatched, postText, error: 'VERIFY_CODE_NOT_FOUND' };
  }
  if (circleExtra && !circleMatched) {
    return { ok: false, authorHandle, hasCode: true, circleMatched: false, postText, error: 'X_HANDLE_MISMATCH' };
  }

  return { ok: true, authorHandle, hasCode: true, circleMatched: true, postText };
}

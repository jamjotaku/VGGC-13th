// api/verify-x-post.js
// Vercel Serverless Function: X (Twitter) 公開ポストの oEmbed API を用いた完全無料（0円）本人確認エンドポイント

import { normalizeXPostUrl, verifyOembedPayload, isXHandleMatchingCircle } from '../src/utils/circleAuth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // バックエンド設定・DB疎通ヘルスチェック（秘密鍵の値は一切返さない）
  if (req.method === 'GET') {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const hasSupabaseUrl = Boolean(supabaseUrl);
    const hasServiceRoleKey = Boolean(serviceRoleKey);
    let dbMembershipsReady = false;
    let dbInviteCodesReady = false;

    if (hasSupabaseUrl && hasServiceRoleKey) {
      try {
        const headers = {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        };
        const [mRes, iRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/circle_memberships?select=id&limit=1`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/circle_invite_codes?select=id&limit=1`, { headers })
        ]);
        dbMembershipsReady = mRes.ok;
        dbInviteCodesReady = iRes.ok;
      } catch (e) {}
    }

    return res.status(200).json({
      ok: true,
      hasSupabaseUrl,
      hasServiceRoleKey,
      dbMembershipsReady,
      dbInviteCodesReady,
      readyForPersistence: hasSupabaseUrl && hasServiceRoleKey && dbMembershipsReady && dbInviteCodesReady
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { postUrl, expectedCode, circleId } = body;

    const normalizedUrl = normalizeXPostUrl(postUrl);
    if (!normalizedUrl) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_POST_URL',
        message: '有効な X (Twitter) のポストURL（例: https://x.com/user/status/123...）を入力してください。'
      });
    }

    if (!expectedCode || String(expectedCode).trim().length < 6) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_VERIFY_CODE',
        message: '確認コードが発行されていません。'
      });
    }

    // 公式 oEmbed API（APIキー不要・0円）へ問い合わせ
    const oembedEndpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}&omit_script=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let oembedRes;
    try {
      oembedRes = await fetch(oembedEndpoint, {
        method: 'GET',
        headers: { 'User-Agent': 'VGGC-13th-Verifier/1.0' },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!oembedRes.ok) {
      return res.status(422).json({
        ok: false,
        error: 'OEMBED_FETCH_FAILED',
        status: oembedRes.status,
        message: 'ポストの公開情報を取得できませんでした。非公開（鍵）アカウント、削除済みポスト、または URL 誤りの可能性があります。'
      });
    }

    const oembedJson = await oembedRes.json();
    const check = verifyOembedPayload(oembedJson, expectedCode, null);

    if (!check.ok) {
      return res.status(422).json({
        ok: false,
        error: check.error,
        authorHandle: check.authorHandle,
        postText: check.postText,
        message:
          check.error === 'VERIFY_CODE_NOT_FOUND'
            ? `ポスト本文に確認コード（${expectedCode}）が見つかりませんでした。`
            : '投稿者アカウントを特定できませんでした。'
      });
    }

    // ここから先は本番連携（Supabase Service Role Key が設定されている場合のみ DB へ永続紐付け）
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (supabaseUrl && serviceRoleKey && jwt && circleId) {
      // 1. ログイン中ユーザーの検証
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${jwt}`
        }
      });
      if (!userRes.ok) {
        return res.status(401).json({ ok: false, error: 'INVALID_SESSION', message: 'ログインセッションが無効です。' });
      }
      const authUser = await userRes.json();

      // 2. サークルの登録済み X アカウントを取得して照合
      const circleRes = await fetch(
        `${supabaseUrl}/rest/v1/circle_info?circle_id=eq.${encodeURIComponent(circleId)}&select=circle_id,twitter_id,staff_twitter`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`
          }
        }
      );
      const circleRows = circleRes.ok ? await circleRes.json() : [];
      const circleExtra = circleRows[0] || null;

      if (!circleExtra || !isXHandleMatchingCircle(circleExtra, check.authorHandle)) {
        return res.status(403).json({
          ok: false,
          error: 'X_HANDLE_MISMATCH',
          authorHandle: check.authorHandle,
          message: `投稿者 (@${check.authorHandle}) が、選択されたサークルの登録アカウントと一致しません。`
        });
      }

      // 3. circle_memberships へ owner / post_url として記録
      const nowIso = new Date().toISOString();
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/circle_memberships?on_conflict=user_id,circle_id`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          user_id: authUser.id,
          circle_id: circleId,
          role: 'owner',
          auth_method: 'post_url',
          verified_x_handle: check.authorHandle,
          verified_at: nowIso,
          revoked_at: null,
          updated_at: nowIso
        })
      });

      if (!upsertRes.ok) {
        const errText = await upsertRes.text();
        return res.status(500).json({ ok: false, error: 'DB_UPSERT_FAILED', detail: errText });
      }

      return res.status(200).json({
        ok: true,
        mode: 'persisted',
        authorHandle: check.authorHandle,
        verifiedAt: nowIso,
        normalizedUrl
      });
    }

    // 疎通テストモード（Service Role Key 未設定時またはテスト専用）
    return res.status(200).json({
      ok: true,
      mode: 'oembed_verified_only',
      authorHandle: check.authorHandle,
      postText: check.postText,
      normalizedUrl
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: err?.message || '検証中に予期しないエラーが発生しました。'
    });
  }
}

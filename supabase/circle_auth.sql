-- ==============================================================================
-- VGGC 13th: サークル本人認証・紐付け管理・売り子招待コード用 SQL
-- 方針:
--   1. 一般参加者は従来通りダミーID方式（X連携不要）
--   2. サークル主の初回本人認証は最小権限 X OAuth を本線とし、認証方式・日時を監査記録
--   3. 認証済みサークル主はアプリ内から売り子用招待コードをワンタップ発行可能
--   4. 紐付け解除・再認証の導線を用意
-- Supabase Dashboard の SQL Editor で実行してください。
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. circle_memberships（ユーザー × サークルの紐付け＆認証監査ログ）
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  auth_method text NOT NULL CHECK (auth_method IN ('x_oauth', 'staff_invite_code', 'owner_invite_code', 'post_url', 'admin_manual')),
  verified_x_handle text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circle_memberships_user_circle_key UNIQUE (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_memberships_user_id
  ON public.circle_memberships (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_circle_memberships_circle_id
  ON public.circle_memberships (circle_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;

-- 本人の有効・解除済み履歴の閲覧のみ許可（書き込みは必ず SECURITY DEFINER RPC 経由）
DROP POLICY IF EXISTS "Users can read own circle_memberships" ON public.circle_memberships;
CREATE POLICY "Users can read own circle_memberships"
  ON public.circle_memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. circle_invite_codes（売り子用ワンタップ招待コード）
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id text NOT NULL,
  code text NOT NULL UNIQUE,
  target_role text NOT NULL DEFAULT 'staff' CHECK (target_role IN ('owner', 'staff')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_uses integer NOT NULL DEFAULT 5 CHECK (max_uses > 0 AND max_uses <= 20),
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_invite_codes_circle_id
  ON public.circle_invite_codes (circle_id)
  WHERE is_active = true;

ALTER TABLE public.circle_invite_codes ENABLE ROW LEVEL SECURITY;

-- 自分が owner であるサークルの招待コードのみ閲覧可
DROP POLICY IF EXISTS "Owners can read own circle invite codes" ON public.circle_invite_codes;
CREATE POLICY "Owners can read own circle invite codes"
  ON public.circle_invite_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_memberships m
      WHERE m.user_id = auth.uid()
        AND m.circle_id = circle_invite_codes.circle_id
        AND m.role = 'owner'
        AND m.revoked_at IS NULL
    )
  );

-- ------------------------------------------------------------------------------
-- 3. ヘルパー: X ハンドル正規化
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_x_handle(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        coalesce(trim(raw), ''),
        '^https?://(www\.)?(twitter\.com|x\.com)/', '', 'i'
      ),
      '^@+|\?.*$|/.*$', '', 'g'
    )
  );
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: X OAuth ログイン済みユーザーのサークル主本人確認＆紐付け
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_circle_owner_by_x(p_circle_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_x_handle text;
  v_circle_twitter text;
  v_circle_staff_twitter text;
  v_matched boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  -- auth.identities から X (twitter / x) OAuth のユーザー名を取得
  SELECT public.normalize_x_handle(
    coalesce(
      i.identity_data->>'user_name',
      i.identity_data->>'preferred_username',
      i.identity_data->>'screen_name',
      i.identity_data->>'username'
    )
  )
  INTO v_x_handle
  FROM auth.identities i
  WHERE i.user_id = v_uid
    AND i.provider IN ('twitter', 'x')
  ORDER BY i.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_x_handle IS NULL OR v_x_handle = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'X_OAUTH_IDENTITY_NOT_FOUND');
  END IF;

  -- circle_info から対象サークルの登録済み X アカウントを取得して照合
  SELECT twitter_id, staff_twitter
  INTO v_circle_twitter, v_circle_staff_twitter
  FROM public.circle_info
  WHERE circle_id = p_circle_id;

  IF v_circle_twitter IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM unnest(string_to_array(v_circle_twitter || ',' || coalesce(v_circle_staff_twitter, ''), ',')) AS part
      WHERE public.normalize_x_handle(part) = v_x_handle
    ) INTO v_matched;
  END IF;

  IF NOT v_matched THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'X_HANDLE_MISMATCH',
      'verified_x_handle', v_x_handle
    );
  END IF;

  INSERT INTO public.circle_memberships (
    user_id, circle_id, role, auth_method, verified_x_handle, verified_at, revoked_at, updated_at
  )
  VALUES (
    v_uid, p_circle_id, 'owner', 'x_oauth', v_x_handle, now(), NULL, now()
  )
  ON CONFLICT (user_id, circle_id)
  DO UPDATE SET
    role = 'owner',
    auth_method = 'x_oauth',
    verified_x_handle = EXCLUDED.verified_x_handle,
    verified_at = now(),
    revoked_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', p_circle_id,
    'role', 'owner',
    'auth_method', 'x_oauth',
    'verified_x_handle', v_x_handle,
    'verified_at', now()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: 売り子用招待コードのワンタップ発行（認証済みサークル主のみ）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_invite_code(p_circle_id text, p_max_uses integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := false;
  v_raw text := upper(replace(gen_random_uuid()::text, '-', ''));
  v_code text;
  v_expires_at timestamptz := now() + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.circle_memberships
    WHERE user_id = v_uid
      AND circle_id = p_circle_id
      AND role = 'owner'
      AND revoked_at IS NULL
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWNER_PERMISSION_REQUIRED');
  END IF;

  -- 既存の有効コードを無効化せず、新規コードを発行（組み込み gen_random_uuid で8文字ランダム生成）
  v_code := 'VC-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);

  INSERT INTO public.circle_invite_codes (circle_id, code, created_by, max_uses, expires_at)
  VALUES (p_circle_id, v_code, v_uid, least(greatest(coalesce(p_max_uses, 5), 1), 20), v_expires_at);

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', p_circle_id,
    'code', v_code,
    'max_uses', least(greatest(coalesce(p_max_uses, 5), 1), 20),
    'expires_at', v_expires_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC: 招待コードを使ってサークルへ参加 (VC-: 売り子 / VO-: オーナー)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_staff_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_normalized_code text := upper(trim(coalesce(p_code, '')));
  v_invite record;
  v_role text;
  v_method text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.circle_invite_codes
  WHERE code = v_normalized_code
    AND is_active = true
    AND expires_at > now()
    AND used_count < max_uses
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OR_EXPIRED_CODE');
  END IF;

  v_role := coalesce(v_invite.target_role, CASE WHEN v_normalized_code LIKE 'VO-%' THEN 'owner' ELSE 'staff' END);
  v_method := CASE WHEN v_role = 'owner' THEN 'owner_invite_code' ELSE 'staff_invite_code' END;

  INSERT INTO public.circle_memberships (
    user_id, circle_id, role, auth_method, verified_x_handle, verified_at, revoked_at, updated_at
  )
  VALUES (
    v_uid, v_invite.circle_id, v_role, v_method, NULL, now(), NULL, now()
  )
  ON CONFLICT (user_id, circle_id)
  DO UPDATE SET
    role = CASE WHEN public.circle_memberships.role = 'owner' AND public.circle_memberships.revoked_at IS NULL THEN 'owner' ELSE EXCLUDED.role END,
    auth_method = CASE WHEN public.circle_memberships.role = 'owner' AND public.circle_memberships.revoked_at IS NULL THEN public.circle_memberships.auth_method ELSE EXCLUDED.auth_method END,
    verified_at = now(),
    revoked_at = NULL,
    updated_at = now();

  UPDATE public.circle_invite_codes
  SET used_count = used_count + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', v_invite.circle_id,
    'role', v_role,
    'auth_method', v_method,
    'verified_at', now()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC: サークル紐付けの解除（ユーザー自身による解除導線）
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_my_circle_membership(p_circle_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  UPDATE public.circle_memberships
  SET revoked_at = now(), updated_at = now()
  WHERE user_id = v_uid
    AND circle_id = p_circle_id
    AND revoked_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'circle_id', p_circle_id, 'revoked_at', now());
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. 既存環境向け冪等マイグレーション（target_role / owner_invite_code 制約更新）
-- ------------------------------------------------------------------------------
ALTER TABLE public.circle_invite_codes
  ADD COLUMN IF NOT EXISTS target_role text NOT NULL DEFAULT 'staff';

DO $$
BEGIN
  ALTER TABLE public.circle_memberships DROP CONSTRAINT IF EXISTS circle_memberships_auth_method_check;
  ALTER TABLE public.circle_memberships
    ADD CONSTRAINT circle_memberships_auth_method_check
    CHECK (auth_method IN ('x_oauth', 'staff_invite_code', 'owner_invite_code', 'post_url', 'admin_manual'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 9. 認証の保険: 鍵垢・個別申請テーブル (circle_auth_requests) & 申請/承認 RPC
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_auth_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id text NOT NULL,
  x_handle text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  issued_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_circle_auth_requests_status_created
  ON public.circle_auth_requests (status, created_at DESC);

ALTER TABLE public.circle_auth_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own auth requests" ON public.circle_auth_requests;
CREATE POLICY "Users can read own auth requests"
  ON public.circle_auth_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%admin%'
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%jamj%'
  );

-- 申請送信 RPC（一般ログインユーザー）
CREATE OR REPLACE FUNCTION public.submit_circle_auth_request(p_circle_id text, p_x_handle text, p_note text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req_code text := 'REQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  v_clean_handle text := public.normalize_x_handle(p_x_handle);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF coalesce(trim(p_circle_id), '') = '' OR v_clean_handle = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REQUEST_PARAMS');
  END IF;

  INSERT INTO public.circle_auth_requests (request_code, user_id, circle_id, x_handle, note, status)
  VALUES (v_req_code, v_uid, trim(p_circle_id), v_clean_handle, coalesce(trim(p_note), ''), 'pending');

  RETURN jsonb_build_object(
    'ok', true,
    'request_code', v_req_code,
    'circle_id', trim(p_circle_id),
    'x_handle', v_clean_handle
  );
END;
$$;

-- 管理者による承認/コード発行/却下 RPC
CREATE OR REPLACE FUNCTION public.resolve_circle_auth_request(p_request_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_is_admin boolean := (v_email LIKE '%admin%' OR v_email LIKE '%jamj%');
  v_req record;
  v_vo_code text;
BEGIN
  IF v_uid IS NULL OR NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_PERMISSION_REQUIRED');
  END IF;

  SELECT * INTO v_req FROM public.circle_auth_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.circle_auth_requests
    SET status = 'rejected', resolved_at = now(), resolved_by = v_uid
    WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF p_action = 'approve_code' THEN
    v_vo_code := 'VO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
                       || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 5, 4));
    INSERT INTO public.circle_invite_codes (circle_id, code, target_role, created_by, max_uses)
    VALUES (v_req.circle_id, v_vo_code, 'owner', v_uid, 1);

    UPDATE public.circle_auth_requests
    SET status = 'approved', issued_code = v_vo_code, resolved_at = now(), resolved_by = v_uid
    WHERE id = p_request_id;

    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'issued_code', v_vo_code);
  END IF;

  -- approve_direct: 申請者の user_id へ直接オーナー権限を付与
  INSERT INTO public.circle_memberships (
    user_id, circle_id, role, auth_method, verified_x_handle, verified_at, revoked_at, updated_at
  )
  VALUES (
    v_req.user_id, v_req.circle_id, 'owner', 'admin_manual', v_req.x_handle, now(), NULL, now()
  )
  ON CONFLICT (user_id, circle_id)
  DO UPDATE SET
    role = 'owner',
    auth_method = 'admin_manual',
    verified_x_handle = EXCLUDED.verified_x_handle,
    verified_at = now(),
    revoked_at = NULL,
    updated_at = now();

  UPDATE public.circle_auth_requests
  SET status = 'approved', resolved_at = now(), resolved_by = v_uid
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'circle_id', v_req.circle_id);
END;
$$;

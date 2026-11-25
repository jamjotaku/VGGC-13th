-- ==============================================================================
-- VGGC 13th: 管理者テーブル (admin_users) × @VGGC_APP_INFO 紐付け & RLS 厳格化
-- 目的:
--   1. 危険な email LIKE '%admin%' / '%jamj%' の部分一致判定を廃止
--   2. admin_users に登録された正規管理者のみに管理権限を限定
--   3. 管理者アカウントと管理用 X (@VGGC_APP_INFO) を紐付け
-- Supabase Dashboard の SQL Editor で実行してください。
-- ==============================================================================

-- 1. 管理者マスタテーブル (admin_users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner_admin', 'admin')),
  x_handle text NOT NULL DEFAULT 'vggc_app_info',
  display_name text NOT NULL DEFAULT 'VGGC運営管理',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read own admin_users row" ON public.admin_users;
CREATE POLICY "Admins can read own admin_users row"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Jamj__Otaku（および admin が存在すれば）を正規管理者として登録 & @VGGC_APP_INFO 紐付け
INSERT INTO public.admin_users (user_id, role, x_handle, display_name)
SELECT id, 'owner_admin', 'vggc_app_info', 'Jamj__Otaku (運営管理)'
FROM auth.users
WHERE lower(email) IN ('jamj__otaku@vggc-13th.vercel.app', 'admin@vggc-13th.vercel.app')
ON CONFLICT (user_id) DO UPDATE SET
  x_handle = EXCLUDED.x_handle,
  display_name = EXCLUDED.display_name;

-- 3. 管理者判定ヘルパー関数 (RLS・RPC共通)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- 4. circle_info の書き込みポリシーを正規管理者のみに厳格化
DROP POLICY IF EXISTS "Allow admin to insert/update" ON public.circle_info;
CREATE POLICY "Allow admin to insert/update"
  ON public.circle_info
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 5. notifications の書き込みポリシーを正規管理者のみに厳格化
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.notifications;
CREATE POLICY "Authenticated users can update notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can delete notifications" ON public.notifications;
CREATE POLICY "Authenticated users can delete notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- 6. circle_auth_requests の管理者閲覧＆承認RPCも正規管理者のみに厳格化
DROP POLICY IF EXISTS "Users can read own auth requests" ON public.circle_auth_requests;
CREATE POLICY "Users can read own auth requests"
  ON public.circle_auth_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

CREATE OR REPLACE FUNCTION public.resolve_circle_auth_request(p_request_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
  v_vo_code text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
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

  -- approve_direct: 既存の別アクティブ owner がいれば解除し（競合裁定対応）、申請者の user_id へオーナー権限を付与
  UPDATE public.circle_memberships
  SET revoked_at = now(), updated_at = now()
  WHERE circle_id = v_req.circle_id
    AND role = 'owner'
    AND revoked_at IS NULL
    AND user_id <> v_req.user_id;

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

-- 運営による結合コード（VO- / VC-）直接発行 RPC
CREATE OR REPLACE FUNCTION public.admin_create_circle_invite_code(
  p_circle_id text,
  p_target_role text DEFAULT 'owner',
  p_max_uses integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := CASE WHEN lower(coalesce(p_target_role, 'owner')) = 'staff' THEN 'staff' ELSE 'owner' END;
  v_prefix text := CASE WHEN v_role = 'staff' THEN 'VC-' ELSE 'VO-' END;
  v_raw text := upper(replace(gen_random_uuid()::text, '-', ''));
  v_code text;
  v_expires_at timestamptz := greatest(now() + interval '7 days', timestamptz '2027-03-08 00:00:00+09');
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_PERMISSION_REQUIRED');
  END IF;
  IF coalesce(trim(p_circle_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CIRCLE_ID_REQUIRED');
  END IF;

  v_code := v_prefix || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);

  INSERT INTO public.circle_invite_codes (circle_id, code, target_role, created_by, max_uses, expires_at)
  VALUES (trim(p_circle_id), v_code, v_role, v_uid, least(greatest(coalesce(p_max_uses, 1), 1), 20), v_expires_at);

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', trim(p_circle_id),
    'code', v_code,
    'target_role', v_role,
    'expires_at', v_expires_at
  );
END;
$$;

-- 運営による緊急再紐づけ・強制解除 RPC（当日トラブル保険）
CREATE OR REPLACE FUNCTION public.admin_reassign_circle_membership(
  p_circle_id text,
  p_target_account text,
  p_role text DEFAULT 'owner',
  p_revoke_existing_owners boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_input text := lower(trim(coalesce(p_target_account, '')));
  v_target_uid uuid;
  v_target_email text;
  v_role text := CASE WHEN lower(coalesce(p_role, 'owner')) = 'staff' THEN 'staff' ELSE 'owner' END;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ADMIN_PERMISSION_REQUIRED');
  END IF;
  IF coalesce(trim(p_circle_id), '') = '' OR v_clean_input = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PARAMS');
  END IF;

  -- メール完全一致 または @前（ユーザーID）一致で auth.users を検索
  SELECT id, email
  INTO v_target_uid, v_target_email
  FROM auth.users
  WHERE lower(email) = v_clean_input
     OR lower(split_part(email, '@', 1)) = replace(v_clean_input, '@', '')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TARGET_USER_NOT_FOUND');
  END IF;

  IF p_revoke_existing_owners AND v_role = 'owner' THEN
    UPDATE public.circle_memberships
    SET revoked_at = now(), updated_at = now()
    WHERE circle_id = trim(p_circle_id)
      AND role = 'owner'
      AND revoked_at IS NULL
      AND user_id <> v_target_uid;
  END IF;

  INSERT INTO public.circle_memberships (
    user_id, circle_id, role, auth_method, verified_x_handle, verified_at, revoked_at, updated_at
  )
  VALUES (
    v_target_uid, trim(p_circle_id), v_role, 'admin_manual', split_part(v_target_email, '@', 1), now(), NULL, now()
  )
  ON CONFLICT (user_id, circle_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    auth_method = 'admin_manual',
    verified_x_handle = EXCLUDED.verified_x_handle,
    verified_at = now(),
    revoked_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', trim(p_circle_id),
    'user_id', v_target_uid,
    'target_email', v_target_email,
    'role', v_role
  );
END;
$$;

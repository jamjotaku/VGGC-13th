-- ==============================================================================
-- VGGC 13th: 簡易POSレジ v2 用テーブル・RLS・RPC 定義
-- 機能:
--   1. 複数端末同時レジ打ち同期 (circle_register_states + circle_register_events 加算ログ方式)
--   2. 自サークルの買い物リスト登録数（来訪予測）集計 RPC (プライバシー保護・数値のみ返却)
-- Supabase Dashboard の SQL Editor で実行してください。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. サークル単位のレジ共有設定・商品マスタ状態 (circle_register_states)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_register_states (
  circle_id text PRIMARY KEY,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.circle_register_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circle members can manage register states" ON public.circle_register_states;
CREATE POLICY "Circle members can manage register states"
  ON public.circle_register_states
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_memberships m
      WHERE m.user_id = auth.uid()
        AND m.circle_id = circle_register_states.circle_id
        AND m.revoked_at IS NULL
    )
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE 'jamj__otaku@%'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circle_memberships m
      WHERE m.user_id = auth.uid()
        AND m.circle_id = circle_register_states.circle_id
        AND m.revoked_at IS NULL
    )
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE 'jamj__otaku@%'
  );

-- ------------------------------------------------------------------------------
-- 2. 複数端末同時レジ打ち用 加算イベントログ (circle_register_events)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_register_events (
  id text PRIMARY KEY,
  circle_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_label text,
  event_type text NOT NULL CHECK (event_type IN ('checkout', 'void')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_register_events_circle_created
  ON public.circle_register_events (circle_id, created_at DESC);

ALTER TABLE public.circle_register_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Circle members can read register events" ON public.circle_register_events;
CREATE POLICY "Circle members can read register events"
  ON public.circle_register_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_memberships m
      WHERE m.user_id = auth.uid()
        AND m.circle_id = circle_register_events.circle_id
        AND m.revoked_at IS NULL
    )
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE 'jamj__otaku@%'
  );

DROP POLICY IF EXISTS "Circle members can insert own register events" ON public.circle_register_events;
CREATE POLICY "Circle members can insert own register events"
  ON public.circle_register_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.circle_memberships m
        WHERE m.user_id = auth.uid()
          AND m.circle_id = circle_register_events.circle_id
          AND m.revoked_at IS NULL
      )
      OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE 'jamj__otaku@%'
    )
  );

-- Realtime 有効化（冪等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'circle_register_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_register_events;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. RPC: 自サークルの買い物リスト登録数（来訪予測数）の安全集計
--    ※ shopping_lists 生行は絶対に返さず、自サークルの集計カウントのみ返す
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_circle_demand_stats(p_circle_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_total integer := 0;
  v_s integer := 0;
  v_a integer := 0;
  v_b integer := 0;
  v_none integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1 FROM public.circle_memberships m
      WHERE m.user_id = v_uid
        AND m.circle_id = p_circle_id
        AND m.revoked_at IS NULL
    )
    OR lower(coalesce(auth.jwt() ->> 'email', '')) LIKE 'jamj__otaku@%'
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE coalesce(list_data -> p_circle_id ->> 'priority', '') = 'S')::integer,
    count(*) FILTER (WHERE coalesce(list_data -> p_circle_id ->> 'priority', '') = 'A')::integer,
    count(*) FILTER (WHERE coalesce(list_data -> p_circle_id ->> 'priority', '') = 'B')::integer,
    count(*) FILTER (WHERE coalesce(list_data -> p_circle_id ->> 'priority', '') = '')::integer
  INTO v_total, v_s, v_a, v_b, v_none
  FROM public.shopping_lists
  WHERE list_data ? p_circle_id;

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', p_circle_id,
    'total_lists', v_total,
    'priority_breakdown', jsonb_build_object(
      'S', v_s,
      'A', v_a,
      'B', v_b,
      'none', v_none
    ),
    'fetched_at', now()
  );
END;
$$;

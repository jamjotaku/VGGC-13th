-- ============================================================================
-- VGGC 13th Supabase 初期セットアップ SQL
-- 新しい Supabase プロジェクト (VGGC-13th) の SQL Editor で1回実行してください。
-- 冪等 (IF NOT EXISTS / DROP POLICY IF EXISTS) に作成しています。
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. circle_info (サークルマスタ・お品書き・頒布物・タグ・Xアカウント)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_info (
  circle_id text PRIMARY KEY,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  oshinagaki_url text,
  cut_image_url text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  twitter_id text,
  staff_twitter text,
  is_absent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.circle_info
  ADD COLUMN IF NOT EXISTS cut_image_url text;

ALTER TABLE public.circle_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read circle_info" ON public.circle_info;
CREATE POLICY "Anyone can read circle_info"
  ON public.circle_info
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow admin to insert/update" ON public.circle_info;
CREATE POLICY "Allow admin to insert/update"
  ON public.circle_info
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN ('admin@vggc-13th.vercel.app', 'jamj__otaku@vggc-13th.vercel.app', 'admin@vggc.dummy.local', 'jamj__otaku@vggc.dummy.local')
    OR auth.jwt() ->> 'email' LIKE '%admin%'
    OR auth.jwt() ->> 'email' LIKE '%jamj%'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN ('admin@vggc-13th.vercel.app', 'jamj__otaku@vggc-13th.vercel.app', 'admin@vggc.dummy.local', 'jamj__otaku@vggc.dummy.local')
    OR auth.jwt() ->> 'email' LIKE '%admin%'
    OR auth.jwt() ->> 'email' LIKE '%jamj%'
  );

-- ----------------------------------------------------------------------------
-- 2. shopping_lists (ユーザーごとの買い物リスト・共有設定)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_lists_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id
  ON public.shopping_lists (user_id);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own shopping_list" ON public.shopping_lists;
CREATE POLICY "Users can manage own shopping_list"
  ON public.shopping_lists
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read public shopping_lists" ON public.shopping_lists;
CREATE POLICY "Anyone can read public shopping_lists"
  ON public.shopping_lists
  FOR SELECT
  USING (is_public = true);

-- ----------------------------------------------------------------------------
-- 3. register_data (サークル主向けレジモード状態同期)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.register_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id text NOT NULL,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.register_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own register_data" ON public.register_data;
CREATE POLICY "Users can manage own register_data"
  ON public.register_data
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. notifications (運営からのお知らせ・緊急告知)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'urgent', 'update')),
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_pinned_created
  ON public.notifications (is_pinned DESC, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public notifications are viewable by everyone" ON public.notifications;
CREATE POLICY "Public notifications are viewable by everyone"
  ON public.notifications
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.notifications;
CREATE POLICY "Authenticated users can update notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete notifications" ON public.notifications;
CREATE POLICY "Authenticated users can delete notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.role() = 'authenticated');

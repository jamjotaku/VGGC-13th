-- ==============================================================================
-- VGGC 次回イベント向け データベース初期化（入れ物化）SQL（全10テーブル対応）
-- ⚠️ 実行前に必ずバックアップを Google Drive へ保存し、削除対象を確認してください。
--
-- この SQL はテーブル構造・制約・RLSポリシーおよび管理者権限（admin_users）を
-- すべて保持したまま、イベント固有データ・認証データ・ユーザーデータのみを消去します。
-- ==============================================================================

-- 【保持必須（削除しない）】
--   - public.admin_users（運営管理者アカウント紐付け）

-- 1. サークル認証・招待コード・申請（v2認証系）
TRUNCATE TABLE public.circle_invite_codes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.circle_auth_requests RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.circle_memberships RESTART IDENTITY CASCADE;

-- 2. サークル参加レジデータ（v1 / v2 マスター状態・イベント履歴）
TRUNCATE TABLE public.circle_register_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.circle_register_states RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.register_data RESTART IDENTITY CASCADE;

-- 3. ユーザー買い物リスト（他ユーザーの個人データ）
TRUNCATE TABLE public.shopping_lists RESTART IDENTITY CASCADE;

-- 4. サークル補足情報（お品書き・タグ・欠席情報等）
TRUNCATE TABLE public.circle_info RESTART IDENTITY CASCADE;

-- 5. お知らせ通知
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;

-- 6. （任意）一般ユーザーアカウント（auth.users）の整理
-- ※ 管理者アカウント（admin_users に登録されているユーザー）以外の一般ユーザーを削除する場合のみ、
--    以下のコメントを外して実行してください。
/*
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.admin_users WHERE user_id IS NOT NULL
);
*/

-- 7. 確認用クエリ（admin_users のみ保持され、他9テーブルが 0 件になっていれば完了）
SELECT 'admin_users' AS table_name, count(*) AS row_count FROM public.admin_users
UNION ALL
SELECT 'circle_memberships', count(*) FROM public.circle_memberships
UNION ALL
SELECT 'circle_invite_codes', count(*) FROM public.circle_invite_codes
UNION ALL
SELECT 'circle_auth_requests', count(*) FROM public.circle_auth_requests
UNION ALL
SELECT 'circle_info', count(*) FROM public.circle_info
UNION ALL
SELECT 'shopping_lists', count(*) FROM public.shopping_lists
UNION ALL
SELECT 'register_data', count(*) FROM public.register_data
UNION ALL
SELECT 'notifications', count(*) FROM public.notifications
UNION ALL
SELECT 'circle_register_states', count(*) FROM public.circle_register_states
UNION ALL
SELECT 'circle_register_events', count(*) FROM public.circle_register_events
ORDER BY table_name;

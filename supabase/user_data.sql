-- 就活Hub 本体データ(user_data)のRLS設定
-- Supabase の SQL エディタに丸ごと貼って1回実行する。冪等(何回流してもOK)。
-- これが「他人のデータを読めない」ための生命線。

-- テーブル(既にあれば if not exists でスキップ・既存は一切変更しない)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 行レベルセキュリティを有効化
alter table public.user_data enable row level security;

-- 自分の行(user_id = ログインユーザー)だけ 読み/作成/更新/削除 できる
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own" on public.user_data
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own" on public.user_data
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);

-- ===== 確認用(実行後に別途流す) =====
-- (1) RLSが有効か … rls 列が t(true) なら有効
--   select relname, relrowsecurity as rls from pg_class where relname = 'user_data';
-- (2) ポリシー一覧 … select/insert/update/delete の4つが出ればOK
--   select policyname, cmd from pg_policies where tablename = 'user_data' order by cmd;

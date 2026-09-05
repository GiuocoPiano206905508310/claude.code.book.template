-- ============================================================
-- 立体四目並べ: 設定と棋譜をアカウントごとに保存するテーブル
--
-- Supabase の管理画面 → SQL Editor に貼って一度だけ実行する。
-- 何度実行しても同じ状態になる（作成済みなら何もしない）。
--
-- 1ユーザー1行。設定(undoEnabled / undoLimit / cpuLevel …)と
-- 保存済み棋譜の一覧を、そのまま JSON で入れる。
-- ゲーム側の項目が増えても SQL は変えなくてよい。
--
-- ------------------------------------------------------------
-- SQL のほかに、管理画面で2か所の設定が要る（SQLでは変えられない）
-- ------------------------------------------------------------
-- 1) Authentication → Sign In / Providers → Email
--      Confirm email          … オン
--      Secure email change    … オン（推奨）
--
-- 2) Authentication → URL Configuration → Redirect URLs
--    メールのリンクから戻ってくる先を登録する。登録されていないURLへは
--    戻れず、リンクを開いてもゲームに入れない。
--      https://giuocopiano206905508310.github.io/claude.code.book.template/score-four/
--    手元で確かめる場合はこれも足す:
--      http://127.0.0.1:8777/score-four/
--
-- なお、同じメールアドレスで2つ目のアカウントは作れない
-- （Supabase が auth.users のメールアドレスを一意にしているため）。
-- ============================================================

create table if not exists public.score_four_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  progress   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 行レベルセキュリティ。自分の行だけを読み書きできるようにする。
alter table public.score_four_progress enable row level security;

drop policy if exists "own progress: select" on public.score_four_progress;
create policy "own progress: select" on public.score_four_progress
  for select using (auth.uid() = user_id);

drop policy if exists "own progress: insert" on public.score_four_progress;
create policy "own progress: insert" on public.score_four_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own progress: update" on public.score_four_progress;
create policy "own progress: update" on public.score_four_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 削除は使わないので許可しない（アカウントを消せば on delete cascade で消える）

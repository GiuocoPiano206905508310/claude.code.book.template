-- ============================================================
-- ラインパズル: 進行状況をアカウントごとに保存するテーブル
--
-- Supabase の管理画面 → SQL Editor に貼って一度だけ実行する。
-- 何度実行しても同じ状態になる（作成済みなら何もしない）。
--
-- 1ユーザー1行。進行状況(cleared / uraCleared / lastStage …)を
-- そのまま JSON で入れる。ゲーム側の項目が増えても SQL は変えなくてよい。
-- ============================================================

create table if not exists public.line_puzzle_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  progress   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 行レベルセキュリティ。自分の行だけを読み書きできるようにする。
-- （anon キーは公開されるので、これが無いと誰でも他人の記録を読めてしまう）
alter table public.line_puzzle_progress enable row level security;

drop policy if exists "own progress: select" on public.line_puzzle_progress;
create policy "own progress: select" on public.line_puzzle_progress
  for select using (auth.uid() = user_id);

drop policy if exists "own progress: insert" on public.line_puzzle_progress;
create policy "own progress: insert" on public.line_puzzle_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own progress: update" on public.line_puzzle_progress;
create policy "own progress: update" on public.line_puzzle_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 削除は使わないので許可しない（アカウントを消せば on delete cascade で消える）

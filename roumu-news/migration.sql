-- ============================================================
-- 労務ニュース便覧: 記事一覧・お気に入り・同期ログのテーブル
--
-- Supabase の管理画面 → SQL Editor に貼って一度だけ実行する。
-- 何度実行しても同じ状態になる（作成済みなら何もしない）。
--
-- news_articles   … 厚労省・年金機構等のRSSから毎日取り込む記事一覧。
--                    書き込みは fetch-daily-news Edge Function
--                    （service_roleキーで接続）のみが行う。アプリの
--                    利用者（authenticatedロール）は閲覧のみできる。
-- news_favorites  … 利用者ごとのお気に入り登録（★）。行レベル
--                    セキュリティにより本人の行しか読み書きできない。
-- news_sync_runs  … 毎日の自動取り込みが最後にいつ・何件成功したかの
--                    ログ。アプリ画面の「最終更新」表示に使用する。
-- ============================================================

create table if not exists public.news_articles (
  id             uuid primary key default gen_random_uuid(),
  source         text not null,
  category       text not null check (category in ('ministry', 'news', 'pamphlet')),
  title          text not null,
  summary        text not null default '',
  url            text not null,
  is_paid        boolean not null default false,
  published_date date not null,
  feed_guid      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (source, feed_guid)
);

create index if not exists news_articles_published_date_idx
  on public.news_articles (published_date desc);

alter table public.news_articles enable row level security;

drop policy if exists "articles: read for authenticated" on public.news_articles;
create policy "articles: read for authenticated" on public.news_articles
  for select using (auth.role() = 'authenticated');

-- insert/update/delete のポリシーは意図的に作成しない。
-- これにより一般利用者（anon/authenticatedロール）からの書き込みは
-- 常に拒否され、Edge Function が使う service_role キー（RLSを
-- バイパスする）だけが記事データを更新できる。

create table if not exists public.news_favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.news_articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

alter table public.news_favorites enable row level security;

drop policy if exists "own favorites: select" on public.news_favorites;
create policy "own favorites: select" on public.news_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "own favorites: insert" on public.news_favorites;
create policy "own favorites: insert" on public.news_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "own favorites: delete" on public.news_favorites;
create policy "own favorites: delete" on public.news_favorites
  for delete using (auth.uid() = user_id);

create table if not exists public.news_sync_runs (
  id               bigint generated always as identity primary key,
  ran_at           timestamptz not null default now(),
  articles_upserted integer not null default 0,
  ok               boolean not null default true,
  message          text
);

alter table public.news_sync_runs enable row level security;

drop policy if exists "sync runs: read for authenticated" on public.news_sync_runs;
create policy "sync runs: read for authenticated" on public.news_sync_runs
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- SQL のほかに、管理画面で確認・設定が要るもの
-- ------------------------------------------------------------
-- 1) Authentication → Sign In / Providers → Email
--      Confirm email … オフのままで構いません
--      （ユーザー名のみでログインする内部専用の仕組みのため、
--        実在のメールアドレスは使用しません）
--
-- 2) 毎日の自動更新（fetch-daily-news Edge Function のデプロイと
--    定期実行の設定）については roumu-news/README.md を参照してください。
-- ============================================================

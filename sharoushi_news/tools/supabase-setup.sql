-- 社労士NEWS — アカウントと進行状況（おすすめトピック・既読状態・お気に入り）のクラウド保存。
-- 当初はline-puzzle等このリポジトリの他アプリと同じSupabaseプロジェクトを
-- 共有していたが、auth.users がプロジェクト単位で共有されるため、他アプリで
-- 登録済みのメールアドレスが「登録済み」扱いになってしまう問題があった。
-- そのため、このアプリ専用のSupabaseプロジェクトに分離している
-- （lhmbhdfqpocuuqifyrjs）。
--
-- テーブル構成自体はline-puzzle/tools/supabase-setup.sqlと同じ。詳しくは
-- そちらも参照。

create table if not exists public.sharoushi_news_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  progress   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sharoushi_news_progress enable row level security;

drop policy if exists "own progress: select" on public.sharoushi_news_progress;
create policy "own progress: select" on public.sharoushi_news_progress
  for select using (auth.uid() = user_id);

drop policy if exists "own progress: insert" on public.sharoushi_news_progress;
create policy "own progress: insert" on public.sharoushi_news_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own progress: update" on public.sharoushi_news_progress;
create policy "own progress: update" on public.sharoushi_news_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 削除は使わないので許可しない（アカウントを消せば on delete cascade で消える）

-- progress カラムに入れる内容（アプリ側で自由に決めるJSON）:
--   {
--     "selectedTopicIds": ["social_insurance", "harassment", ...],
--     "readArticleIds": ["https://www.mhlw.go.jp/...html", ...],
--     "favoriteArticleIds": ["https://www.mhlw.go.jp/...html", ...]
--   }

-- ============================================================
-- Supabaseダッシュボードで必要な設定（このアプリ専用プロジェクト側で設定）
-- ============================================================
--
-- Authentication → Sign In / Providers → Email
--   - "Confirm email" を ON（新規登録時にメール確認を必須にする）
--   - "Secure email change" を ON（メールアドレス変更も確認メール必須にする）
--
-- Authentication → URL Configuration → Redirect URLs に以下を追加:
--   - https://giuocopiano206905508310.github.io/claude.code.book.template/SharoushiNews/
--   - http://localhost:*/（ローカルでのWeb版動作確認用）
--
-- モバイル版（iOS/Android）はアプリ内にWebページを持たないため、確認・
-- パスワード再設定・メールアドレス変更のメールのリンクは常に上記の
-- GitHub Pages版（Web版）に戻す。モバイル版でパスワードを変更した場合は、
-- 新しいパスワードで改めてログインし直せばよい。
--
-- 同じメールアドレスでの重複登録は、auth.users のメールアドレス一意制約により
-- Supabase側で自動的に防がれる（アプリ側で追加の判定は不要）。

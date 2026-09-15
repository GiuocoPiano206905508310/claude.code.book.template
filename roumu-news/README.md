# 労務ニュース便覧

社労士向けに、厚生労働省・関係省庁等が公表するニュースやパンフレットを一覧表示し、
毎日自動で更新するWebアプリです。記事をタップすると配信元サイトの元記事・
パンフレットPDFへ移動します。有料記事には「有料」表示が付き、記事はアカウントごとに
お気に入り（★）登録できます。

## 構成

- `index.html` / `app.js` / `style.css` … 記事一覧・お気に入り画面（要ログイン）
- `login.html` / `login.js` … ユーザー名＋パスワードでのログイン・新規登録
- `auth.js` / `supabase-client.js` / `supabase-sdk.js` … Supabase接続まわり
- `data.js` … 記事・お気に入りのデータ取得（Supabase）
- `migration.sql` … 必要なテーブルとアクセス制御（RLS）
- `supabase/functions/fetch-daily-news/` … RSSフィードを取り込むEdge Function（毎日実行）

この給与・勤怠管理システム一式（`payroll-system/` `timeclock/`）と同じSupabase
プロジェクトを使用しています（`supabase-client.js`のURL/anonキーは共通）。
ログインアカウントの名前空間は`auth.js`の`AUTH_EMAIL_DOMAIN`で分けているため、
給与・勤怠管理システムのアカウントとは別物です。

## ローカルでの確認

このフォルダを任意の静的ファイルサーバーで配信するだけで動作します。例:

```sh
cd roumu-news
python3 -m http.server 8778
```

ブラウザで `http://127.0.0.1:8778/` を開いてください。

## Supabase側のセットアップ

### 1. テーブルの作成

Supabaseダッシュボード → SQL Editor に `migration.sql` の内容を貼り付けて実行します。
`news_articles`（記事）・`news_favorites`（お気に入り）・`news_sync_runs`（自動更新の
実行ログ）の3テーブルが作成されます。`news_articles`への書き込みは、後述の
Edge Function（service_roleキー）だけに許可されており、アプリの利用者は閲覧のみです。

### 2. Edge Functionのデプロイ

[Supabase CLI](https://supabase.com/docs/guides/cli) を使ってデプロイします。

```sh
supabase login
supabase link --project-ref bvokxhtmgfeevfpfafqk
supabase functions deploy fetch-daily-news
```

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は、Supabase Edge Functionsの実行環境に
自動で渡されるため、追加の環境変数設定は不要です。

デプロイ後、ダッシュボードの Edge Functions → `fetch-daily-news` → **Invoke** から
手動で一度実行し、`news_sync_runs`に成功ログが記録されることを確認してください。

### 3. 取り込むフィードの設定

`supabase/functions/fetch-daily-news/index.ts` 内の `FEEDS` 配列で、取り込む
RSSフィードを設定します。厚生労働省の新着情報RSS（動作確認済み）を既定で
1件登録済みです。日本年金機構・全国健康保険協会・人事院や、有料の労務ニュース
サイトなど他の配信元を追加する場合は、各サイトの「新着情報」「RSS配信」ページで
正式なフィードURLを確認し、`FEEDS`にエントリを追加してから再デプロイしてください
（`isPaid: true` にすると、そのフィード全体の記事に「有料」表示が付きます）。

フィードにRSSが無いサイトの自動取り込みには対応していません（Webページの
スクレイピングはサイト構造の変更に弱く保守コストが高いため、まずは公式RSSの
範囲で運用することを推奨します）。

### 4. 毎日の自動実行のスケジュール設定

以下のいずれかの方法で、`fetch-daily-news` を毎日1回呼び出すよう設定してください。

**方法A（推奨）: Supabaseダッシュボードのスケジュール機能**

Edge Functions → `fetch-daily-news` → **Cron** タブから、`0 21 * * *`
（UTC 21:00 = 日本時間 6:00）などの実行時刻を設定します。ダッシュボードの
画面構成はSupabase側の更新で変わることがあるため、表示に従って設定してください。

**方法B: pg_cron + pg_net（SQLで設定する場合）**

ダッシュボード → Database → Extensions で `pg_cron` `pg_net` `supabase_vault`
を有効化したうえで、SQL Editorで以下を実行します（service_roleキーをSQLに
直接書かないよう、Vaultに一度だけ保存してから参照します）。

```sql
-- service_roleキーを1度だけVaultに保存する（<...>は実際のキーに置き換える）
select vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'roumu_news_service_role_key');

select cron.schedule(
  'roumu-news-daily-sync',
  '0 21 * * *', -- UTC。日本時間6:00に実行
  $$
  select net.http_post(
    url := 'https://bvokxhtmgfeevfpfafqk.functions.supabase.co/fetch-daily-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'roumu_news_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## セキュリティ上の注意

- `supabase-client.js`に含まれる anon キーはRLS前提で公開されることを想定した
  キーです。`SUPABASE_SERVICE_ROLE_KEY`（記事データの書き込み権限を持つ秘密鍵）は
  クライアント側のファイルには絶対に含めないでください（Edge Functionの実行環境
  にのみ自動で渡されます）。
- `news_articles`には一般利用者からの書き込みポリシーを設定していないため、
  ログインユーザーであっても記事データの改ざんはできません。

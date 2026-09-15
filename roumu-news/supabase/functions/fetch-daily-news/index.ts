// ============================================================================
// 労務ニュース便覧: 記事の毎日自動取り込み（Supabase Edge Function）
//
// 設定済みのRSSフィードを取得し、news_articles テーブルに upsert する。
// service_role キーで接続するため RLS をバイパスして書き込める
// （news_articles への書き込みは、一般利用者には許可していない）。
//
// デプロイ・スケジュール設定の手順は roumu-news/README.md を参照。
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Parser from 'npm:rss-parser@3';

type Category = 'ministry' | 'news' | 'pamphlet';

type FeedConfig = {
  source: string;
  category: Category;
  url: string;
  // このフィード（配信元）の記事全体が有料記事かどうか。
  // 官公庁のRSSは基本的に無料公開のためfalseでよい。
  isPaid: boolean;
};

// ----------------------------------------------------------------------------
// 取り込むフィードの一覧。
//
// 厚生労働省の新着情報RSS（https://www.mhlw.go.jp/rss/index.html で公開）は
// 動作確認済みの実URL。それ以外の関係省庁・独立行政法人・民間ニュースサイトの
// フィードは、このネットワーク環境から到達確認ができなかったため、
// プレースホルダーとしてコメントアウトしてある。実際に使う際は各サイトの
// 「新着情報」「RSS」ページで正式なフィードURLを確認し、コメントを外して
// urlを差し替えてください（存在しないURLのまま有効化すると、そのフィードだけ
// 取得エラーになるが、他のフィードの取り込みには影響しない）。
// ----------------------------------------------------------------------------
const FEEDS: FeedConfig[] = [
  { source: '厚生労働省', category: 'ministry', url: 'https://www.mhlw.go.jp/stf/news.rdf', isPaid: false },

  // 例: 日本年金機構・全国健康保険協会・人事院等を追加する場合
  // { source: '日本年金機構', category: 'ministry', url: 'https://www.nenkin.go.jp/????/rss.xml', isPaid: false },
  // { source: '全国健康保険協会', category: 'ministry', url: 'https://www.kyoukaikenpo.or.jp/????/rss.xml', isPaid: false },

  // 例: 有料の労務ニュースサイト（フィード全体を「有料」表示にする場合）
  // { source: '労働新聞社', category: 'news', url: 'https://www.rodo.co.jp/????/rss.xml', isPaid: true },
];

const PAMPHLET_KEYWORDS = ['パンフレット', 'リーフレット', 'マニュアル', 'ハンドブック'];

function classifyCategory(base: Category, title: string, link: string): Category {
  const text = `${title} ${link}`;
  if (PAMPHLET_KEYWORDS.some((k) => text.includes(k)) || /\.pdf($|\?)/i.test(link)) return 'pamphlet';
  return base;
}

function toPublishedDate(isoOrRfc822: string | undefined): string {
  const d = isoOrRfc822 ? new Date(isoOrRfc822) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const parser = new Parser();

  let totalUpserted = 0;
  const errors: string[] = [];

  for (const feed of FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const rows = (result.items || []).map((item) => {
        const title = item.title || '(無題)';
        const link = item.link || '';
        const guid = item.guid || item.id || link;
        return {
          source: feed.source,
          category: classifyCategory(feed.category, title, link),
          title,
          summary: stripHtml(item.contentSnippet || item.content || item.summary as string | undefined),
          url: link,
          is_paid: feed.isPaid,
          published_date: toPublishedDate(item.isoDate || item.pubDate),
          feed_guid: guid,
          updated_at: new Date().toISOString(),
        };
      }).filter((row) => row.url && row.feed_guid);

      if (rows.length === 0) continue;

      const { error } = await supabase
        .from('news_articles')
        .upsert(rows, { onConflict: 'source,feed_guid' });
      if (error) throw error;

      totalUpserted += rows.length;
    } catch (err) {
      errors.push(`${feed.source}: ${(err as Error).message || err}`);
    }
  }

  const ok = errors.length === 0 || totalUpserted > 0;
  await supabase.from('news_sync_runs').insert({
    articles_upserted: totalUpserted,
    ok,
    message: errors.length ? errors.join(' / ') : null,
  });

  return new Response(
    JSON.stringify({ ok, articlesUpserted: totalUpserted, errors }),
    { headers: { 'Content-Type': 'application/json' }, status: ok ? 200 : 500 },
  );
});

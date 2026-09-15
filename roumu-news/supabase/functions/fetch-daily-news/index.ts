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

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlFragmentToLines(fragment: string): string[] {
  return decodeEntities(
    fragment
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, '\n'),
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// 厚労省の新着情報RSSはタイトル・リンク・日付のみで、記事ごとの概要
// （description）を含んでいない。そのため、リンク先の記事ページを実際に
// 取得し、見出しタグの直後に続くテキストを概要として抜き出す。
// 単純に「タイトル文字列を含む行を探す」方式だと、ページ冒頭のスキップリンク・
// アクセシビリティ表記（「本文へ」「サイトマップ」等）を本文と誤認することが
// あったため、<h1>/<h2> タグ自体を手がかりにし、その中の文字列が記事タイトルと
// 一致するものが見つかった場合だけ、そのタグの直後（＝本文が始まる位置）から
// 抜粋する。官公庁サイトはページごとに構成が異なりベストエフォートの抽出に
// しかならないため、見出しが見つからない・取得や抽出に失敗した場合は空文字を
// 返し、記事自体の取り込みは失敗させない（is_paid/カテゴリ等には影響しない）。
async function fetchArticleExcerpt(url: string, title: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return '';
    const html = await res.text();

    const titleKey = title.slice(0, 8);
    if (!titleKey) return '';

    let afterHeadingStart = -1;
    const headingRegex = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(html)) !== null) {
      const headingText = htmlFragmentToLines(match[1]).join(' ');
      if (headingText.includes(titleKey)) {
        afterHeadingStart = match.index + match[0].length;
      }
    }
    if (afterHeadingStart < 0) return '';

    const bodyFragment = html.slice(afterHeadingStart, afterHeadingStart + 8000);
    const lines = htmlFragmentToLines(bodyFragment);
    const excerpt = lines.slice(0, 12).join(' ');
    return excerpt.replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    return '';
  }
}

// 記事ページの取得を同時に走らせすぎないよう、限られた並列数で処理する
// （厚労省サイトに数十〜百件超のリクエストを一度に送りつけないための配慮）
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
      const rows = await mapWithConcurrency(result.items || [], 5, async (item) => {
        const title = item.title || '(無題)';
        const link = item.link || '';
        const guid = item.guid || item.id || link;
        let summary = stripHtml(item.contentSnippet || item.content || item.summary as string | undefined);
        if (!summary && link) {
          summary = await fetchArticleExcerpt(link, title);
        }
        return {
          source: feed.source,
          category: classifyCategory(feed.category, title, link),
          title,
          summary,
          url: link,
          is_paid: feed.isPaid,
          published_date: toPublishedDate(item.isoDate || item.pubDate),
          feed_guid: guid,
          updated_at: new Date().toISOString(),
        };
      });
      const validRows = rows.filter((row) => row.url && row.feed_guid);

      // フィード内に同じ記事(同じfeed_guid)が重複して含まれることがあり、
      // その状態のままupsertするとPostgresが「同じ行を2回更新しようとしている」
      // として1件もupsertできずにエラーになる。後勝ちで同一feed_guidを1件にまとめる
      const dedupedRows = Array.from(
        new Map(validRows.map((row) => [row.feed_guid, row])).values(),
      );

      if (dedupedRows.length === 0) continue;

      const { error } = await supabase
        .from('news_articles')
        .upsert(dedupedRows, { onConflict: 'source,feed_guid' });
      if (error) throw error;

      totalUpserted += dedupedRows.length;
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

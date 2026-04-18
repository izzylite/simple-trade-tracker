import { log } from '../_shared/supabase.ts';

export interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

export async function searchNews(
  query: string,
  num = 8
): Promise<NewsResult[]> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) {
    log('SERPER_API_KEY not configured', 'warn');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num }),
    });

    if (!response.ok) {
      log(`Serper news search failed: ${response.status}`, 'error');
      return [];
    }

    const data = await response.json();
    const results: NewsResult[] = [];

    if (data.news) {
      for (const item of data.news.slice(0, num)) {
        results.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet || item.description || '',
          date: item.date,
          source: item.source,
        });
      }
    }

    return results;
  } catch (err) {
    log('Serper news search error', 'error', err);
    return [];
  }
}

export async function searchNewsMultiple(
  queries: string[],
  numPerQuery = 5
): Promise<NewsResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchNews(q, numPerQuery))
  );
  return results.flat();
}

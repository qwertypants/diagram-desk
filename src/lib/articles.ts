import type { CollectionEntry } from 'astro:content';

/** Newest articles first; titles break same-day ties so the order stays stable. */
export function sortArticlesByDate(articles: CollectionEntry<'articles'>[]) {
  return [...articles].sort((a, b) =>
    b.data.pubDate.getTime() - a.data.pubDate.getTime() ||
    a.data.title.localeCompare(b.data.title));
}

const { decodeEntities, stripHtml } = require("./rss.js");

function buildWikiUrl(locale) {
  const lang = locale || "en";
  return `https://${lang}.wikipedia.org/wiki/Portal:Current_events`;
}

function extractListItems(html) {
  const listMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
  return listMatches
    .map((item) => stripHtml(decodeEntities(item)))
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 40);
}

function extractLinks(html) {
  const linkMatches = html.match(/<a[^>]*href="([^"]+)"[^>]*>/gi) || [];
  return linkMatches
    .map((item) => {
      const match = item.match(/href="([^"]+)"/i);
      return match ? match[1] : "";
    })
    .filter(Boolean);
}

function resolveWikiLink(locale, href) {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `https://${locale}.wikipedia.org${href}`;
}

async function fetchWikipediaCandidates({ locale, manager }) {
  const url = buildWikiUrl(locale);
  const response = await manager.fetchText(url);
  if (response.skipped) {
    return { items: [], fetched: false };
  }
  if (!response.ok) {
    console.warn(`[wikipedia] Failed for ${locale}: ${response.status}`);
    return { items: [], fetched: false };
  }

  const items = extractListItems(response.body).map((text) => ({
    title: text,
    summary: text,
    body: text,
    url,
    source: "wikipedia-current-events",
    source_name: "Wikipedia Current Events",
    locale,
    topicTags: ["current events"],
    fetched_at: new Date().toISOString()
  }));

  const links = extractLinks(response.body);
  items.forEach((item, index) => {
    const href = links[index];
    const resolved = resolveWikiLink(locale, href);
    if (resolved) {
      item.url = resolved;
    }
  });

  return { items, fetched: true };
}

module.exports = { fetchWikipediaCandidates };

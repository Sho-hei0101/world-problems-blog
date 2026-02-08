const TOPICS = [
  "inflation",
  "rent",
  "mortgage",
  "housing",
  "job market",
  "wages",
  "tax",
  "energy prices",
  "climate",
  "wildfire",
  "flood",
  "earthquake",
  "war",
  "sanctions",
  "health",
  "policy",
  "economy"
];

function isWorldProblemsTheme(title) {
  const lower = String(title || "").toLowerCase();
  return TOPICS.some((topic) => lower.includes(topic));
}

function buildCandidate(item) {
  if (!item?.title || !item?.url) return null;
  return {
    id: `hn-${item.id}`,
    title: item.title,
    body: item.text || "",
    url: item.url,
    source: "hacker-news",
    source_name: "Hacker News",
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : "",
    locale: "en",
    topicTags: ["hacker news"],
    fetched_at: new Date().toISOString()
  };
}

async function fetchHackerNewsCandidates({ manager, maxItems = 4 }) {
  const topUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
  const topResponse = await manager.fetchJson(topUrl);
  if (topResponse.skipped) {
    return { items: [], fetched: false };
  }
  if (!topResponse.ok || !Array.isArray(topResponse.data)) {
    console.warn(`[hacker-news] Failed to fetch top stories: ${topResponse.status}`);
    return { items: [], fetched: false };
  }

  const items = [];
  for (const id of topResponse.data.slice(0, maxItems * 3)) {
    if (items.length >= maxItems) break;
    const itemUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
    const itemResponse = await manager.fetchJson(itemUrl);
    if (itemResponse.skipped) {
      break;
    }
    if (!itemResponse.ok) {
      continue;
    }
    if (!isWorldProblemsTheme(itemResponse.data?.title)) {
      continue;
    }
    const candidate = buildCandidate(itemResponse.data);
    if (candidate) {
      items.push(candidate);
    }
  }

  return { items, fetched: true };
}

module.exports = { fetchHackerNewsCandidates };

const SITES = ["money", "personalfinance", "economics", "lifehacks"];

function buildUrl(site) {
  const params = new URLSearchParams({
    order: "desc",
    sort: "hot",
    site,
    pagesize: "8"
  });
  return `https://api.stackexchange.com/2.3/questions?${params.toString()}`;
}

function buildCandidate(item, site) {
  if (!item?.title || !item?.link) return null;
  return {
    id: `stack-${site}-${item.question_id}`,
    title: item.title,
    body: "",
    url: item.link,
    source: "stackexchange",
    source_name: `StackExchange (${site})`,
    publishedAt: item.creation_date
      ? new Date(item.creation_date * 1000).toISOString()
      : "",
    locale: "en",
    topicTags: Array.isArray(item.tags) ? item.tags : [],
    fetched_at: new Date().toISOString()
  };
}

async function fetchStackExchangeCandidates({ manager }) {
  const items = [];
  let sitesFetched = 0;

  for (const site of SITES) {
    const url = buildUrl(site);
    const response = await manager.fetchJson(url);
    if (response.skipped) {
      break;
    }
    if (!response.ok || !Array.isArray(response.data?.items)) {
      console.warn(`[stackexchange] Failed for ${site}: ${response.status}`);
      continue;
    }
    sitesFetched += 1;
    response.data.items.forEach((item) => {
      const candidate = buildCandidate(item, site);
      if (candidate) {
        items.push(candidate);
      }
    });
  }

  return { items, sitesFetched };
}

module.exports = { fetchStackExchangeCandidates };

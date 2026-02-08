const { parseRssItems } = require("./rss.js");

const LOCALE_CONFIG = {
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  es: { hl: "es-ES", gl: "ES", ceid: "ES:es" },
  fr: { hl: "fr-FR", gl: "FR", ceid: "FR:fr" },
  de: { hl: "de-DE", gl: "DE", ceid: "DE:de" },
  ja: { hl: "ja-JP", gl: "JP", ceid: "JP:ja" }
};

const QUERY_SETS = {
  en: [
    "cost of living",
    "inflation OR rent OR mortgage rates",
    "job market OR wages",
    "tax OR energy prices",
    "climate OR wildfire OR flood OR earthquake",
    "war OR sanctions"
  ],
  es: [
    "costo de vida",
    "inflación O alquiler O tasas hipotecarias",
    "mercado laboral O salarios",
    "impuestos O precios de la energía",
    "clima O incendios forestales O inundación O terremoto",
    "guerra O sanciones"
  ],
  fr: [
    "coût de la vie",
    "inflation OU loyer OU taux hypothécaires",
    "marché du travail OU salaires",
    "impôts OU prix de l'énergie",
    "climat OU incendies de forêt OU inondation OU séisme",
    "guerre OU sanctions"
  ],
  de: [
    "Lebenshaltungskosten",
    "Inflation ODER Miete ODER Hypothekenzinsen",
    "Arbeitsmarkt ODER Löhne",
    "Steuern ODER Energiepreise",
    "Klima ODER Waldbrand ODER Überschwemmung ODER Erdbeben",
    "Krieg ODER Sanktionen"
  ],
  ja: [
    "生活費",
    "インフレ OR 家賃 OR 住宅ローン金利",
    "雇用市場 OR 賃金",
    "税金 OR エネルギー価格",
    "気候 OR 山火事 OR 洪水 OR 地震",
    "戦争 OR 制裁"
  ]
};

function buildFeedUrl(locale, query) {
  const config = LOCALE_CONFIG[locale] || LOCALE_CONFIG.en;
  const params = new URLSearchParams({
    q: query,
    hl: config.hl,
    gl: config.gl,
    ceid: config.ceid
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function normalizePublishedAt(pubDate) {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

function buildCandidate(item, locale, query) {
  if (!item.title || !item.link) return null;
  return {
    id: `google-news-${Buffer.from(item.link).toString("base64").slice(0, 24)}`,
    title: item.title,
    body: item.description || "",
    url: item.link,
    source: "google-news",
    source_name: "Google News",
    publishedAt: normalizePublishedAt(item.pubDate),
    locale,
    topicTags: [query, item.source].filter(Boolean),
    fetched_at: new Date().toISOString()
  };
}

async function fetchGoogleNewsCandidates({ locale, manager }) {
  const queries = QUERY_SETS[locale] || QUERY_SETS.en;
  const items = [];
  let feedsFetched = 0;

  for (const query of queries) {
    const url = buildFeedUrl(locale, query);
    const response = await manager.fetchText(url);
    if (response.skipped) {
      break;
    }
    if (!response.ok) {
      console.warn(`[google-news] Failed for ${locale} query "${query}": ${response.status}`);
      continue;
    }
    feedsFetched += 1;
    const parsed = parseRssItems(response.body);
    parsed.forEach((entry) => {
      const candidate = buildCandidate(entry, locale, query);
      if (candidate) {
        items.push(candidate);
      }
    });
  }

  return { items, feedsFetched, queryCount: queries.length };
}

module.exports = { fetchGoogleNewsCandidates };

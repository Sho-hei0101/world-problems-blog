const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { rankCandidates } = require("../rank.js");
const { generatePost } = require("../generatePost.js");
const { publishPost } = require("../publish.js");
const { createRequestManager } = require("../sources/requestManager.js");
const { fetchGoogleNewsCandidates } = require("../sources/googleNews.js");
const { fetchWikipediaCandidates } = require("../sources/wikipedia.js");
const { fetchHackerNewsCandidates } = require("../sources/hackerNews.js");
const { fetchStackExchangeCandidates } = require("../sources/stackexchange.js");

const DEFAULT_LOCALES = ["en", "es", "fr", "de", "ja"];
const MAX_POSTS_PER_LOCALE = Number.parseInt(
  process.env.WORLD_MAX_POSTS_PER_LOCALE || "2",
  10
);
const REQUEST_LIMIT = Number.parseInt(process.env.WORLD_REQUEST_LIMIT || "40", 10);
const CACHE_PATH = path.join(process.cwd(), ".cache", "world.json");
const DRY_RUN = process.env.WORLD_DRY_RUN === "1";

function ensureCacheDir() {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
}

function loadCache() {
  ensureCacheDir();
  if (!fs.existsSync(CACHE_PATH)) {
    return { seen: [] };
  }
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.seen) ? parsed : { seen: [] };
  } catch (error) {
    console.warn("Failed to read world cache, resetting.", error);
    return { seen: [] };
  }
}

function saveCache(cache) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function resolveLocalesToGenerate() {
  const envLocales = process.env.WORLD_LOCALES
    ? process.env.WORLD_LOCALES.split(",").map((locale) => locale.trim())
    : [];
  const uniqueLocales = Array.from(new Set([...DEFAULT_LOCALES, ...envLocales].filter(Boolean)));
  return uniqueLocales.length ? uniqueLocales : DEFAULT_LOCALES;
}

function canonicalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    const params = new URLSearchParams(url.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"].forEach(
      (key) => params.delete(key)
    );
    url.search = params.toString();
    url.hash = "";
    const normalized = url.toString().replace(/\/$/, "");
    return normalized;
  } catch {
    return rawUrl;
  }
}

function classifyCandidate(candidate) {
  if (!candidate.title || candidate.title.length < 12) {
    return { ok: false, reason: "title_too_short" };
  }
  const text = `${candidate.title} ${candidate.body || candidate.summary || ""}`.trim();
  if (isSpamOrUnsafeText(text)) {
    return { ok: false, reason: "spam_or_pii" };
  }
  return { ok: true };
}

function isSpamOrUnsafeText(text) {
  const lower = text.toLowerCase();
  const politics =
    /\b(politics|election|partisan|left vs right|culture war|trump|biden|democrat|republican)\b/i;
  const pii =
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\S+@\S+\.\S+\b|\bmy name is\b|\bi live at\b|\baddress is\b/i;
  const nsfw = /\b(nsfw|onlyfans|explicit)\b/i;
  return politics.test(lower) || pii.test(lower) || nsfw.test(lower);
}

const HEARTBEAT_TITLES = {
  en: "Today's pipeline status (EN)",
  es: "Estado del pipeline de hoy (ES)",
  fr: "Statut du pipeline d'aujourd'hui (FR)",
  de: "Heutiger Pipeline-Status (DE)",
  ja: "本日のパイプライン状況（JA）"
};

function buildHeartbeatPost({ locale, reason, stats }) {
  const date = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();
  const title = HEARTBEAT_TITLES[locale] || `Today's pipeline status (${locale.toUpperCase()})`;
  const sourceDigest = crypto
    .createHash("sha256")
    .update(`heartbeat|${locale}|${generatedAt}`)
    .digest("hex");
  const lines = [
    `# ${title}`,
    "",
    `Date: ${date}`,
    "",
    "## Summary",
    "",
    `- Reason: ${reason}`,
    `- Locales checked: ${stats.locales.join(", ") || "n/a"}`,
    `- Total candidates fetched: ${stats.totalCandidates}`,
    `- Total safe candidates: ${stats.totalSafe}`,
    `- Total cached skips: ${stats.totalCached}`,
    `- Total selected: ${stats.totalSelected}`,
    "",
    "## Notes",
    "",
    "This heartbeat entry is generated automatically when no new posts can be produced.",
    "It confirms the nightly pipeline executed and documents the current input conditions."
  ];

  return {
    title,
    description:
      "Daily pipeline status update for the World Problems Blog automation run.",
    date,
    tags: ["automation", "pipeline status"],
    cta_primary_label: "View repository",
    cta_primary_url: "https://github.com/Sho-hei0101/world-problems-blog",
    source_url: "",
    source_subreddit: "",
    source_name: "",
    source_id: `heartbeat-${locale}-${date}`,
    generated_at: generatedAt,
    source_digest: sourceDigest,
    body_markdown: lines.join("\n")
  };
}

function logLocaleStats(stats) {
  const reasons = Object.entries(stats.unsafeCounts)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
  const fetchSummary = stats.fetchSummary
    .map((item) => `${item.source}:${item.items}`)
    .join(" | ");
  const selectionSummary = stats.selectionSummary
    .map((item) => `${item.source}:${item.selected}`)
    .join(" | ");
  console.log(
    `Locale ${stats.locale}: fetched=${stats.items} safe=${stats.safeCandidates} cached_skips=${stats.cached} selected=${stats.selected} created=${stats.created}`
  );
  console.log(`Locale ${stats.locale}: unsafe_breakdown=${reasons || "none"}`);
  console.log(`Locale ${stats.locale}: fetch_summary=${fetchSummary || "none"}`);
  console.log(`Locale ${stats.locale}: selection_summary=${selectionSummary || "none"}`);
}

function tallyBySource(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.source || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([source, count]) => ({
    source,
    items: count
  }));
}

function tallySelections(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.source || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([source, selected]) => ({
    source,
    selected
  }));
}

async function gatherCandidates({ locale, manager }) {
  const candidates = [];
  const fetchSummary = [];

  const googleResult = await fetchGoogleNewsCandidates({ locale, manager });
  if (googleResult.items.length) {
    candidates.push(...googleResult.items);
  }
  fetchSummary.push({ source: "google-news", items: googleResult.items.length });

  if (locale === "en") {
    const wikiResult = await fetchWikipediaCandidates({ locale, manager });
    if (wikiResult.items.length) {
      candidates.push(...wikiResult.items);
    }
    fetchSummary.push({ source: "wikipedia-current-events", items: wikiResult.items.length });

    const hnResult = await fetchHackerNewsCandidates({ manager, maxItems: 4 });
    if (hnResult.items.length) {
      candidates.push(...hnResult.items);
    }
    fetchSummary.push({ source: "hacker-news", items: hnResult.items.length });

    const stackResult = await fetchStackExchangeCandidates({ manager });
    if (stackResult.items.length) {
      candidates.push(...stackResult.items);
    }
    fetchSummary.push({ source: "stackexchange", items: stackResult.items.length });
  }

  return { candidates, fetchSummary };
}

async function run() {
  if (!DRY_RUN && !process.env.OPENAI_API_KEY) {
    console.error(
      "Missing OPENAI_API_KEY. Add it in GitHub repo Settings → Secrets and variables → Actions."
    );
    process.exit(1);
  }

  const locales = resolveLocalesToGenerate();
  const cache = loadCache();
  const cachedIds = new Set(cache.seen.map((item) => item.id));
  const cachedUrls = new Set(cache.seen.map((item) => item.url));
  const cachedDigests = new Set(
    cache.seen.map((item) => item.source_digest).filter(Boolean)
  );
  const createdFiles = [];
  const localeStats = [];

  const manager = createRequestManager({ requestLimit: REQUEST_LIMIT });
  const localeCandidates = new Map();

  for (const locale of locales) {
    const { candidates, fetchSummary } = await gatherCandidates({ locale, manager });
    const deduped = new Map();
    for (const item of candidates) {
      const canonicalUrl = canonicalizeUrl(item.url);
      const dedupeKey = canonicalUrl || item.id;
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, { ...item, url: canonicalUrl || item.url });
      }
    }
    localeCandidates.set(locale, { items: Array.from(deduped.values()), fetchSummary });
  }

  const englishPool = localeCandidates.get("en")?.items || [];

  for (const locale of locales) {
    const { items, fetchSummary } = localeCandidates.get(locale) || { items: [], fetchSummary: [] };

    const unsafeCounts = {
      title_too_short: 0,
      spam_or_pii: 0
    };
    let cachedCount = 0;
    const safeCandidates = [];
    for (const item of items) {
      const verdict = classifyCandidate(item);
      if (!verdict.ok) {
        unsafeCounts[verdict.reason] += 1;
        continue;
      }
      if (
        (item.source_digest && cachedDigests.has(item.source_digest)) ||
        cachedIds.has(item.id) ||
        cachedUrls.has(item.url)
      ) {
        cachedCount += 1;
        continue;
      }
      safeCandidates.push(item);
    }

    let ranked = rankCandidates(safeCandidates, MAX_POSTS_PER_LOCALE + 3, {
      locale
    });

    if (locale !== "en" && ranked.length === 0 && englishPool.length > 0) {
      const fallback = rankCandidates(englishPool, MAX_POSTS_PER_LOCALE, {
        locale: "en"
      }).map((candidate) => ({
        ...candidate,
        locale
      }));
      ranked = fallback;
    }

    const selected = ranked.slice(0, MAX_POSTS_PER_LOCALE);
    const selectionSummary = tallySelections(selected);

    const stats = {
      locale,
      items: items.length,
      safeCandidates: safeCandidates.length,
      cached: cachedCount,
      selected: selected.length,
      created: 0,
      unsafeCounts,
      fetchSummary: fetchSummary.length ? fetchSummary : tallyBySource(items),
      selectionSummary
    };
    localeStats.push(stats);

    if (selected.length === 0) {
      console.log(`No suitable candidates for locale ${locale}.`);
      logLocaleStats(stats);
      continue;
    }

    console.log(
      `Selected ${selected.length} topic(s) for ${locale}: ${selected
        .map((item) => item.title)
        .join(" | ")}`
    );

    if (DRY_RUN) {
      selected.forEach((candidate) => {
        console.log(
          `[dry-run] ${locale} -> ${candidate.title} (${candidate.source_name || candidate.source})`
        );
      });
      logLocaleStats(stats);
      continue;
    }

    for (const candidate of selected) {
      try {
        const post = await generatePost(candidate, [candidate.url], { lang: locale });
        const publishedPath = publishPost(post, { lang: locale });
        if (publishedPath) {
          createdFiles.push(publishedPath);
          cache.seen.push({
            id: candidate.id,
            url: candidate.url,
            title: candidate.title,
            source_digest: candidate.source_digest || ""
          });
          stats.created += 1;
        }
      } catch (error) {
        console.error(`Failed to generate/publish post for ${locale}:`, error);
      }
    }
    logLocaleStats(stats);
  }

  if (!DRY_RUN) {
    cache.seen = cache.seen.slice(-300);
    saveCache(cache);
  }

  const totalCandidates = localeStats.reduce((sum, item) => sum + item.items, 0);
  const totalSafe = localeStats.reduce((sum, item) => sum + item.safeCandidates, 0);
  const totalCached = localeStats.reduce((sum, item) => sum + item.cached, 0);
  const totalSelected = localeStats.reduce((sum, item) => sum + item.selected, 0);

  if (!DRY_RUN && createdFiles.length === 0) {
    const reason =
      totalCandidates === 0
        ? "No candidates fetched."
        : totalSafe === 0
          ? "All candidates filtered out by safety rules or cache."
          : "Post generation/publish failed.";
    console.log(`No new posts were created. Reason: ${reason}`);

    for (const locale of locales) {
      const heartbeat = buildHeartbeatPost({
        locale,
        reason,
        stats: {
          locales,
          totalCandidates,
          totalSafe,
          totalCached,
          totalSelected
        }
      });
      const heartbeatPath = publishPost(heartbeat, { lang: locale });
      if (heartbeatPath) {
        createdFiles.push(heartbeatPath);
        console.log(`Heartbeat post created: ${heartbeatPath}`);
      } else {
        console.error(`Heartbeat post failed to publish for ${locale}.`);
        process.exit(1);
      }
    }
  }

  console.log(
    `Pipeline summary: candidates=${totalCandidates} safe=${totalSafe} selected=${totalSelected} created=${createdFiles.length}`
  );
  console.log(`Request usage: ${manager.getRequestCount()}/${manager.getRequestLimit()}`);
  console.log("Generated markdown paths:");
  if (createdFiles.length === 0) {
    console.log("- (none)");
  } else {
    createdFiles.forEach((file) => console.log(`- ${file}`));
  }
}

run();

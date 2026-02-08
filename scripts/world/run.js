const fs = require("fs");
const path = require("path");
const { fetchRedditPosts } = require("../sources/reddit.js");
const { rankCandidates } = require("../rank.js");
const { generatePost } = require("../generatePost.js");
const { publishPost } = require("../publish.js");
const { DEFAULT_LOCALES, getSubredditsForLocale } = require("../sources/redditConfig.js");

const MAX_POSTS_PER_LOCALE = Number.parseInt(
  process.env.WORLD_MAX_POSTS_PER_LOCALE || "2",
  10
);
const CACHE_PATH = path.join(process.cwd(), ".cache", "reddit.json");

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
    console.warn("Failed to read reddit cache, resetting.", error);
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
  const requiredLocales = DEFAULT_LOCALES;
  const uniqueLocales = Array.from(
    new Set([...requiredLocales, ...envLocales].filter(Boolean))
  );
  return uniqueLocales.length ? uniqueLocales : DEFAULT_LOCALES;
}

function classifyCandidate(candidate) {
  if (!candidate.title || candidate.title.length < 12) {
    return { ok: false, reason: "title_too_short" };
  }
  if (candidate.over_18) {
    return { ok: false, reason: "over_18" };
  }
  if (candidate.spoiler) {
    return { ok: false, reason: "spoiler" };
  }
  const text = `${candidate.title} ${candidate.body || ""}`.trim();
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

function buildHeartbeatPost({ locale, reason, stats }) {
  const date = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();
  const title = `Today's pipeline status (${locale.toUpperCase()})`;
  const lines = [
    "# Today's pipeline status",
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
    source_id: `heartbeat-${new Date().toISOString()}`,
    generated_at: generatedAt,
    source_digest: "",
    body_markdown: lines.join("\n")
  };
}

function logLocaleStats(stats) {
  const reasons = Object.entries(stats.unsafeCounts)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
  const fetchSummary = stats.fetchSummary
    .map((item) => `${item.sort}:${item.items} items`)
    .join(" | ");
  console.log(
    `Locale ${stats.locale}: fetched=${stats.items} safe=${stats.safeCandidates} cached_skips=${stats.cached} selected=${stats.selected} created=${stats.created}`
  );
  console.log(`Locale ${stats.locale}: unsafe_breakdown=${reasons || "none"}`);
  console.log(`Locale ${stats.locale}: fetch_summary=${fetchSummary || "none"}`);
}

async function run() {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "Missing OPENAI_API_KEY. Add it in GitHub repo Settings → Secrets and variables → Actions."
    );
    process.exit(1);
  }

  const locales = resolveLocalesToGenerate();
  const cache = loadCache();
  const cachedIds = new Set(cache.seen.map((item) => item.id));
  const cachedUrls = new Set(cache.seen.map((item) => item.url));
  const createdFiles = [];
  const localeStats = [];

  for (const locale of locales) {
    const subreddits = getSubredditsForLocale(locale);
    const fetchSummary = [];
    const uniqueItems = new Map();
    let subredditsFetched = 0;

    for (const sort of ["hot", "new", "top"]) {
      const { items, subredditsFetched: fetchedCount } = await fetchRedditPosts({
        subreddits,
        localeHint: locale,
        sort
      });
      subredditsFetched += fetchedCount;
      fetchSummary.push({ sort, items: items.length });
      for (const item of items) {
        if (!uniqueItems.has(item.id)) {
          uniqueItems.set(item.id, item);
        }
      }
    }

    const items = Array.from(uniqueItems.values());
    console.log(
      `Fetched ${subredditsFetched} subreddit(s) for ${locale} with ${items.length} unique candidate items.`
    );

    const unsafeCounts = {
      title_too_short: 0,
      over_18: 0,
      spoiler: 0,
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
      if (cachedIds.has(item.id) || cachedUrls.has(item.url)) {
        cachedCount += 1;
        continue;
      }
      safeCandidates.push(item);
    }

    const ranked = rankCandidates(safeCandidates, MAX_POSTS_PER_LOCALE + 3);
    const selected = ranked.slice(0, MAX_POSTS_PER_LOCALE);

    const stats = {
      locale,
      subredditsFetched,
      items: items.length,
      safeCandidates: safeCandidates.length,
      cached: cachedCount,
      selected: selected.length,
      created: 0,
      unsafeCounts,
      fetchSummary
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

    for (const candidate of selected) {
      try {
        const post = await generatePost(candidate, [candidate.url], { lang: locale });
        const publishedPath = publishPost(post, { lang: locale });
        if (publishedPath) {
          createdFiles.push(publishedPath);
          cache.seen.push({ id: candidate.id, url: candidate.url, title: candidate.title });
          stats.created += 1;
        }
      } catch (error) {
        console.error(`Failed to generate/publish post for ${locale}:`, error);
      }
    }
    logLocaleStats(stats);
  }

  cache.seen = cache.seen.slice(-300);
  saveCache(cache);

  if (createdFiles.length === 0) {
    const totalCandidates = localeStats.reduce((sum, item) => sum + item.items, 0);
    const totalSafe = localeStats.reduce((sum, item) => sum + item.safeCandidates, 0);
    const totalCached = localeStats.reduce((sum, item) => sum + item.cached, 0);
    const totalSelected = localeStats.reduce((sum, item) => sum + item.selected, 0);
    const reason =
      totalCandidates === 0
        ? "No Reddit candidates fetched."
        : totalSafe === 0
          ? "All candidates filtered out by safety rules or cache."
          : "Post generation/publish failed.";
    console.log(`No new posts were created. Reason: ${reason}`);

    const heartbeat = buildHeartbeatPost({
      locale: "en",
      reason,
      stats: {
        locales,
        totalCandidates,
        totalSafe,
        totalCached,
        totalSelected
      }
    });
    const heartbeatPath = publishPost(heartbeat, { lang: "en" });
    if (heartbeatPath) {
      createdFiles.push(heartbeatPath);
      console.log(`Heartbeat post created: ${heartbeatPath}`);
    } else {
      console.error("Heartbeat post failed to publish.");
      process.exit(1);
    }
  }

  console.log("Created posts:");
  createdFiles.forEach((file) => console.log(`- ${file}`));
}

run();

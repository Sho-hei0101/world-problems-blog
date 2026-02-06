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

function resolvePostsDirs(lang) {
  return [
    path.join(process.cwd(), "content", "posts", lang),
    path.join(process.cwd(), "content", lang, "posts")
  ].filter((dir) => fs.existsSync(dir));
}

function countExistingPosts() {
  return DEFAULT_LOCALES.reduce((count, lang) => {
    const dirs = resolvePostsDirs(lang);
    const fileCount = dirs.reduce((sum, dir) => {
      const files = fs.readdirSync(dir).filter((file) => file.endsWith(".md"));
      return sum + files.length;
    }, 0);
    return count + fileCount;
  }, 0);
}

function resolveLocalesToGenerate() {
  const envLocales = process.env.WORLD_LOCALES
    ? process.env.WORLD_LOCALES.split(",").map((locale) => locale.trim())
    : DEFAULT_LOCALES;
  const uniqueLocales = Array.from(new Set(envLocales.filter(Boolean)));
  return uniqueLocales.length ? uniqueLocales : ["en"];
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

function isCandidateSafe(candidate) {
  const text = `${candidate.title} ${candidate.body || ""}`.trim();
  if (!candidate.title || candidate.title.length < 12) {
    return false;
  }
  if (candidate.over_18 || candidate.spoiler) {
    return false;
  }
  if (isSpamOrUnsafeText(text)) {
    return false;
  }
  return true;
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

  for (const locale of locales) {
    const subreddits = getSubredditsForLocale(locale);
    const { items, subredditsFetched } = await fetchRedditPosts({
      subreddits,
      localeHint: locale
    });
    console.log(
      `Fetched ${subredditsFetched} subreddit(s) for ${locale} with ${items.length} candidate items.`
    );

    const filtered = items
      .filter(isCandidateSafe)
      .filter((item) => !cachedIds.has(item.id) && !cachedUrls.has(item.url));

    const ranked = rankCandidates(filtered, MAX_POSTS_PER_LOCALE + 3);
    const selected = ranked.slice(0, MAX_POSTS_PER_LOCALE);

    if (selected.length === 0) {
      console.log(`No suitable candidates for locale ${locale}.`);
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
        }
      } catch (error) {
        console.error(`Failed to generate/publish post for ${locale}:`, error);
      }
    }
  }

  cache.seen = cache.seen.slice(-300);
  saveCache(cache);

  if (createdFiles.length === 0) {
    console.log("No new posts were created.");
    if (countExistingPosts() === 0) {
      process.exitCode = 1;
    }
    return;
  }

  console.log("Created posts:");
  createdFiles.forEach((file) => console.log(`- ${file}`));
}

run();

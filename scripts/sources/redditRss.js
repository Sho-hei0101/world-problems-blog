const fs = require("fs");
const path = require("path");

const DEFAULT_SUBREDDITS = [
  "AskReddit",
  "NoStupidQuestions",
  "ExplainLikeImFive",
  "personalfinance",
  "legaladvice",
  "relationships",
  "careerquestions",
  "sysadmin",
  "webdev",
  "learnprogramming",
  "smallbusiness",
  "frugal",
  "travel",
  "parenting",
  "fitness"
];

const USER_AGENT =
  "world-problems-blog-bot/1.0 (+https://github.com/Sho-hei0101/world-problems-blog)";
const MAX_FEEDS = 6;
const DELAY_MS = 400;
const CACHE_PATH = path.join(process.cwd(), ".cache", "reddit.json");
const FALLBACK_SAMPLE_PATH = path.join(process.cwd(), "scripts", "sources", "redditSample.xml");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function extractLink(block) {
  const alternate = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alternate) {
    return alternate[1];
  }
  const anyLink = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (anyLink) {
    return anyLink[1];
  }
  const linkText = extractTag(block, "link");
  if (linkText) {
    return linkText.trim();
  }
  const guid = extractTag(block, "guid");
  return guid ? guid.trim() : "";
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, "").replace(/\\s+/g, " ").trim();
}

function isSpamTitle(title) {
  const lower = title.toLowerCase();
  return (
    /free money|giveaway|promo|sponsored|airdrop|crypto|onlyfans|nsfw|subscribe/i.test(lower) ||
    lower.includes("http://") ||
    lower.includes("https://")
  );
}

function inferSubredditFromLink(link) {
  const match = link
    ? link.match(new RegExp("reddit\\.com\\/r\\/([^/]+)", "i"))
    : null;
  return match ? match[1] : "";
}

function parseEntries(xml, subreddit) {
  const entryRegex = new RegExp("<entry>([\\s\\S]*?)</entry>", "gi");
  const itemRegex = new RegExp("<item>([\\s\\S]*?)</item>", "gi");
  const blocks = [...(xml.match(entryRegex) || []), ...(xml.match(itemRegex) || [])];
  return blocks
    .map((block) => {
      const title = stripHtml(extractTag(block, "title"));
      const link = extractLink(block);
      const published =
        extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "pubDate");
      const summary = stripHtml(
        extractTag(block, "summary") || extractTag(block, "content") || extractTag(block, "description")
      );
      return {
        title,
        link,
        published: published || null,
        summary,
        subreddit: subreddit || inferSubredditFromLink(link)
      };
    })
    .filter((item) => item.title && item.link);
}

function sanityCheckRssParsing() {
  const sample = `
    <feed>
      <entry>
        <title>Why are rents rising?</title>
        <link rel="alternate" href="https://reddit.com/r/personalfinance/1" />
        <published>2024-07-01T12:00:00Z</published>
        <summary>Rents are up everywhere.</summary>
      </entry>
    </feed>
    <rss>
      <channel>
        <item>
          <title>How to reduce burnout as a sysadmin</title>
          <link>https://reddit.com/r/sysadmin/2</link>
          <pubDate>Mon, 01 Jul 2024 12:00:00 GMT</pubDate>
          <description>Long shifts and pager fatigue.</description>
        </item>
      </channel>
    </rss>
  `;
  const results = parseEntries(sample, "test");
  return results.length === 2 && results.every((item) => item.title && item.link);
}

function loadFallbackSample() {
  if (!fs.existsSync(FALLBACK_SAMPLE_PATH)) {
    return [];
  }
  try {
    const xml = fs.readFileSync(FALLBACK_SAMPLE_PATH, "utf8");
    return parseEntries(xml);
  } catch (error) {
    console.warn("Failed to load fallback RSS sample.", error);
    return [];
  }
}

async function fetchRedditRss(subreddits = DEFAULT_SUBREDDITS) {
  if (!sanityCheckRssParsing()) {
    console.warn("RSS sanity check failed. Parsing may be unreliable.");
  }

  const items = [];
  const cache = loadCache();
  const cachedLinks = new Set(cache.seen.map((item) => item.url));
  const cachedTitles = new Set(cache.seen.map((item) => item.title.toLowerCase()));

  const selectedSubreddits = subreddits.slice(0, MAX_FEEDS);
  let feedsFetched = 0;

  for (const subreddit of selectedSubreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/new/.rss`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT
        }
      });

      feedsFetched += 1;

      if (!response.ok) {
        console.warn(`Reddit RSS fetch failed for ${subreddit}: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      items.push(...parseEntries(xml, subreddit));
    } catch (error) {
      console.warn(`Reddit RSS error for ${subreddit}:`, error);
    }

    if (DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  if (items.length === 0) {
    const fallback = loadFallbackSample();
    if (fallback.length > 0) {
      console.warn("Using fallback RSS sample due to empty fetch results.");
      items.push(...fallback);
    }
  }

  const seenLinks = new Set();
  const filtered = items.filter((item) => {
    if (!item.title || item.title.length < 12) {
      return false;
    }
    if (isSpamTitle(item.title)) {
      return false;
    }
    if (cachedLinks.has(item.link)) {
      return false;
    }
    if (cachedTitles.has(item.title.toLowerCase())) {
      return false;
    }
    if (seenLinks.has(item.link)) {
      return false;
    }
    seenLinks.add(item.link);
    return true;
  });

  const nextCache = {
    seen: [
      ...cache.seen,
      ...filtered.map((item) => ({
        url: item.link,
        title: item.title,
        summary: item.summary,
        subreddit: item.subreddit,
        published: item.published
      }))
    ]
  };
  nextCache.seen = nextCache.seen.slice(-200);
  saveCache(nextCache);

  return { items: filtered, feedsFetched };
}

module.exports = { fetchRedditRss, DEFAULT_SUBREDDITS };

const crypto = require("crypto");

const USER_AGENT =
  "world-problems-bot/1.0 (https://world-problems-blog.vercel.app; contact: info@shichifuku-sl.com)";
const ACCEPT_JSON = "application/json";
const ACCEPT_RSS = "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7";
const MAX_SUBREDDITS_PER_LOCALE = 6;
const DEFAULT_LIMIT = 50;
const REQUEST_DELAY_MS = 600;
const RETRY_DELAYS_MS = [1000, 3000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      console.log(`[reddit] GET ${url} -> ${response.status}`);
      if (!response.ok) {
        const snippet = await response
          .text()
          .then((text) => text.slice(0, 200))
          .catch(() => "");
        if (snippet) {
          console.warn(`[reddit] Non-200 response body snippet: ${snippet}`);
        }
      }
      if (response.ok) {
        return response;
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          attempt += 1;
          continue;
        }
      }
      return response;
    } catch (error) {
      console.warn(`[reddit] Request error for ${url}:`, error);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

function buildSourceDigest({ url, id, fetchedAt }) {
  const raw = `${url || ""}|${id || ""}|${fetchedAt || ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function normalizePost(post, localeHint, fetchedAt) {
  const url = post.permalink ? `https://www.reddit.com${post.permalink}` : post.url;
  const id = post.id || url;
  return {
    id,
    title: post.title || "",
    body: post.selftext || "",
    url,
    subreddit: post.subreddit || "",
    score: post.score || 0,
    num_comments: post.num_comments || 0,
    created_utc: post.created_utc,
    locale_hint: localeHint,
    fetched_at: fetchedAt,
    source_digest: buildSourceDigest({ url, id, fetchedAt })
  };
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? stripHtml(match[1]).trim() : "";
}

function parseRssItems(xml) {
  const items = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of itemMatches) {
    const title = extractTagValue(itemXml, "title");
    const link = extractTagValue(itemXml, "link");
    const guid = extractTagValue(itemXml, "guid");
    const description = extractTagValue(itemXml, "description");
    if (!title || !link) {
      continue;
    }
    items.push({
      id: guid || link,
      title,
      body: description,
      url: link
    });
  }
  return items;
}

async function fetchRssPosts({ subreddit, localeHint }) {
  const url = `https://www.reddit.com/r/${subreddit}/.rss`;
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: ACCEPT_RSS
    }
  });
  if (!response.ok) {
    console.warn(`Reddit RSS fetch failed for ${subreddit}: ${response.status}`);
    return [];
  }
  const fetchedAt = new Date().toISOString();
  const xml = await response.text();
  const items = parseRssItems(xml);
  return items.map((item) => {
    const normalized = normalizePost(
      {
        id: item.id,
        title: item.title,
        selftext: item.body,
        url: item.url,
        permalink: ""
      },
      localeHint,
      fetchedAt
    );
    return {
      ...normalized,
      over_18: false,
      spoiler: false
    };
  });
}

async function fetchRedditPosts({
  subreddits,
  limit = DEFAULT_LIMIT,
  localeHint = "en",
  sort = "hot"
}) {
  const items = [];
  const selected = (subreddits || []).slice(0, MAX_SUBREDDITS_PER_LOCALE);
  let subredditsFetched = 0;

  for (const subreddit of selected) {
    const safeSort = sort || "hot";
    const url = `https://www.reddit.com/r/${subreddit}/${safeSort}.json?limit=${limit}`;
    try {
      const response = await fetchWithRetry(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: ACCEPT_JSON
        }
      });

      subredditsFetched += 1;

      if (!response.ok) {
        console.warn(`Reddit fetch failed for ${subreddit}: ${response.status}`);
        const rssItems = await fetchRssPosts({ subreddit, localeHint });
        items.push(...rssItems);
        continue;
      }

      const fetchedAt = new Date().toISOString();
      let json;
      try {
        json = await response.json();
      } catch (error) {
        console.warn(`Reddit JSON parse failed for ${subreddit}:`, error);
        const rssItems = await fetchRssPosts({ subreddit, localeHint });
        items.push(...rssItems);
        continue;
      }
      const children = json?.data?.children || [];
      if (children.length === 0) {
        const rssItems = await fetchRssPosts({ subreddit, localeHint });
        items.push(...rssItems);
      }
      for (const child of children) {
        const post = child?.data;
        if (!post || post.stickied) {
          continue;
        }
        items.push({
          ...normalizePost(post, localeHint, fetchedAt),
          over_18: post.over_18 || false,
          spoiler: post.spoiler || false
        });
      }
    } catch (error) {
      console.warn(`Reddit fetch error for ${subreddit}:`, error);
    }

    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { items, subredditsFetched };
}

module.exports = { fetchRedditPosts };

const USER_AGENT =
  "world-problems-blog-bot/1.0 (+https://github.com/Sho-hei0101/world-problems-blog)";
const MAX_SUBREDDITS_PER_LOCALE = 6;
const DEFAULT_LIMIT = 50;
const REQUEST_DELAY_MS = 600;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Reddit responded ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
    }

    attempt += 1;
    if (attempt <= retries) {
      await sleep(REQUEST_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

function normalizePost(post, localeHint) {
  return {
    id: post.id,
    title: post.title || "",
    body: post.selftext || "",
    url: post.permalink ? `https://www.reddit.com${post.permalink}` : post.url,
    subreddit: post.subreddit || "",
    score: post.score || 0,
    num_comments: post.num_comments || 0,
    created_utc: post.created_utc,
    locale_hint: localeHint
  };
}

async function fetchRedditPosts({ subreddits, limit = DEFAULT_LIMIT, localeHint = "en" }) {
  const items = [];
  const selected = (subreddits || []).slice(0, MAX_SUBREDDITS_PER_LOCALE);
  let subredditsFetched = 0;

  for (const subreddit of selected) {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
    try {
      const response = await fetchWithRetry(url, {
        headers: {
          "User-Agent": USER_AGENT
        }
      });

      subredditsFetched += 1;

      if (!response.ok) {
        console.warn(`Reddit fetch failed for ${subreddit}: ${response.status}`);
        continue;
      }

      const json = await response.json();
      const children = json?.data?.children || [];
      for (const child of children) {
        const post = child?.data;
        if (!post || post.stickied) {
          continue;
        }
        items.push({
          ...normalizePost(post, localeHint),
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

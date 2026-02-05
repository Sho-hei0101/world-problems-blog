const DEFAULT_SUBREDDITS = [
  "worldnews",
  "climate",
  "environment",
  "sustainability",
  "renewableenergy",
  "foodsecurity",
  "water",
  "infrastructure",
  "housing"
];

const USER_AGENT = "WorldProblemsBot/1.0 (+https://example.com)";

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function extractLink(block) {
  const alternate = block.match(/<link[^>]*rel=\"alternate\"[^>]*href=\"([^\"]+)\"/i);
  if (alternate) {
    return alternate[1];
  }
  const anyLink = block.match(/<link[^>]*href=\"([^\"]+)\"/i);
  return anyLink ? anyLink[1] : "";
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, "").replace(/\\s+/g, " ").trim();
}

async function fetchRedditRss(subreddits = DEFAULT_SUBREDDITS) {
  const items = [];

  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/.rss`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT
        }
      });

      if (!response.ok) {
        console.warn(`Reddit RSS fetch failed for ${subreddit}: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const entryRegex = /<entry>([\\s\\S]*?)<\\/entry>/gi;
      const matches = xml.match(entryRegex) || [];

      matches.forEach((block) => {
        const title = stripHtml(extractTag(block, "title"));
        const link = extractLink(block);
        if (!title || !link) {
          return;
        }
        const published = extractTag(block, "published") || extractTag(block, "updated");
        const summary = stripHtml(extractTag(block, "summary") || extractTag(block, "content"));

        items.push({
          title,
          link,
          published: published || null,
          summary,
          subreddit
        });
      });
    } catch (error) {
      console.warn(`Reddit RSS error for ${subreddit}:`, error);
    }
  }

  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.link)) {
      return false;
    }
    seen.add(item.link);
    return true;
  });
}

module.exports = { fetchRedditRss, DEFAULT_SUBREDDITS };

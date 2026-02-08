import { SUPPORTED_LANGUAGES, getAllPosts, buildPostUrl } from "../../lib/posts";
import { SITE_URL, SITE_NAME } from "../../lib/site";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = SUPPORTED_LANGUAGES.flatMap((lang) =>
    getAllPosts(lang).map((post) => ({
      ...post,
      lang
    }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = posts.slice(0, 50).map((post) => {
    const link = `${SITE_URL}${buildPostUrl(post.lang, post.slug)}`;
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description || "")}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${escapeXml(SITE_URL)}</link>
      <description>${escapeXml("Latest posts from World Problems Blog.")}</description>
      ${items.join("")}
    </channel>
  </rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8"
    }
  });
}

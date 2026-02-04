import {
  SUPPORTED_LANGUAGES,
  getAllPosts,
  buildPostUrl,
  buildTagUrl
} from "../lib/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default function sitemap() {
  const entries = [];

  SUPPORTED_LANGUAGES.forEach((lang) => {
    entries.push({
      url: `${SITE_URL}/${lang}`,
      lastModified: new Date()
    });

    const posts = getAllPosts(lang);
    posts.forEach((post) => {
      entries.push({
        url: `${SITE_URL}${buildPostUrl(lang, post.slug)}`,
        lastModified: post.date
      });

      post.tags?.forEach((tag) => {
        entries.push({
          url: `${SITE_URL}${buildTagUrl(lang, tag)}`,
          lastModified: post.date
        });
      });
    });
  });

  return entries;
}

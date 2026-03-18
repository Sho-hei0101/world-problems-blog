import {
  SUPPORTED_LANGUAGES,
  getAllPosts,
  buildPostUrl,
  buildTagUrl,
  getTranslationsForSlug
} from "../lib/posts";
import { buildCanonicalUrl } from "../lib/site";

export default function sitemap() {
  const entries = [];

  SUPPORTED_LANGUAGES.forEach((lang) => {
    entries.push({
      url: buildCanonicalUrl(`/${lang}`),
      lastModified: new Date(),
      alternates: {
        languages: SUPPORTED_LANGUAGES.reduce((acc, locale) => {
          acc[locale] = buildCanonicalUrl(`/${locale}`);
          return acc;
        }, {})
      }
    });

    const posts = getAllPosts(lang);
    posts.forEach((post) => {
      const translations = getTranslationsForSlug(post.slug);
      const languages = Object.keys(translations).reduce((acc, locale) => {
        acc[locale] = buildCanonicalUrl(buildPostUrl(locale, post.slug));
        return acc;
      }, {});
      entries.push({
        url: buildCanonicalUrl(buildPostUrl(lang, post.slug)),
        lastModified: post.date,
        alternates: {
          languages
        }
      });
      entries.push({
        url: buildCanonicalUrl(`/${lang}/checklist/${post.slug}`),
        lastModified: post.date,
        alternates: {
          languages: Object.keys(translations).reduce((acc, locale) => {
            acc[locale] = buildCanonicalUrl(`/${locale}/checklist/${post.slug}`);
            return acc;
          }, {})
        }
      });

      post.tags?.forEach((tag) => {
        entries.push({
          url: buildCanonicalUrl(buildTagUrl(lang, tag)),
          lastModified: post.date,
          alternates: {
            languages: {
              [lang]: buildCanonicalUrl(buildTagUrl(lang, tag))
            }
          }
        });
      });
    });
  });

  return entries;
}

import {
  SUPPORTED_LANGUAGES,
  getAllPosts,
  buildPostUrl,
  buildTagUrl,
  getTranslationsForSlug
} from "../lib/posts";
import { SITE_URL } from "../lib/site";

export default function sitemap() {
  const entries = [];

  SUPPORTED_LANGUAGES.forEach((lang) => {
    entries.push({
      url: `${SITE_URL}/${lang}`,
      lastModified: new Date(),
      alternates: {
        languages: SUPPORTED_LANGUAGES.reduce((acc, locale) => {
          acc[locale] = `${SITE_URL}/${locale}`;
          return acc;
        }, {})
      }
    });

    const posts = getAllPosts(lang);
    posts.forEach((post) => {
      const translations = getTranslationsForSlug(post.slug);
      const languages = Object.keys(translations).reduce((acc, locale) => {
        acc[locale] = `${SITE_URL}${buildPostUrl(locale, post.slug)}`;
        return acc;
      }, {});
      entries.push({
        url: `${SITE_URL}${buildPostUrl(lang, post.slug)}`,
        lastModified: post.date,
        alternates: {
          languages
        }
      });
      entries.push({
        url: `${SITE_URL}/${lang}/checklist/${post.slug}`,
        lastModified: post.date,
        alternates: {
          languages: Object.keys(translations).reduce((acc, locale) => {
            acc[locale] = `${SITE_URL}/${locale}/checklist/${post.slug}`;
            return acc;
          }, {})
        }
      });

      post.tags?.forEach((tag) => {
        entries.push({
          url: `${SITE_URL}${buildTagUrl(lang, tag)}`,
          lastModified: post.date,
          alternates: {
            languages: {
              [lang]: `${SITE_URL}${buildTagUrl(lang, tag)}`
            }
          }
        });
      });
    });
  });

  return entries;
}

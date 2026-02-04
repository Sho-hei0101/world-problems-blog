import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");
export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "ja"];

export function getPostSlugs(lang) {
  const postsDir = path.join(CONTENT_DIR, lang, "posts");
  if (!fs.existsSync(postsDir)) {
    return [];
  }
  return fs
    .readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

export function getPostBySlug(lang, slug) {
  const filePath = path.join(CONTENT_DIR, lang, "posts", `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);
  return {
    slug,
    lang,
    ...data,
    content,
    html: marked.parse(content)
  };
}

export function getAllPosts(lang) {
  return getPostSlugs(lang)
    .map((slug) => getPostBySlug(lang, slug))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getPostsByTag(lang, tag) {
  return getAllPosts(lang).filter((post) =>
    Array.isArray(post.tags)
      ? post.tags.map((item) => item.toLowerCase()).includes(tag.toLowerCase())
      : false
  );
}

export function getTranslationsForSlug(slug) {
  return SUPPORTED_LANGUAGES.reduce((acc, lang) => {
    const post = getPostBySlug(lang, slug);
    if (post) {
      acc[lang] = post;
    }
    return acc;
  }, {});
}

export function buildPostUrl(lang, slug) {
  return `/${lang}/posts/${slug}`;
}

export function buildTagUrl(lang, tag) {
  return `/${lang}/tags/${encodeURIComponent(tag)}`;
}

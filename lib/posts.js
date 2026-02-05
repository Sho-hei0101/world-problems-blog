import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");
const LEGACY_POSTS_DIR = path.join(CONTENT_DIR, "posts");
export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "ja"];

function getPostsDirectories(lang) {
  return [
    path.join(CONTENT_DIR, lang, "posts"),
    path.join(LEGACY_POSTS_DIR, lang)
  ].filter((dir) => fs.existsSync(dir));
}

export function getPostSlugs(lang) {
  const postsDirs = getPostsDirectories(lang);
  if (postsDirs.length === 0) {
    return [];
  }
  const slugs = postsDirs.flatMap((postsDir) =>
    fs
      .readdirSync(postsDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(/\.md$/, ""))
  );
  return Array.from(new Set(slugs));
}

export function getPostBySlug(lang, slug) {
  const fileName = `${slug}.md`;
  const postsDirs = getPostsDirectories(lang);
  const filePath = postsDirs
    .map((postsDir) => path.join(postsDir, fileName))
    .find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
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
  const posts = getPostSlugs(lang)
    .map((slug) => getPostBySlug(lang, slug))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (lang === "en" && posts.length === 0) {
    console.warn("No English posts found during build.");
  }
  return posts;
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

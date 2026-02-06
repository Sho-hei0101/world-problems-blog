import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");
const LEGACY_POSTS_DIR = path.join(CONTENT_DIR, "posts");
export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "ja"];

function parseLegacyTableFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (!lines[0]?.trim().startsWith("|")) {
    return null;
  }

  let tableEndIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith("|")) {
      tableEndIndex = i;
      break;
    }
  }
  if (tableEndIndex === -1) {
    return null;
  }

  const tableLines = lines.slice(0, tableEndIndex).filter((line) => line.trim().startsWith("|"));
  const data = {};
  for (const line of tableLines) {
    const columns = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (columns.length < 2 || columns[0].toLowerCase() === "key") {
      continue;
    }
    const key = columns[0].toLowerCase().replace(/\s+/g, "_");
    const value = columns.slice(1).join(" ").trim();
    if (!value || value === "---") {
      continue;
    }
    if (key === "tags") {
      data[key] = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      data[key] = value;
    }
  }

  const remaining = lines.slice(tableEndIndex).join("\n").replace(/^\s+/, "");
  return { data, content: remaining };
}

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
  const parsed = matter(fileContents);
  let { data, content } = parsed;
  if (!data || Object.keys(data).length === 0) {
    const legacy = parseLegacyTableFrontmatter(parsed.content);
    if (legacy) {
      data = legacy.data;
      content = legacy.content;
    }
  }
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

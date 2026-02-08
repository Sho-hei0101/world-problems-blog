const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONTENT_DIR = path.join(process.cwd(), "content");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function yamlString(value) {
  const escaped = String(value).replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function formatYamlList(values, indent = 0) {
  const padding = " ".repeat(indent);
  return values.map((value) => `${padding}- ${value}`).join("\n");
}

function resolvePostsDir(lang) {
  return path.join(CONTENT_DIR, "posts", lang);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildSourceSuffix(post) {
  const raw = post.source_id || post.source_url || "";
  if (!raw) {
    return "";
  }
  return crypto.createHash("sha256").update(String(raw)).digest("hex").slice(0, 10);
}

function fileExistsAcrossDirs(fileName, lang) {
  const candidates = [
    path.join(CONTENT_DIR, "posts", lang, fileName),
    path.join(CONTENT_DIR, lang, "posts", fileName)
  ];
  return candidates.some((filePath) => fs.existsSync(filePath));
}

function resolveUniqueFileName(baseSlug, date, lang) {
  const baseName = `${baseSlug}-${date}`;
  let counter = 1;
  let fileName = `${baseName}.md`;
  while (fileExistsAcrossDirs(fileName, lang)) {
    counter += 1;
    fileName = `${baseName}-${counter}.md`;
  }
  return fileName;
}

function publishPost(post, options = {}) {
  const lang = options.lang || "en";
  const title = post.title?.trim();
  if (!title) {
    throw new Error("Post title is required.");
  }

  const date = post.date || new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const sourceSuffix = buildSourceSuffix(post);
  const baseSlug = sourceSuffix ? `${slug}-${sourceSuffix}` : slug;
  const fileName = resolveUniqueFileName(baseSlug, date, lang);

  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(post.description || "")}`,
    `date: ${yamlString(date)}`,
    "tags:",
    formatYamlList(
      Array.isArray(post.tags) && post.tags.length > 0
        ? post.tags.map((tag) => yamlString(tag))
        : [yamlString("world problems")],
      2
    ),
    `source_url: ${yamlString(post.source_url || "")}`,
    `source_subreddit: ${yamlString(post.source_subreddit || "")}`,
    `source_id: ${yamlString(post.source_id || "")}`,
    `cta_primary_label: ${yamlString(post.cta_primary_label || "Learn more")}`,
    `cta_primary_url: ${yamlString(post.cta_primary_url || "https://example.com/world")}`,
    "---",
    "",
    post.body_markdown.trim(),
    ""
  ].join("\n");

  const targetDir = resolvePostsDir(lang);
  ensureDir(targetDir);

  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, frontmatter, "utf8");
  console.log(`Published ${fileName}`);
  return filePath;
}

module.exports = { publishPost };

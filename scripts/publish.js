const fs = require("fs");
const path = require("path");

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

function formatFaqList(faqs, indent = 0) {
  const padding = " ".repeat(indent);
  return faqs
    .map(
      (item) =>
        `${padding}- question: ${yamlString(item.question)}\n${padding}  answer: ${yamlString(item.answer)}`
    )
    .join("\n");
}

function resolvePostsDir() {
  return path.join(CONTENT_DIR, "posts", "en");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExistsAcrossDirs(fileName) {
  const candidates = [
    path.join(CONTENT_DIR, "posts", "en", fileName),
    path.join(CONTENT_DIR, "en", "posts", fileName)
  ];
  return candidates.some((filePath) => fs.existsSync(filePath));
}

function publishPost(post) {
  const title = post.title?.trim();
  if (!title) {
    throw new Error("Post title is required.");
  }

  const date = post.date || new Date().toISOString().slice(0, 10);
  const slug = slugify(post.slug || title);
  const fileName = `${slug}-${date}.md`;

  if (fileExistsAcrossDirs(fileName)) {
    console.log(`Post already exists: ${fileName}`);
    return null;
  }

  const faqItems = Array.isArray(post.faq) ? post.faq : [];
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
    `cta_primary_label: ${yamlString(post.cta_primary_label || "Learn more")}`,
    `cta_primary_url: ${yamlString(post.cta_primary_url || "https://example.com/world")}`,
    `meta_title: ${yamlString(post.meta_title || title)}`,
    `meta_description: ${yamlString(post.meta_description || post.description || "")}`,
    "keywords:",
    formatYamlList(
      Array.isArray(post.keywords) && post.keywords.length > 0
        ? post.keywords.map((keyword) => yamlString(keyword))
        : [yamlString("world problems")],
      2
    ),
    faqItems.length > 0 ? "faq:" : "faq: []",
    faqItems.length > 0 ? formatFaqList(faqItems, 2) : "",
    "---",
    "",
    post.body_markdown.trim(),
    ""
  ].join("\n");

  const targetDir = resolvePostsDir();
  ensureDir(targetDir);

  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, frontmatter, "utf8");
  console.log(`Published ${fileName}`);
  return filePath;
}

module.exports = { publishPost };

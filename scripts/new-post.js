const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const langIndex = args.indexOf("--lang");
const slugIndex = args.indexOf("--slug");

if (langIndex === -1 || slugIndex === -1) {
  console.log("Usage: npm run new:post -- --lang <lang> --slug <slug>");
  process.exit(1);
}

const lang = args[langIndex + 1];
const slug = args[slugIndex + 1];

if (!lang || !slug) {
  console.log("Both --lang and --slug must be provided.");
  process.exit(1);
}

const allowedLangs = ["en", "es", "fr", "de", "ja"];
if (!allowedLangs.includes(lang)) {
  console.log(`Unsupported language: ${lang}`);
  process.exit(1);
}

const targetDir = path.join(process.cwd(), "content", lang, "posts");
const targetFile = path.join(targetDir, `${slug}.md`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(targetFile)) {
  console.log(`Post already exists: ${targetFile}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const template = `---
title: "New post title"
description: "Short summary for the post."
date: "${today}"
tags:
  - change-me
cta_primary_label: "Call to action"
cta_primary_url: "https://example.com"
---

Write your post content here.
`;

fs.writeFileSync(targetFile, template, "utf8");
console.log(`Created ${targetFile}`);

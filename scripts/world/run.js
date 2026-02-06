const fs = require("fs");
const path = require("path");
const { fetchRedditRss } = require("../sources/redditRss.js");
const { rankCandidates } = require("../rank.js");
const { generatePost } = require("../generatePost.js");
const { publishPost } = require("../publish.js");

const DEFAULT_LOCALES = ["en", "es", "fr", "de", "ja"];
const MAX_POSTS_PER_RUN = 2;

function resolvePostsDirs(lang) {
  return [
    path.join(process.cwd(), "content", "posts", lang),
    path.join(process.cwd(), "content", lang, "posts")
  ].filter((dir) => fs.existsSync(dir));
}

function countExistingPosts() {
  return DEFAULT_LOCALES.reduce((count, lang) => {
    const dirs = resolvePostsDirs(lang);
    const fileCount = dirs.reduce((sum, dir) => {
      const files = fs.readdirSync(dir).filter((file) => file.endsWith(".md"));
      return sum + files.length;
    }, 0);
    return count + fileCount;
  }, 0);
}

function resolveLocalesToGenerate() {
  const envLocales = process.env.WORLD_LOCALES
    ? process.env.WORLD_LOCALES.split(",").map((locale) => locale.trim())
    : DEFAULT_LOCALES;
  const uniqueLocales = Array.from(new Set(envLocales.filter(Boolean)));

  if (!process.env.OPENAI_API_KEY && uniqueLocales.some((locale) => locale !== "en")) {
    console.log(
      "OpenAI API key missing; generating English only. To enable locales, set OPENAI_API_KEY and WORLD_LOCALES."
    );
    return ["en"];
  }

  return uniqueLocales.length ? uniqueLocales : ["en"];
}

async function run() {
  const { items, feedsFetched } = await fetchRedditRss();
  console.log(`Fetched ${feedsFetched} feeds with ${items.length} candidate items.`);

  const ranked = rankCandidates(items, MAX_POSTS_PER_RUN + 2);

  if (ranked.length === 0) {
    console.log("No suitable candidates today.");
    if (countExistingPosts() === 0) {
      process.exitCode = 1;
    }
    return;
  }

  const selected = ranked.slice(0, MAX_POSTS_PER_RUN);
  console.log(
    `Selected ${selected.length} topic(s): ${selected.map((item) => item.title).join(" | ")}`
  );

  const locales = resolveLocalesToGenerate();
  const createdFiles = [];

  for (const candidate of selected) {
    const sources = [candidate.link];
    for (const locale of locales) {
      try {
        const post = await generatePost(candidate, sources, { lang: locale });
        const publishedPath = publishPost(post, { lang: locale });
        if (publishedPath) {
          createdFiles.push(publishedPath);
        }
      } catch (error) {
        console.error(`Failed to generate/publish post for ${locale}:`, error);
      }
    }
  }

  if (createdFiles.length === 0) {
    console.log("No new posts were created.");
    if (countExistingPosts() === 0) {
      process.exitCode = 1;
    }
    return;
  }

  console.log("Created posts:");
  createdFiles.forEach((file) => console.log(`- ${file}`));
}

run();

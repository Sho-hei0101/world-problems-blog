const { fetchRedditRss } = require("../sources/redditRss.js");
const { rankCandidates } = require("../rank.js");
const { generatePost } = require("../generatePost.js");
const { publishPost } = require("../publish.js");

async function run() {
  const rssItems = await fetchRedditRss();
  const ranked = rankCandidates(rssItems, 3);

  if (ranked.length === 0) {
    console.log("No suitable candidates found.");
    return;
  }

  const candidate = ranked[0];
  const sources = ranked.map((item) => item.link);

  try {
    const post = await generatePost(candidate, sources);
    const publishedPath = publishPost(post);

    if (!publishedPath) {
      console.log("Post already published. Exiting.");
    }
  } catch (error) {
    console.error("Failed to generate/publish post:", error);
    process.exitCode = 1;
  }
}

run();

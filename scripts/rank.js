const UNSAFE_PATTERNS = [
  /suicide|self[- ]?harm|kill myself|end my life/i,
  /sexual assault|rape|incest|porn|explicit|onlyfans/i,
  /minor|child abuse|underage|teen sex|pedoph/i,
  /diagnos(e|is)|symptom|treatment|disease|cancer|pregnan/i,
  /my (wife|husband|daughter|son|mom|dad|family)|i am|i was|my experience/i
];

const PRIORITY_KEYWORDS = [
  "climate",
  "water",
  "drought",
  "food",
  "waste",
  "energy",
  "housing",
  "infrastructure",
  "pollution",
  "biodiversity",
  "oceans",
  "heat",
  "flood",
  "wildfire",
  "renewable",
  "inequality",
  "migration",
  "public health",
  "air quality"
];

const CLARITY_KEYWORDS = [
  "how",
  "why",
  "what",
  "should",
  "help",
  "advice",
  "fix",
  "solve",
  "struggling",
  "can't",
  "cannot",
  "avoid",
  "reduce",
  "improve"
];

const GENERAL_INTEREST_SUBREDDITS = new Set([
  "askreddit",
  "nostupidquestions",
  "explainlikeimfive",
  "personalfinance",
  "relationships",
  "careerquestions",
  "legaladvice",
  "travel",
  "parenting",
  "fitness",
  "frugal"
]);

function isUnsafe(text) {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

function keywordScore(text) {
  const lower = text.toLowerCase();
  return PRIORITY_KEYWORDS.reduce(
    (score, keyword) => (lower.includes(keyword) ? score + 2 : score),
    0
  );
}

function clarityScore(text) {
  const lower = text.toLowerCase();
  const keywordHits = CLARITY_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  const questionMark = lower.includes("?") ? 1 : 0;
  const lengthBonus = lower.length > 40 && lower.length < 120 ? 1 : 0;
  return keywordHits + questionMark + lengthBonus;
}

function subredditScore(subreddit) {
  if (!subreddit) return 0;
  return GENERAL_INTEREST_SUBREDDITS.has(subreddit.toLowerCase()) ? 2 : 0;
}

function recencyScore(dateValue) {
  if (!dateValue) {
    return 0;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.valueOf())) {
    return 0;
  }
  const days = (Date.now() - date.valueOf()) / (1000 * 60 * 60 * 24);
  if (days < 1) return 3;
  if (days < 3) return 2;
  if (days < 7) return 1;
  return 0;
}

function rankCandidates(candidates, limit = 5) {
  const safe = candidates.filter((candidate) => {
    const text = `${candidate.title} ${candidate.summary || ""}`;
    return !isUnsafe(text);
  });

  const ranked = safe
    .map((candidate) => {
      const text = `${candidate.title} ${candidate.summary || ""}`;
      return {
        ...candidate,
        score:
          keywordScore(text) +
          recencyScore(candidate.published) +
          clarityScore(candidate.title) +
          subredditScore(candidate.subreddit)
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

module.exports = { rankCandidates };

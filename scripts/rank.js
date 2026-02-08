const UNSAFE_PATTERNS = [
  /suicide|self[- ]?harm|kill myself|end my life/i,
  /sexual assault|rape|incest|porn|explicit|onlyfans/i,
  /minor|child abuse|underage|teen sex|pedoph/i,
  /diagnos(e|is)|symptom|treatment|disease|cancer|pregnan/i,
  /my (wife|husband|daughter|son|mom|dad|family)|i am|i was|my experience/i
];

const PRIORITY_KEYWORDS = [
  "cost of living",
  "inflation",
  "rent",
  "mortgage",
  "job market",
  "wages",
  "tax",
  "energy prices",
  "energy",
  "housing",
  "economy",
  "policy",
  "climate",
  "wildfire",
  "flood",
  "earthquake",
  "war",
  "sanctions",
  "public health",
  "healthcare",
  "food",
  "water",
  "heat"
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
  "improve",
  "guide",
  "tips",
  "steps",
  "plan"
];

const SOURCE_BOOST = new Map([
  ["google-news", 3],
  ["wikipedia-current-events", 2],
  ["hacker-news", 1],
  ["stackexchange", 1]
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

function topicTagScore(tags) {
  if (!Array.isArray(tags)) return 0;
  return tags.reduce((score, tag) => {
    const lower = String(tag).toLowerCase();
    return PRIORITY_KEYWORDS.some((keyword) => lower.includes(keyword)) ? score + 2 : score;
  }, 0);
}

function sourceScore(source) {
  if (!source) return 0;
  return SOURCE_BOOST.get(source) || 0;
}

function recencyScore(dateValue) {
  if (!dateValue) {
    return 0;
  }
  const date =
    typeof dateValue === "number"
      ? new Date(dateValue * 1000)
      : new Date(dateValue);
  if (Number.isNaN(date.valueOf())) {
    return 0;
  }
  const days = (Date.now() - date.valueOf()) / (1000 * 60 * 60 * 24);
  if (days < 1) return 3;
  if (days < 3) return 2;
  if (days < 7) return 1;
  return 0;
}

function rankCandidates(candidates, limit = 5, options = {}) {
  const locale = options.locale;
  const safe = candidates.filter((candidate) => {
    const text = `${candidate.title} ${candidate.body || ""}`;
    return !isUnsafe(text);
  });

  const ranked = safe
    .map((candidate) => {
      const text = `${candidate.title} ${candidate.body || ""}`;
      return {
        ...candidate,
        score:
          keywordScore(text) +
          recencyScore(candidate.publishedAt || candidate.created_utc || candidate.published) +
          clarityScore(candidate.title) +
          topicTagScore(candidate.topicTags) +
          sourceScore(candidate.source) +
          (locale && candidate.locale === locale ? 1 : 0)
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

module.exports = { rankCandidates };

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "to",
  "a",
  "an",
  "of",
  "in",
  "on",
  "for",
  "with",
  "about",
  "how",
  "why",
  "what",
  "is",
  "are",
  "be",
  "can",
  "we",
  "do",
  "does",
  "should",
  "when",
  "who",
  "from",
  "as"
]);

function extractKeywords(text, limit = 6) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const seen = new Set();
  const keywords = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
    if (keywords.length >= limit) break;
  }
  return keywords;
}

function formatSentence(sentence) {
  return sentence.replace(/\s+/g, " ").trim();
}

function buildParagraphs(lines) {
  return lines.map((line) => formatSentence(line)).join("\n\n");
}

function buildFaq(questions) {
  return questions
    .map((item) => `**${item.q}**\n\n${item.a}`)
    .join("\n\n");
}

function buildTemplateBody(candidate, options) {
  const title = options.title;
  const summary = candidate.summary ? formatSentence(candidate.summary) : "";
  const keywordIntent = options.keywordIntent;

  const introParagraphs = [
    `People who search for "${keywordIntent}" usually want practical, trustworthy steps they can take right away. This guide breaks the issue down into the real-world causes and the actions that make the biggest difference in daily life.`,
    `The prompt from Reddit highlights a genuine challenge: ${summary || "many people are struggling to find clear answers amid conflicting advice."} The goal here is to translate the noise into a simple, repeatable plan that works for most households or teams.`,
    `Keyword intent: readers are looking for credible guidance, trade-offs, and a short list of steps they can start today without specialized tools or a huge budget.`
  ];

  const whyParagraphs = [
    `Most problems like this happen because incentives are misaligned. The people who feel the pain are not always the people who control the resources, so small issues compound over time until they feel overwhelming.`,
    `Information gaps add friction. People often rely on outdated advice, or they try to solve the problem with a single quick fix. In reality, this type of challenge usually sits at the intersection of habits, systems, and constraints that require a layered response.`,
    `Finally, the problem tends to be invisible until it becomes urgent. By the time someone asks for help, they have already tried a few fixes that did not stick, which makes the next change feel riskier than it really is.`
  ];

  const todayParagraphs = [
    `Start by defining what success looks like in one sentence. If you can measure it weekly, you can improve it. That could be a dollar amount, hours saved, or a reduction in a specific pain point.`,
    `Next, pick the smallest action that moves the number. Make it repeatable for two weeks. Consistency matters more than the size of the action because it reveals which obstacles are structural versus temporary.`,
    `Then, document what worked in a short checklist. A written checklist turns a personal insight into a process that can be shared, reviewed, and improved. That alone can cut the time spent re-solving the same issue.`
  ];

  const mistakesParagraphs = [
    `One common mistake is trying to fix everything at once. Large, dramatic changes tend to create pushback and fatigue. A sequence of small adjustments is easier to maintain and less likely to break existing systems.`,
    `Another mistake is ignoring the constraints that created the problem. If you skip the constraint, the issue just shows up somewhere else. Respecting the real limitation helps you choose a plan that is sustainable.`
  ];

  const faqItems = [
    {
      q: "How long does it take to see improvement?",
      a: "Most people notice small wins within two weeks if they track one metric and stick with a single small action. Bigger improvements usually show up in 6–8 weeks."
    },
    {
      q: "What if I do not have much time to work on this?",
      a: "Reduce the scope. Pick one action that takes 10 minutes or less and repeat it. Momentum matters more than volume at the start."
    },
    {
      q: "Is there a low-cost way to get started?",
      a: "Yes. Focus on free tools, checklists, and habits first. The highest leverage steps usually involve changing routines, not buying new products."
    },
    {
      q: "How do I keep others on the same page?",
      a: "Write down the goal, the metric, and the checklist. Share it, then ask for one improvement each week. Collaboration works best when the process is visible."
    },
    {
      q: "What should I do if progress stalls?",
      a: "Re-check the constraints, pick a smaller action, and keep the feedback loop tight. Stalls often mean the action was too big or the metric was unclear."
    }
  ];

  const conclusionParagraphs = [
    `This problem feels overwhelming because it blends habits, systems, and limited resources. Breaking it into a clear definition, a repeatable action, and a checklist makes progress realistic.`,
    `If you want to move faster, use the checklist below as your baseline and adjust it weekly. Small, consistent improvements compound into meaningful change.`
  ];

  const body = [
    `# ${title}`,
    "",
    buildParagraphs(introParagraphs),
    "",
    "## Why this problem happens",
    "",
    buildParagraphs(whyParagraphs),
    "",
    "## What to do today (practical steps)",
    "",
    buildParagraphs(todayParagraphs),
    "",
    "## Common mistakes",
    "",
    buildParagraphs(mistakesParagraphs),
    "",
    "## FAQs",
    "",
    buildFaq(faqItems),
    "",
    "## Conclusion",
    "",
    buildParagraphs(conclusionParagraphs),
    "",
    `**Call to action:** ${options.ctaPrimaryLabel} → ${options.ctaPrimaryUrl}`
  ].join("\n");

  return body;
}

function ensureWordCount(body, minimum = 900, maximum = 1400) {
  let updated = body;
  const fillerParagraphs = [
    "A practical way to stay on track is to review progress weekly, identify one small barrier, and remove it. When you treat improvement as a series of experiments instead of a single massive project, the results become more consistent and less stressful.",
    "Another helpful approach is to make progress visible. A simple weekly log or shared note keeps the problem from drifting into the background and helps everyone see the momentum building over time.",
    "If motivation dips, reset the goal to something smaller and immediate. Quick wins rebuild confidence and make it easier to stick with the routine when things get busy.",
    "Look for the upstream decision that creates the downstream headache. When you improve the upstream decision, you remove multiple pain points at once and avoid chasing symptoms.",
    "Finally, set a boundary for what you will stop doing. Saying no to one low-value habit often frees up enough time and energy to make the new plan stick.",
    "Consider who else is affected by the change and how you will communicate it. Even a short update helps reduce friction and invites useful feedback.",
    "When possible, automate a tiny part of the workflow. Automation does not have to be complex; even a reminder or calendar block can protect the habit.",
    "Track progress in a way that feels rewarding. A visible streak, a small savings total, or a clear time reduction keeps the effort grounded and repeatable."
  ];
  for (const paragraph of fillerParagraphs) {
    if (wordCount(updated) >= minimum) {
      break;
    }
    updated = updated.replace(
      "## Common mistakes",
      `${paragraph}\n\n## Common mistakes`
    );
  }
  if (wordCount(updated) > maximum) {
    throw new Error("Generated post exceeds maximum word count.");
  }
  return updated;
}

async function generatePost(candidate, sources, options = {}) {
  const lang = options.lang || "en";
  if (lang !== "en") {
    throw new Error(`Locale ${lang} is not supported without an LLM translation layer.`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const keywords = extractKeywords(candidate.title || "");
  const title = formatSentence(candidate.title || "Solving a real-world problem");
  const description = formatSentence(
    candidate.summary ||
      `A practical, step-by-step guide to understanding ${title.toLowerCase()} and taking action today.`
  );

  const ctaPrimaryLabel = "Get the action checklist";
  const ctaPrimaryUrl = "https://github.com/Sho-hei0101/world-problems-blog";
  const keywordIntent = `${title.toLowerCase()} practical steps`;

  const body = ensureWordCount(
    buildTemplateBody(candidate, {
      title,
      keywordIntent,
      ctaPrimaryLabel,
      ctaPrimaryUrl
    })
  );

  return {
    title,
    description,
    date,
    tags: keywords.length ? keywords : ["world problems"],
    cta_primary_label: ctaPrimaryLabel,
    cta_primary_url: ctaPrimaryUrl,
    source_url: sources[0] || candidate.link,
    source_subreddit: candidate.subreddit || "",
    body_markdown: body
  };
}

module.exports = { generatePost };

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const WORD_LIMITS = {
  en: { min: 900, max: 1400 },
  es: { min: 700, max: 1200 },
  fr: { min: 700, max: 1200 },
  de: { min: 700, max: 1200 },
  ja: { min: 700, max: 1200 }
};

const LANGUAGE_NAMES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese"
};

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function clampString(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildFaq(faqItems) {
  if (!Array.isArray(faqItems) || faqItems.length === 0) {
    return "";
  }
  return faqItems
    .slice(0, 5)
    .map((item) => `**${item.q}**\n\n${item.a}`)
    .join("\n\n");
}

function buildChecklist(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return items.slice(0, 8).map((item) => `- ${item}`).join("\n");
}

function buildSources(list, originalUrl) {
  const normalized = Array.isArray(list)
    ? list
        .map((item) => ({
          label: String(item?.label || "").trim(),
          url: String(item?.url || "").trim()
        }))
        .filter((item) => item.label && item.url)
    : [];

  const deduped = new Map();
  for (const item of normalized) {
    if (!deduped.has(item.url)) {
      deduped.set(item.url, item.label);
    }
  }

  if (originalUrl && !deduped.has(originalUrl)) {
    deduped.set(originalUrl, "Reddit thread");
  }

  return Array.from(deduped.entries())
    .slice(0, 4)
    .map(([url, label]) => `- [${label}](${url})`)
    .join("\n");
}

function fallbackFaq() {
  return [
    { q: "How long does it take to see progress?", a: "Most people see small improvements within a few weeks when they track one metric consistently." },
    { q: "What if I have limited time?", a: "Start with the smallest repeatable action. Consistency matters more than intensity at the beginning." },
    { q: "Is there a low-cost way to begin?", a: "Yes. Focus on free tools, simple routines, and small habit changes before spending money." }
  ];
}

function fallbackChecklist() {
  return [
    "Define the goal in one sentence.",
    "Pick one metric to track weekly.",
    "Choose a small action you can repeat for two weeks.",
    "Remove one obvious barrier.",
    "Review progress and adjust next week."
  ];
}

function addFillerIfNeeded(body, minWords, maxWords) {
  let updated = body;
  const fillerParagraphs = [
    "A practical way to stay on track is to review progress weekly, identify one small barrier, and remove it. Treat improvement as a series of experiments so the results feel manageable.",
    "Make progress visible with a quick weekly log. Seeing momentum builds confidence and keeps the effort focused on what matters most.",
    "If motivation dips, reset the next step to something smaller and immediate. Quick wins rebuild energy and keep the plan moving.",
    "Look for the upstream decision that creates the downstream headache. Improving that upstream choice often removes multiple pain points at once.",
    "Set a boundary for what you will stop doing. Saying no to one low-value habit can free the time and attention needed for the new plan."
  ];

  for (const paragraph of fillerParagraphs) {
    if (wordCount(updated) >= minWords) {
      break;
    }
    updated = updated.replace("## FAQ", `${paragraph}\n\n## FAQ`);
  }

  if (wordCount(updated) > maxWords) {
    throw new Error("Generated post exceeds maximum word count.");
  }

  return updated;
}

async function callOpenAI(prompt, model, maxTokens) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: prompt,
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content.");
  }

  return JSON.parse(content);
}

async function generatePost(candidate, sources, options = {}) {
  const lang = options.lang || "en";
  const languageName = LANGUAGE_NAMES[lang] || "English";
  const limits = WORD_LIMITS[lang] || WORD_LIMITS.en;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxTokens = Number.parseInt(process.env.OPENAI_MAX_TOKENS || "1800", 10);

  const prompt = [
    {
      role: "system",
      content:
        "You are a multilingual SEO writer. Provide general information only, not professional legal, medical, or financial advice. Avoid statistics unless provided. Output JSON only."
    },
    {
      role: "user",
      content: `Write a long-form blog post in ${languageName} (${lang}).\n\nRequirements:\n- SEO title (<= 70 chars)\n- Meta description (<= 160 chars)\n- 3–6 tags\n- Article body with clear headings (use ## and ###, no H1).\n- Include a brief disclaimer that this is general information, not professional advice.\n- Provide an FAQ section with 3–5 Q/A items.\n- Provide an actionable checklist (5–8 bullets).\n- Provide 2–3 reputable general sources with label + URL (no scraping).\n- Target length: ${limits.min}-${limits.max} words for the full post.\n\nTopic (from Reddit):\nTitle: ${candidate.title}\nBody: ${candidate.body || ""}\nSubreddit: ${candidate.subreddit || ""}\nURL: ${candidate.url || ""}\n\nReturn JSON with keys: seo_title, meta_description, tags, article_body, faq (array of {q,a}), checklist (array), sources (array of {label,url}), disclaimer.`
    }
  ];

  const result = await callOpenAI(prompt, model, maxTokens);

  const title = clampString(result.seo_title || candidate.title, 70) || "World Problems Guide";
  const description =
    clampString(result.meta_description, 160) ||
    clampString(
      `A practical guide to ${title.toLowerCase()}, with steps, FAQs, and a clear action plan.`,
      160
    );
  const tags = normalizeTags(result.tags);
  const disclaimer = result.disclaimer
    ? String(result.disclaimer).trim()
    : "This article provides general information, not professional advice. Consult a qualified professional for guidance specific to your situation.";

  const faqBlock = buildFaq(result.faq) || buildFaq(fallbackFaq());
  const checklistBlock = buildChecklist(result.checklist) || buildChecklist(fallbackChecklist());
  const sourcesBlock = buildSources(result.sources, sources?.[0] || candidate.url);

  const bodySections = [
    `# ${title}`,
    "",
    `> ${disclaimer}`,
    "",
    String(result.article_body || "").trim(),
    "",
    "## FAQ",
    "",
    faqBlock,
    "",
    "## Actionable checklist",
    "",
    checklistBlock,
    "",
    "## Sources / Further reading",
    "",
    sourcesBlock
  ];

  const body = addFillerIfNeeded(bodySections.join("\n"), limits.min, limits.max);

  return {
    title,
    description,
    date: new Date().toISOString().slice(0, 10),
    tags: tags.length ? tags : ["world problems"],
    cta_primary_label: "Get the action checklist",
    cta_primary_url: "https://github.com/Sho-hei0101/world-problems-blog",
    source_url: sources?.[0] || candidate.url,
    source_subreddit: candidate.subreddit || "",
    source_id: candidate.id || "",
    body_markdown: body
  };
}

module.exports = { generatePost };

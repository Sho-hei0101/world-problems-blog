function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const WORD_LIMITS = {
  en: { min: 1200, max: 1800 },
  es: { min: 1200, max: 1800 },
  fr: { min: 1200, max: 1800 },
  de: { min: 1200, max: 1800 },
  ja: { min: 1200, max: 1800 }
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
    deduped.set(originalUrl, "Original source");
  }

  return Array.from(deduped.entries())
    .slice(0, 4)
    .map(([url, label]) => `- [${label}](${url})`)
    .join("\n");
}

function buildPlainSourceLinks(urls) {
  const normalized = Array.isArray(urls)
    ? urls
        .map((url) => String(url || "").trim())
        .filter(Boolean)
    : [];
  const deduped = Array.from(new Set(normalized));
  return deduped.map((url) => `- ${url}`).join("\n");
}

function buildSourceFurtherReading({ sourcesBlock, originalUrls }) {
  const sourceLinks = buildPlainSourceLinks(originalUrls);
  const sections = [];
  if (sourceLinks) {
    sections.push("Sources", sourceLinks);
  }
  if (sourcesBlock) {
    sections.push("Further reading", sourcesBlock);
  }
  sections.push(
    "Summary based on publicly available sources. Please refer to original links for full context."
  );
  return sections.join("\n\n");
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

function buildSection(text, fallback) {
  const trimmed = String(text || "").trim();
  return trimmed || fallback;
}

function buildTldrLines(lines, fallbackLines) {
  const normalized = Array.isArray(lines)
    ? lines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  const selected = normalized.slice(0, 3);
  if (selected.length === 3) {
    return selected;
  }
  return fallbackLines.slice(0, 3);
}

function buildLearningPoints(points, fallbackPoints) {
  const normalized = Array.isArray(points)
    ? points.map((point) => String(point || "").trim()).filter(Boolean)
    : [];
  const selected = normalized.slice(0, 5);
  if (selected.length >= 3) {
    return selected;
  }
  return fallbackPoints.slice(0, 3);
}

function buildTodaysContext(lang, dateString, topic) {
  const formattedDate = new Date(dateString).toLocaleDateString(lang, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const templates = {
    en: [
      `As of ${formattedDate}, ${topic.toLowerCase()} continues to shape daily choices and public debate.`,
      "The situation evolves quickly, so this snapshot reflects the most current context available at publication.",
      "Use this framing to ground the actions below and check local updates for your region."
    ],
    es: [
      `A fecha de ${formattedDate}, ${topic.toLowerCase()} sigue influyendo en decisiones diarias y debates públicos.`,
      "La situación cambia con rapidez, así que este panorama refleja el contexto más reciente al publicarse.",
      "Usa este marco para orientar las acciones y revisa actualizaciones locales en tu región."
    ],
    fr: [
      `Au ${formattedDate}, ${topic.toLowerCase()} continue d'influencer les choix quotidiens et le débat public.`,
      "La situation évolue rapidement, ce panorama reflète donc le contexte le plus récent au moment de la publication.",
      "Servez-vous de ce cadre pour ancrer les actions ci-dessous et vérifiez les mises à jour locales."
    ],
    de: [
      `Stand ${formattedDate} prägt ${topic.toLowerCase()} weiterhin Alltag und öffentliche Debatten.`,
      "Die Lage verändert sich schnell, daher spiegelt diese Momentaufnahme den aktuellsten Kontext zum Veröffentlichungszeitpunkt wider.",
      "Nutze diesen Rahmen für die folgenden Schritte und prüfe regionale Aktualisierungen."
    ],
    ja: [
      `${formattedDate}時点で、${topic}は日常の選択や議論に影響を与え続けています。`,
      "状況は変化しやすいため、このまとめは公開時点の最新の文脈を反映しています。",
      "この前提を踏まえて行動し、地域の最新情報も確認してください。"
    ]
  };
  const selected = templates[lang] || templates.en;
  return selected.join(" ");
}

function buildSourceDigest(candidate) {
  const crypto = require("crypto");
  const url = candidate?.url || "";
  const id = candidate?.id || "";
  const fetchedAt = candidate?.fetched_at || "";
  const raw = `${url}|${id}|${fetchedAt}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
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
      content: `Write a long-form blog post in ${languageName} (${lang}).\n\nRequirements:\n- SEO title (<= 70 chars)\n- Meta description (<= 160 chars)\n- 3–6 tags\n- Provide 3 TL;DR lines (short, punchy).\n- Provide a "What you'll learn" list (3–5 bullets).\n- Include a brief disclaimer that this is general information, not professional advice.\n- Provide 3–5 FAQ Q/A items.\n- Provide an actionable checklist (5–8 bullets).\n- Provide 2–3 reputable general sources with label + URL (no scraping).\n- Include these required sections (use ## headings, no H1):\n  - Problem overview\n  - Why this matters globally\n  - Regional perspective (${languageName})\n  - Practical actions you can take\n  - FAQ\n  - Source & further reading\n- Target length: ${limits.min}-${limits.max} words for the full post.\n\nTopic:\nTitle: ${candidate.title}\nSummary: ${candidate.body || ""}\nSource: ${candidate.source_name || candidate.source || ""}\nURL: ${candidate.url || ""}\n\nReturn JSON with keys: seo_title, meta_description, tags, tldr (array), learning_points (array), problem_overview, why_matters, regional_perspective, practical_actions_intro, faq (array of {q,a}), checklist (array), sources (array of {label,url}), disclaimer.`
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
  const tldrLines = buildTldrLines(result.tldr, [
    "A concise overview of the core issue and who it affects.",
    "Why the topic matters now and how it connects globally.",
    "Actionable steps you can take immediately."
  ]);
  const learningPoints = buildLearningPoints(result.learning_points, [
    "How the problem shows up and who is most impacted.",
    "The global ripple effects that make it urgent.",
    "Practical actions you can take right away."
  ]);

  const faqBlock = buildFaq(result.faq) || buildFaq(fallbackFaq());
  const checklistBlock = buildChecklist(result.checklist) || buildChecklist(fallbackChecklist());
  const sourcesBlock = buildSources(result.sources, sources?.[0] || candidate.url);
  const generatedAt = new Date().toISOString();
  const sourceDigest = buildSourceDigest(candidate);
  const postDate = new Date().toISOString().slice(0, 10);
  const todaysContext = buildTodaysContext(lang, postDate, title);
  const originalSourceUrls = [
    ...(Array.isArray(sources) ? sources : []),
    candidate.url
  ].filter(Boolean);
  const sourceFurtherReading = buildSourceFurtherReading({
    sourcesBlock,
    originalUrls: originalSourceUrls
  });

  const bodySections = [
    `# ${title}`,
    "",
    `> **TL;DR**: ${tldrLines[0]}`,
    `> ${tldrLines[1]}`,
    `> ${tldrLines[2]}`,
    "",
    "What you’ll learn:",
    "",
    learningPoints.map((point) => `- ${point}`).join("\n"),
    "",
    `> ${disclaimer}`,
    "",
    "## Problem overview",
    "",
    buildSection(
      result.problem_overview,
      "This section summarizes the core issue, who it affects, and the immediate symptoms people notice."
    ),
    "",
    "## Why this matters globally",
    "",
    buildSection(
      result.why_matters,
      "Here we connect the local issue to broader social, economic, or environmental consequences that matter across regions."
    ),
    "",
    "## Today’s context",
    "",
    todaysContext,
    "",
    "## Practical actions you can take",
    "",
    buildSection(
      result.practical_actions_intro,
      "Use the checklist below to move from insight to action with small, repeatable steps."
    ),
    "",
    checklistBlock,
    "",
    "## Regional perspective",
    "",
    buildSection(
      result.regional_perspective,
      "This perspective highlights how the topic shows up in this region and which cultural or policy factors shape the response."
    ),
    "",
    "## FAQ",
    "",
    faqBlock,
    "",
    "## Source & further reading",
    "",
    sourceFurtherReading
  ];

  const body = addFillerIfNeeded(bodySections.join("\n"), limits.min, limits.max);

  return {
    title,
    description,
    date: postDate,
    tags: tags.length ? tags : ["world problems"],
    cta_primary_label: "Get the action checklist",
    cta_primary_url: "https://worldproblems.blog",
    source_url: sources?.[0] || candidate.url,
    source_subreddit: candidate.subreddit || "",
    source_name: candidate.source_name || candidate.source || "",
    source_id: candidate.id || "",
    generated_at: generatedAt,
    source_digest: sourceDigest,
    body_markdown: body
  };
}

module.exports = { generatePost };

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function stripCodeFences(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  }
  return trimmed;
}

function parseJsonResponse(text) {
  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned);
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ensureSections(body) {
  const headings = body.match(/^##\s+/gm) || [];
  return headings.length >= 4 && headings.length <= 6;
}

function ensureContains(body, value) {
  return body.toLowerCase().includes(value.toLowerCase());
}

async function generatePost(candidate, sources) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const prompt = {
    topic: candidate.title,
    context: candidate.summary || "",
    sources,
    requirements: {
      language: "en",
      word_count_range: "900-1400",
      sections: "4-6",
      must_include: [
        "Action Checklist section",
        "FAQ section",
        "Sources section with the provided links"
      ]
    },
    output_schema: {
      title: "string",
      description: "string",
      date: "YYYY-MM-DD",
      tags: ["string"],
      cta_primary_label: "string",
      cta_primary_url: "string",
      meta_title: "string",
      meta_description: "string",
      keywords: ["string"],
      faq: [{ question: "string", answer: "string" }],
      body_markdown: "string"
    }
  };

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a careful writing assistant. Respond ONLY with valid JSON matching the requested schema. Do not use markdown code fences."
        },
        {
          role: "user",
          content: JSON.stringify(prompt)
        }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content.");
  }

  const post = parseJsonResponse(content);

  if (!post?.body_markdown) {
    throw new Error("Generated post missing body_markdown.");
  }

  const words = wordCount(post.body_markdown);
  if (words < 900 || words > 1400) {
    throw new Error(`Generated post length out of range: ${words} words.`);
  }

  if (!ensureSections(post.body_markdown)) {
    throw new Error("Generated post does not have 4-6 sections.");
  }

  if (!ensureContains(post.body_markdown, "Action Checklist")) {
    throw new Error("Generated post missing Action Checklist section.");
  }

  if (!ensureContains(post.body_markdown, "FAQ")) {
    throw new Error("Generated post missing FAQ section.");
  }

  if (!ensureContains(post.body_markdown, "Sources")) {
    throw new Error("Generated post missing Sources section.");
  }

  return post;
}

module.exports = { generatePost };

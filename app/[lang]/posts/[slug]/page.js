import Link from "next/link";
import ActionChecklistLink from "../../../components/ActionChecklistLink";
import { notFound } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  buildPostUrl,
  getAllPosts,
  getPostSlugs,
  getPostBySlug,
  getTranslationsForSlug,
  getRelatedPosts
} from "../../../../lib/posts";
import {
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  AUTHOR_NAME,
  buildCanonicalUrl,
  buildOgImageUrl
} from "../../../../lib/site";

function extractFaqEntries(markdown = "") {
  const lines = markdown.split(/\r?\n/);
  const faqStart = lines.findIndex((line) => /^##\s+faq/i.test(line.trim()));
  if (faqStart === -1) {
    return [];
  }
  const entries = [];
  let current = null;
  for (let i = faqStart + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^##\s+/.test(line)) {
      break;
    }
    const questionMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (questionMatch) {
      if (current) {
        entries.push(current);
      }
      current = { question: questionMatch[1].trim(), answer: "" };
      continue;
    }
    if (current && line) {
      current.answer = current.answer ? `${current.answer} ${line}` : line;
    }
  }
  if (current) {
    entries.push(current);
  }
  return entries.filter((entry) => entry.question && entry.answer);
}

function injectRecommendedSection(html, recommendedPosts, lang) {
  if (!html || !recommendedPosts?.length) {
    return html;
  }
  const blockquoteClose = html.indexOf("</blockquote>");
  if (blockquoteClose === -1) {
    return html;
  }
  const listItems = recommendedPosts
    .map(
      (post) =>
        `<li><a href="${buildPostUrl(lang, post.slug)}">${post.title}</a></li>`
    )
    .join("");
  const recommendedHtml = `
    <section class="recommended-inline">
      <h3>Recommended</h3>
      <ul>${listItems}</ul>
    </section>
  `;
  const insertAt = blockquoteClose + "</blockquote>".length;
  return `${html.slice(0, insertAt)}${recommendedHtml}${html.slice(insertAt)}`;
}

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.flatMap((lang) => {
    return getPostSlugs(lang).map((slug) => ({ lang, slug }));
  });
}

export function generateMetadata({ params }) {
  const { lang, slug } = params;
  const post = getPostBySlug(lang, slug);

  if (!post) {
    return {};
  }

  const translations = getTranslationsForSlug(slug);
  const languages = Object.keys(translations).reduce((acc, locale) => {
    acc[locale] = buildCanonicalUrl(buildPostUrl(locale, slug));
    return acc;
  }, {});
  const ogImage =
    post.og_image || post.image || buildOgImageUrl({ title: post.title, lang, tags: post.tags });

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: buildPostUrl(lang, slug),
      languages
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: buildCanonicalUrl(buildPostUrl(lang, slug)),
      type: "article",
      locale: lang,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage || DEFAULT_OG_IMAGE,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage || DEFAULT_OG_IMAGE]
    },
    authors: [{ name: AUTHOR_NAME }]
  };
}

export default function PostPage({ params }) {
  const { lang, slug } = params;
  const post = getPostBySlug(lang, slug);
  const allPosts = getAllPosts(lang);
  const relatedPosts = post ? getRelatedPosts(lang, slug, post.tags) : [];

  if (!post) {
    notFound();
  }
  const ogImage =
    post.og_image || post.image || buildOgImageUrl({ title: post.title, lang, tags: post.tags });
  const faqEntries = extractFaqEntries(post.content);
  const recommendedPosts = relatedPosts.slice(0, 2);
  const htmlWithRecommended = injectRecommendedSection(post.html, recommendedPosts, lang);
  const currentIndex = allPosts.findIndex((entry) => entry.slug === slug);
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const previousPost =
    currentIndex !== -1 && currentIndex < allPosts.length - 1
      ? allPosts[currentIndex + 1]
      : null;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated_at || post.generated_at || post.fileModifiedAt || post.date,
    author: {
      "@type": "Organization",
      name: SITE_NAME
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": buildCanonicalUrl(buildPostUrl(lang, slug))
    },
    image: [ogImage || DEFAULT_OG_IMAGE],
    url: buildCanonicalUrl(buildPostUrl(lang, slug)),
    inLanguage: lang,
    keywords: post.tags || []
  };
  const faqJsonLd = faqEntries.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqEntries.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.answer
          }
        }))
      }
    : null;

  return (
    <article>
      <Link href={`/${lang}`} style={{ color: "var(--accent)" }}>
        ← Back to posts
      </Link>
      <h1 style={{ marginTop: "20px" }}>{post.title}</h1>
      <div className="post-meta">
        <span>{new Date(post.date).toLocaleDateString(lang)}</span>
        {post.tags?.map((tag) => (
          <Link key={tag} href={`/${lang}/tags/${encodeURIComponent(tag)}`} className="tag">
            {tag}
          </Link>
        ))}
      </div>
      {(post.source_name || post.source_subreddit || post.source_url) && (
        <p style={{ marginTop: "8px", fontSize: "0.9rem", color: "#6b7280" }}>
          Source:{" "}
          {post.source_url ? (
            <a href={post.source_url} target="_blank" rel="noreferrer">
              {post.source_name ||
                (() => {
                  try {
                    return new URL(post.source_url).hostname.replace(/^www\./, "");
                  } catch {
                    return post.source_url;
                  }
                })()}
            </a>
          ) : (
            post.source_name || post.source_subreddit
          )}
        </p>
      )}
      <div className="article-content" dangerouslySetInnerHTML={{ __html: htmlWithRecommended }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <div className="cta-stack">
        <ActionChecklistLink className="cta" href={`/${lang}/checklist/${slug}`} postSlug={slug}>
          Get the action checklist
        </ActionChecklistLink>
        <Link
          className="cta-secondary"
          href={relatedPosts[0] ? buildPostUrl(lang, relatedPosts[0].slug) : `/${lang}/`}
        >
          Read the next related post
        </Link>
      </div>
      {relatedPosts.length > 0 && (
        <section className="related-posts" id="related-posts">
          <h2>Related posts</h2>
          <ul>
            {relatedPosts.map((related) => (
              <li key={related.slug}>
                <Link href={buildPostUrl(lang, related.slug)}>{related.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(nextPost || previousPost) && (
        <nav className="post-pagination">
          {previousPost && (
            <Link href={buildPostUrl(lang, previousPost.slug)} className="pagination-link">
              <span className="pagination-label">Previous</span>
              <span>{previousPost.title}</span>
            </Link>
          )}
          {nextPost && (
            <Link href={buildPostUrl(lang, nextPost.slug)} className="pagination-link">
              <span className="pagination-label">Next</span>
              <span>{nextPost.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}

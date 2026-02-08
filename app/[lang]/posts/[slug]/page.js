import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  buildPostUrl,
  getPostSlugs,
  getPostBySlug,
  getTranslationsForSlug,
  getRelatedPosts
} from "../../../../lib/posts";
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, AUTHOR_NAME } from "../../../../lib/site";

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
    acc[locale] = `${SITE_URL}${buildPostUrl(locale, slug)}`;
    return acc;
  }, {});
  const ogImage = post.og_image || post.image || DEFAULT_OG_IMAGE;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `${SITE_URL}${buildPostUrl(lang, slug)}`,
      languages
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}${buildPostUrl(lang, slug)}`,
      type: "article",
      locale: lang,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage]
    },
    authors: [{ name: AUTHOR_NAME }]
  };
}

export default function PostPage({ params }) {
  const { lang, slug } = params;
  const post = getPostBySlug(lang, slug);
  const relatedPosts = post ? getRelatedPosts(lang, slug, post.tags) : [];

  if (!post) {
    notFound();
  }
  const ogImage = post.og_image || post.image || DEFAULT_OG_IMAGE;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated_at || post.generated_at || post.date,
    author: {
      "@type": "Person",
      name: AUTHOR_NAME
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}${buildPostUrl(lang, slug)}`
    },
    image: [ogImage]
  };

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
      <div className="article-content" dangerouslySetInnerHTML={{ __html: post.html }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <a className="cta" href={post.cta_primary_url}>
        {post.cta_primary_label}
      </a>
      {relatedPosts.length > 0 && (
        <section className="related-posts">
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
    </article>
  );
}

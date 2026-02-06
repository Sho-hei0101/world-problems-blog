import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  buildPostUrl,
  getPostSlugs,
  getPostBySlug,
  getTranslationsForSlug
} from "../../../../lib/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

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
      siteName: "World Problems Blog"
    }
  };
}

export default function PostPage({ params }) {
  const { lang, slug } = params;
  const post = getPostBySlug(lang, slug);

  if (!post) {
    notFound();
  }

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
      {(post.source_subreddit || post.source_url) && (
        <p style={{ marginTop: "8px", fontSize: "0.9rem", color: "#6b7280" }}>
          Source:{" "}
          {post.source_url ? (
            <a href={post.source_url} target="_blank" rel="noreferrer">
              Reddit /r/{post.source_subreddit || "unknown"}
            </a>
          ) : (
            `Reddit /r/${post.source_subreddit}`
          )}
        </p>
      )}
      <div className="article-content" dangerouslySetInnerHTML={{ __html: post.html }} />
      <a className="cta" href={post.cta_primary_url}>
        {post.cta_primary_label}
      </a>
    </article>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, getPostBySlug, getPostSlugs, buildPostUrl } from "../../../../lib/posts";
import { SITE_NAME, buildCanonicalUrl } from "../../../../lib/site";

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

  return {
    title: `${post.title} Action Checklist`,
    description: post.description,
    alternates: {
      canonical: `/${lang}/checklist/${slug}`
    },
    openGraph: {
      title: `${post.title} Action Checklist`,
      description: post.description,
      url: buildCanonicalUrl(`/${lang}/checklist/${slug}`),
      type: "article",
      siteName: SITE_NAME
    }
  };
}

export default function ChecklistPage({ params }) {
  const { lang, slug } = params;
  const post = getPostBySlug(lang, slug);

  if (!post) {
    notFound();
  }

  const sections = Array.isArray(post.actionChecklist) ? post.actionChecklist : [];

  return (
    <article>
      <Link href={buildPostUrl(lang, slug)} style={{ color: "var(--accent)" }}>
        ← Back to post
      </Link>
      <h1 style={{ marginTop: "20px" }}>Action checklist</h1>
      <p className="checklist-intro">
        Use this checklist to track the most practical next steps from the post.
      </p>
      {sections.length === 0 ? (
        <p>No checklist items found yet. Check back after the post updates.</p>
      ) : (
        <div className="checklist">
          {sections.map((section, index) => (
            <section key={`${section.title}-${index}`} className="checklist-section">
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  buildPostUrl,
  getPostsByTag
} from "../../../../lib/posts";

export default function TagPage({ params }) {
  const { lang, tag } = params;

  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    notFound();
  }

  const posts = getPostsByTag(lang, tag);

  return (
    <section>
      <Link href={`/${lang}`} style={{ color: "var(--accent)" }}>
        ← Back to posts
      </Link>
      <h1 style={{ marginTop: "20px" }}>Tag: {decodeURIComponent(tag)}</h1>
      {posts.length === 0 ? (
        <div className="card">
          <h2>No posts found</h2>
          <p>There are no posts tagged with this topic yet.</p>
        </div>
      ) : (
        posts.map((post) => (
          <article key={post.slug} className="card">
            <div className="post-meta">
              <span>{new Date(post.date).toLocaleDateString(lang)}</span>
            </div>
            <h2>
              <Link href={buildPostUrl(lang, post.slug)}>{post.title}</Link>
            </h2>
            <p style={{ color: "var(--muted)" }}>{post.description}</p>
          </article>
        ))
      )}
    </section>
  );
}

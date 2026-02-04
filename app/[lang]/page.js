import Link from "next/link";
import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, getAllPosts, buildPostUrl, buildTagUrl } from "../../lib/posts";

export default function LangIndex({ params }) {
  const { lang } = params;

  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    notFound();
  }

  const posts = getAllPosts(lang);

  return (
    <section>
      <h1>Latest posts</h1>
      <p style={{ color: "var(--muted)", maxWidth: "640px" }}>
        Explore regional perspectives on global issues, with localized insights
        and actionable steps.
      </p>

      {posts.length === 0 ? (
        <div className="card">
          <h2>No posts yet</h2>
          <p>Use the new:post script to add the first story in this language.</p>
        </div>
      ) : (
        posts.map((post) => (
          <article key={post.slug} className="card">
            <div className="post-meta">
              <span>{new Date(post.date).toLocaleDateString(lang)}</span>
              {post.tags?.map((tag) => (
                <Link key={tag} href={buildTagUrl(lang, tag)} className="tag">
                  {tag}
                </Link>
              ))}
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

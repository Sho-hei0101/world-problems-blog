import Link from "next/link";
import { SUPPORTED_LANGUAGES } from "../../lib/posts";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((lang) => ({ lang }));
}

export default function LangLayout({ children, params }) {
  const { lang } = params;

  return (
    <main>
      <header>
        <div>
          <Link href={`/${lang}`}>
            <strong>World Problems Blog</strong>
          </Link>
          <div style={{ color: "var(--muted)", marginTop: "4px" }}>
            Multilingual perspectives on shared challenges.
          </div>
        </div>
        <nav>
          <ul>
            {SUPPORTED_LANGUAGES.map((locale) => (
              <li key={locale}>
                <Link href={`/${locale}`}>{locale.toUpperCase()}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {children}
      <footer>
        Built with Next.js App Router. Content is stored locally in markdown.
      </footer>
    </main>
  );
}

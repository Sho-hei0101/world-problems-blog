const DEFAULT_SITE_URL = "https://blog.shichifuku-sl.com";

function normalizeSiteUrl(rawUrl) {
  if (!rawUrl) {
    return DEFAULT_SITE_URL;
  }

  return rawUrl.replace(/\/$/, "");
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = "World Problems Blog";
export const DEFAULT_OG_IMAGE =
  process.env.NEXT_PUBLIC_DEFAULT_OG_IMAGE || `${SITE_URL}/og-default.svg`;
export const AUTHOR_NAME = process.env.NEXT_PUBLIC_AUTHOR_NAME || "World Problems Desk";

export function buildCanonicalUrl(pathname = "") {
  if (!pathname) {
    return SITE_URL;
  }

  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function buildOgImageUrl({ title, lang, tags }) {
  const params = new URLSearchParams();
  if (title) {
    params.set("title", title);
  }
  if (lang) {
    params.set("lang", lang);
  }
  if (Array.isArray(tags) && tags.length > 0) {
    params.set("tags", tags.join(", "));
  }
  const query = params.toString();
  return buildCanonicalUrl(`/api/og${query ? `?${query}` : ""}`);
}

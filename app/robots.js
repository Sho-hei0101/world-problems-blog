import { buildCanonicalUrl } from "../lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: buildCanonicalUrl("/sitemap.xml")
  };
}

export const DEFAULT_GA_ID = "G-V94PK7MHY4";
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || DEFAULT_GA_ID;
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

function hasGtag() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function trackPageView(url) {
  if (!hasGtag()) {
    return;
  }

  window.gtag("config", GA_ID, {
    page_path: url
  });
}

export function trackEvent(action, params = {}) {
  if (!hasGtag()) {
    return;
  }

  window.gtag("event", action, params);
}

export function trackActionChecklistClick(postSlug) {
  trackEvent("action_checklist_click", {
    post_slug: postSlug
  });
}

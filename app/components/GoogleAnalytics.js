"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { GA_ID, IS_PRODUCTION, trackPageView } from "../../lib/ga";

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!IS_PRODUCTION || !pathname) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const url = search ? `${pathname}?${search}` : pathname;
    trackPageView(url);
  }, [pathname]);

  if (!IS_PRODUCTION) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}

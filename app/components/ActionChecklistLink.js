"use client";

import Link from "next/link";
import { trackActionChecklistClick } from "../../lib/ga";

export default function ActionChecklistLink({ href, postSlug, children, ...props }) {
  const handleClick = () => {
    trackActionChecklistClick(postSlug);
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

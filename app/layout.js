import "./globals.css";
import { SITE_URL } from "../lib/site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "World Problems Blog",
  description: "A multilingual blog about world challenges and solutions."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

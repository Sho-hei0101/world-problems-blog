import "./globals.css";

export const metadata = {
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

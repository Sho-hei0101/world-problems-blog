import { ImageResponse } from "next/og";
import { SITE_NAME } from "../../../lib/site";

export const runtime = "edge";

export function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "World Problems Blog";
  const lang = searchParams.get("lang") || "en";
  const tags = (searchParams.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          backgroundColor: "#f7f5f2",
          color: "#1d1d1f",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        <div style={{ fontSize: 28, color: "#0b57d0", fontWeight: 600 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, color: "#5f6368" }}>{lang.toUpperCase()}</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 20,
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: "1px solid #e1ded9",
                  backgroundColor: "#ffffff"
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}

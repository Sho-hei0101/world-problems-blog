function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCdata(text) {
  return text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1");
}

function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "").trim();
}

function extractTag(item, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = item.match(regex);
  if (!match) return "";
  return stripHtml(decodeEntities(stripCdata(match[1] || "")));
}

function extractTagWithAttributes(item, tagName) {
  const regex = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = item.match(regex);
  if (!match) return { value: "", attrs: "" };
  return {
    value: stripHtml(decodeEntities(stripCdata(match[2] || ""))),
    attrs: match[1] || ""
  };
}

function parseRssItems(xml) {
  if (!xml) return [];
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => {
    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const description = extractTag(item, "description");
    const source = extractTagWithAttributes(item, "source");
    return {
      title,
      link,
      pubDate,
      description,
      source: source.value || ""
    };
  });
}

module.exports = { parseRssItems, stripHtml, decodeEntities };

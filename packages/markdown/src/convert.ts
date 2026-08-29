import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { ExtractionResult } from "@capture-for-tolaria/extractor";
import {
  serializeFrontmatter,
  type Frontmatter,
  type MarkdownDocument
} from "./frontmatter.js";

function normalizedTitle(title: string): string {
  return title.replace(/\s+/gu, " ").trim();
}

function siteFromSourceUrl(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./u, "");
  } catch {
    return "";
  }
}

export function renderMarkdown(
  result: ExtractionResult,
  clippedAt: string
): MarkdownDocument {
  const title = normalizedTitle(result.title);
  const frontmatter: Frontmatter = {
    type: "Resource",
    title,
    source_url: result.sourceUrl,
    site: siteFromSourceUrl(result.sourceUrl),
    author: result.author,
    published: result.published,
    clipped: clippedAt
  };

  const converter = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**"
  });
  gfm(converter);
  converter.remove(["script", "iframe", "object", "embed", "form"]);
  converter.addRule("captureStrikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`
  });
  converter.addRule("captureImage", {
    filter: "img",
    replacement: (_content, node) => {
      const image = node as Element;
      const source =
        image.getAttribute("src") ??
        image.getAttribute("data-src") ??
        image.getAttribute("srcset")?.split(/\s+/u)[0] ??
        "";
      if (
        source.length === 0 ||
        /^(?:javascript|vbscript|file|data):/iu.test(source)
      ) {
        return "";
      }

      const alt = image.getAttribute("alt") ?? "";
      return `![${alt}](${source})`;
    }
  });

  let body = converter.turndown(result.html).trim();
  const titleHeading = `# ${title}`;
  if (body.startsWith(titleHeading)) {
    body = body.slice(titleHeading.length).trimStart();
  }

  const markdown = [
    serializeFrontmatter(frontmatter),
    "",
    `# ${title}`,
    "",
    body,
    ""
  ].join("\n");

  return {
    frontmatter,
    markdown,
    title,
    sourceUrl: result.sourceUrl,
    images: result.images.map((image) => ({ ...image }))
  };
}

import { Readability } from "@mozilla/readability";
import { checkArticleQuality } from "./quality.js";
import { sanitizeArticleHtml } from "./sanitize.js";
import { ArticleExtractionError, type ExtractionResult } from "./types.js";

const SEMANTIC_SELECTORS = [
  "article",
  "main",
  "[role=\"main\"]",
  ".post-content",
  ".entry-content",
  ".article-content"
] as const;

interface CandidateMetadata {
  title?: string;
  author?: string;
  published?: string;
  extractionMethod: ExtractionResult["extractionMethod"];
}

function buildCandidateResult(
  html: string,
  sourceUrl: string,
  ownerDocument: Document,
  metadata: CandidateMetadata
): ExtractionResult | null {
  const sanitizedHtml = sanitizeArticleHtml(html, sourceUrl, ownerDocument);
  const candidateDocument = ownerDocument.implementation.createHTMLDocument("article");
  candidateDocument.body.innerHTML = sanitizedHtml;
  const quality = checkArticleQuality(candidateDocument.body);
  if (!quality.accepted) {
    return null;
  }

  const title = (
    metadata.title?.trim() ??
    candidateDocument.querySelector("h1")?.textContent?.trim() ??
    ownerDocument.title.trim()
  );
  if (title.length === 0) {
    return null;
  }

  const result: ExtractionResult = {
    title,
    html: sanitizedHtml,
    textContent: quality.textContent,
    sourceUrl,
    extractionMethod: metadata.extractionMethod
  };
  const author = metadata.author?.trim();
  if (author) {
    result.author = author;
  }
  const published = metadata.published?.trim();
  if (published) {
    result.published = published;
  }
  return result;
}

function readSourceUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new Error("unsupported protocol");
    }
    return url.href;
  } catch {
    throw new ArticleExtractionError(
      "INVALID_SOURCE_URL",
      "sourceUrl 必须是无凭据的 HTTP 或 HTTPS URL"
    );
  }
}

export function extractArticle(
  document: Document,
  sourceUrl: string
): ExtractionResult {
  const normalizedSourceUrl = readSourceUrl(sourceUrl);
  const readabilityDocument = document.cloneNode(true) as Document;

  try {
    const parsed = new Readability(readabilityDocument).parse();
    if (parsed?.content) {
      const readabilityResult = buildCandidateResult(
        parsed.content,
        normalizedSourceUrl,
        document,
        {
          title: parsed.title,
          author: parsed.byline ?? undefined,
          published: parsed.publishedTime ?? undefined,
          extractionMethod: "readability"
        }
      );
      if (readabilityResult) {
        return readabilityResult;
      }
    }
  } catch {
    // Semantic candidates below provide the deliberate fallback path.
  }

  const fallbackDocument = document.cloneNode(true) as Document;
  for (const selector of SEMANTIC_SELECTORS) {
    const candidate = fallbackDocument.querySelector(selector);
    if (!candidate) {
      continue;
    }

    const fallbackResult = buildCandidateResult(
      candidate.innerHTML,
      normalizedSourceUrl,
      document,
      {
        title:
          candidate.querySelector("h1")?.textContent?.trim() ??
          fallbackDocument.title.trim(),
        extractionMethod: "semantic-fallback"
      }
    );
    if (fallbackResult) {
      return fallbackResult;
    }
  }

  throw new ArticleExtractionError(
    "NO_RELIABLE_ARTICLE",
    "Unable to extract this page reliably."
  );
}

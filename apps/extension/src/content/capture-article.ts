import {
  extractArticle,
  type ExtractionResult
} from "@capture-for-tolaria/extractor";
import { renderMarkdown } from "@capture-for-tolaria/markdown";
import type { ArticlePayload } from "@capture-for-tolaria/protocol";
import { DEFAULT_RELATIVE_FOLDER } from "../background/messages.js";
export type CapturedArticlePayload = ArticlePayload;

function metadataFromResult(result: ExtractionResult): Record<string, string | undefined> {
  return {
    type: "Resource",
    author: result.author,
    published: result.published
  };
}

export function captureArticleFromDocument(
  document: Document,
  sourceUrl: string,
  clippedAt: string
): ArticlePayload {
  const extracted = extractArticle(document, sourceUrl);
  const markdown = renderMarkdown(extracted, clippedAt);
  return {
    relativeFolder: DEFAULT_RELATIVE_FOLDER,
    title: markdown.title,
    markdown: markdown.markdown,
    sourceUrl: markdown.sourceUrl,
    metadata: metadataFromResult(extracted)
  };
}

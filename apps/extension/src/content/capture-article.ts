import {
  extractArticle,
  type ExtractionResult
} from "@capture-for-tolaria/extractor";
import { renderMarkdown } from "@capture-for-tolaria/markdown";
import {
  MAX_IMAGE_CANDIDATES,
  type ArticlePayload
} from "@capture-for-tolaria/protocol";
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
  const payload: ArticlePayload = {
    relativeFolder: DEFAULT_RELATIVE_FOLDER,
    title: markdown.title,
    markdown: markdown.markdown,
    sourceUrl: markdown.sourceUrl,
    metadata: metadataFromResult(extracted)
  };
  if (markdown.images.length > 0) {
    payload.images = markdown.images.slice(0, MAX_IMAGE_CANDIDATES);
  }
  return payload;
}

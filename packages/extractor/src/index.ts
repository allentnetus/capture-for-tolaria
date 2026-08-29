export const PACKAGE_NAME = "@capture-for-tolaria/extractor" as const;

export const EXTRACTION_STEPS = [
  "clone-dom",
  "readability",
  "quality-check",
  "sanitize",
  "dom-cleanup"
] as const;

export type ExtractionStep = (typeof EXTRACTION_STEPS)[number];

export {
  ArticleExtractionError,
  type ExtractionErrorCode,
  type ExtractionResult,
  type ImageCandidate
} from "./types.js";
export { extractArticle } from "./article.js";
export {
  MIN_ARTICLE_TEXT_LENGTH,
  MAX_LINK_TEXT_RATIO,
  checkArticleQuality,
  type QualityCheck
} from "./quality.js";
export { sanitizeArticleHtml } from "./sanitize.js";

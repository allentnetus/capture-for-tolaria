export interface ExtractionResult {
  title: string;
  html: string;
  textContent: string;
  author?: string;
  published?: string;
  sourceUrl: string;
  extractionMethod: "readability" | "semantic-fallback";
}

export type ExtractionErrorCode = "INVALID_SOURCE_URL" | "NO_RELIABLE_ARTICLE";

export class ArticleExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = "ArticleExtractionError";
    this.code = code;
  }
}

export const MIN_ARTICLE_TEXT_LENGTH = 24;
export const MAX_LINK_TEXT_RATIO = 0.72;

export interface QualityCheck {
  accepted: boolean;
  textContent: string;
  reason?: "empty" | "too-short" | "navigation-heavy";
}

export function checkArticleQuality(root: Element): QualityCheck {
  const textContent = (root.textContent ?? "").replace(/\s+/gu, " ").trim();
  if (textContent.length === 0) {
    return { accepted: false, textContent, reason: "empty" };
  }

  if (textContent.length < MIN_ARTICLE_TEXT_LENGTH) {
    return { accepted: false, textContent, reason: "too-short" };
  }

  const linkTextLength = Array.from(root.querySelectorAll("a")).reduce(
    (total, link) => total + (link.textContent ?? "").trim().length,
    0
  );
  const linkTextRatio = linkTextLength / textContent.length;
  if (linkTextRatio > MAX_LINK_TEXT_RATIO) {
    return { accepted: false, textContent, reason: "navigation-heavy" };
  }

  return { accepted: true, textContent };
}

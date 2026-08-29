import createDOMPurify from "dompurify";
import type { ImageCandidate } from "./types.js";

const FORBIDDEN_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "style",
  "link",
  "meta"
];

function resolveSafeHttpUrl(value: string, sourceUrl: string): string | null {
  try {
    const url = new URL(value, sourceUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function srcsetCandidates(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/u)[0])
    .filter((entry): entry is string => Boolean(entry));
}

function firstSafeUrl(
  values: readonly (string | null)[],
  sourceUrl: string,
  srcset = false
): string | null {
  const candidates = values.flatMap((value) =>
    srcset ? srcsetCandidates(value) : value ? [value] : []
  );
  return candidates
    .map((candidate) => resolveSafeHttpUrl(candidate, sourceUrl))
    .find((candidate): candidate is string => Boolean(candidate)) ?? null;
}

function cleanResourceUrls(
  root: Element,
  sourceUrl: string
): ImageCandidate[] {
  for (const link of Array.from(root.querySelectorAll("a[href]"))) {
    const href = link.getAttribute("href");
    const safeHref = href ? resolveSafeHttpUrl(href, sourceUrl) : null;
    if (safeHref) {
      link.setAttribute("href", safeHref);
    } else {
      link.removeAttribute("href");
    }
  }

  const images: ImageCandidate[] = [];
  for (const image of Array.from(root.querySelectorAll("img"))) {
    const pictureSources = image.closest("picture")
      ? Array.from(image.closest("picture")!.querySelectorAll("source"))
      : [];
    const pictureCandidates = pictureSources.flatMap((source) => [
      source.getAttribute("data-src"),
      source.getAttribute("data-srcset"),
      source.getAttribute("srcset")
    ]);
    const safeSrc =
      firstSafeUrl([image.getAttribute("data-src")], sourceUrl) ??
      firstSafeUrl([image.getAttribute("data-srcset")], sourceUrl, true) ??
      firstSafeUrl(pictureCandidates, sourceUrl, true) ??
      firstSafeUrl([image.getAttribute("srcset")], sourceUrl, true) ??
      firstSafeUrl([image.getAttribute("src")], sourceUrl);

    if (safeSrc) {
      image.setAttribute("src", safeSrc);
      image.removeAttribute("data-src");
      image.removeAttribute("data-srcset");
      image.removeAttribute("srcset");
      const altText = image.getAttribute("alt")?.trim();
      images.push(
        altText
          ? { remoteUrl: safeSrc, altText }
          : { remoteUrl: safeSrc }
      );
    } else {
      image.remove();
    }
  }

  for (const source of Array.from(root.querySelectorAll("picture > source"))) {
    source.remove();
  }

  return images;
}

export interface SanitizedArticle {
  html: string;
  images: ImageCandidate[];
}

export function sanitizeArticleContent(
  html: string,
  sourceUrl: string,
  ownerDocument: Document
): SanitizedArticle {
  const window = ownerDocument.defaultView;
  if (!window) {
    throw new Error("Article document 必须关联可用的 DOM window");
  }

  const purifier = createDOMPurify(window);
  const sanitized = purifier.sanitize(html, {
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ["srcdoc"],
    USE_PROFILES: { html: true }
  });
  const outputDocument = ownerDocument.implementation.createHTMLDocument("capture");
  outputDocument.body.innerHTML = sanitized;

  for (const element of Array.from(
    outputDocument.body.querySelectorAll(
      "nav, footer, aside, [hidden], [aria-hidden=\"true\"], [role=\"navigation\"], [role=\"banner\"]"
    )
  )) {
    element.remove();
  }

  for (const element of Array.from(outputDocument.body.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const images = cleanResourceUrls(outputDocument.body, sourceUrl);
  return { html: outputDocument.body.innerHTML, images };
}

export function sanitizeArticleHtml(
  html: string,
  sourceUrl: string,
  ownerDocument: Document
): string {
  return sanitizeArticleContent(html, sourceUrl, ownerDocument).html;
}

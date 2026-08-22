import createDOMPurify from "dompurify";

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

function firstSrcsetCandidate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const candidate = value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/u)[0])
    .find((entry): entry is string => Boolean(entry));
  return candidate ?? null;
}

function cleanResourceUrls(root: Element, sourceUrl: string): void {
  for (const link of Array.from(root.querySelectorAll("a[href]"))) {
    const href = link.getAttribute("href");
    const safeHref = href ? resolveSafeHttpUrl(href, sourceUrl) : null;
    if (safeHref) {
      link.setAttribute("href", safeHref);
    } else {
      link.removeAttribute("href");
    }
  }

  for (const image of Array.from(root.querySelectorAll("img"))) {
    const candidates = [
      image.getAttribute("src"),
      image.getAttribute("data-src"),
      firstSrcsetCandidate(image.getAttribute("srcset"))
    ];
    const safeSrc = candidates
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => resolveSafeHttpUrl(candidate, sourceUrl))
      .find((candidate): candidate is string => Boolean(candidate));

    if (safeSrc) {
      image.setAttribute("src", safeSrc);
      image.removeAttribute("data-src");
      image.removeAttribute("srcset");
    } else {
      image.remove();
    }
  }
}

export function sanitizeArticleHtml(
  html: string,
  sourceUrl: string,
  ownerDocument: Document
): string {
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

  cleanResourceUrls(outputDocument.body, sourceUrl);
  return outputDocument.body.innerHTML;
}

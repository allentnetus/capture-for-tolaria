import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractArticle } from "@capture-for-tolaria/extractor";
import { renderMarkdown } from "../src/index.js";

const fixtureRoot = fileURLToPath(new URL("../../../tests/fixtures/", import.meta.url));
const expectedRoot = join(fixtureRoot, "expected");
const normalizeLineEndings = (value: string): string => value.replace(/\r\n/gu, "\n");
const goldenFixtures = [
  "simple-article.html",
  "chinese-article.html",
  "code-blocks.html",
  "table.html",
  "lazy-image.html",
  "relative-links.html"
] as const;

for (const fixtureName of goldenFixtures) {
  it(`Golden: ${fixtureName}`, () => {
    const sourceUrl = `https://example.com/fixtures/${fixtureName}`;
    const html = readFileSync(join(fixtureRoot, fixtureName), "utf8");
    const document = new JSDOM(html, { url: sourceUrl }).window.document;
    const article = extractArticle(document, sourceUrl);
    const actual = renderMarkdown(article, "2026-08-21T17:05:00+08:00").markdown;
    const expectedName = fixtureName.replace(/\.html$/u, ".md");
    const expected = readFileSync(join(expectedRoot, expectedName), "utf8");
    expect(normalizeLineEndings(actual)).toBe(normalizeLineEndings(expected));
  });
}

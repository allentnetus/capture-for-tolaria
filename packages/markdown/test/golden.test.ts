import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { extractArticle } from "@capture-for-tolaria/extractor";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  localizeArticleImages,
  type AssetFetcher
} from "../../../apps/helper/src/index.js";
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
  "relative-links.html",
  "wechat-article.html"
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

it("端到端本地化合成文章图片并保留 Asset 元数据", async () => {
  const fixtureName = "wechat-article.html";
  const sourceUrl = `https://example.com/fixtures/${fixtureName}`;
  const html = readFileSync(join(fixtureRoot, fixtureName), "utf8");
  const document = new JSDOM(html, { url: sourceUrl }).window.document;
  const article = extractArticle(document, sourceUrl);
  const rendered = renderMarkdown(article, "2026-08-21T17:05:00+08:00");
  const responses: Record<string, { bytes: Uint8Array; contentType: string }> = {
    "https://cdn.example.com/images/hero.jpg": {
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg"
    },
    "https://example.com/images/detail.png": {
      bytes: new Uint8Array([4, 5, 6]),
      contentType: "image/png"
    },
    "https://example.com/images/diagram.webp": {
      bytes: new Uint8Array([7, 8, 9]),
      contentType: "image/webp"
    }
  };
  const fetcher: AssetFetcher = {
    fetch: async (url) => {
      const asset = responses[url];
      if (!asset) {
        throw new Error("unexpected fixture URL");
      }
      return new Response(asset.bytes, {
        status: 200,
        headers: { "content-type": asset.contentType }
      });
    },
    resolveHost: async () => ["93.184.216.34"]
  };

  const localized = await localizeArticleImages(
    rendered.markdown,
    rendered.images,
    { ...DEFAULT_ASSET_LOCALIZATION_POLICY, timeoutMs: 100 },
    fetcher
  );
  const expected = readFileSync(
    join(expectedRoot, "wechat-article-localized.md"),
    "utf8"
  );

  expect(normalizeLineEndings(localized.markdown)).toBe(normalizeLineEndings(expected));
  expect(localized.markdown).toContain("公众号图片文章 Fixture");
  expect(localized.markdown).toContain("https://example.com/fixtures/wechat-article.html");
  expect(localized.markdown).toContain("2026-08-21T17:05:00+08:00");
  expect(localized.markdown).not.toMatch(/cookie|authorization|javascript:|file:|blob:|[A-Za-z]:\\/iu);
  expect(localized.summary).toEqual({ requested: 3, localized: 3, fallback: 0 });
  expect(localized.assets.map(({ remoteUrl, relativePath, contentType, byteLength }) => ({
    remoteUrl,
    relativePath,
    contentType,
    byteLength
  }))).toEqual([
    {
      remoteUrl: "https://cdn.example.com/images/hero.jpg",
      relativePath: "Assets/039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.jpg",
      contentType: "image/jpeg",
      byteLength: 3
    },
    {
      remoteUrl: "https://example.com/images/detail.png",
      relativePath: "Assets/787c798e39a5bc1910355bae6d0cd87a36b2e10fd0202a83e3bb6b005da83472.png",
      contentType: "image/png",
      byteLength: 3
    },
    {
      remoteUrl: "https://example.com/images/diagram.webp",
      relativePath: "Assets/66a6757151f8ee55db127716c7e3dce0be8074b64e20eda542e5c1e46ca9c41e.webp",
      contentType: "image/webp",
      byteLength: 3
    }
  ]);
});

import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { captureArticleFromDocument } from "../src/content/capture-article.js";

it("从当前 Document 生成安全的 clip.article payload", () => {
  const document = new JSDOM(`
    <article>
      <h1>Extension article</h1>
      <p>This article body is long enough to pass extraction and produce a Markdown payload.</p>
      <script>alert('xss')</script>
    </article>
  `, { url: "https://example.com/article" }).window.document;

  const payload = captureArticleFromDocument(
    document,
    "https://example.com/article",
    "2026-08-21T17:05:00+08:00"
  );
  expect(payload.relativeFolder).toBe("Inbox/Web");
  expect(payload.title).toBe("Extension article");
  expect(payload.markdown).toContain("source_url: \"https://example.com/article\"");
  expect(payload.markdown).not.toContain("<script");
  expect(payload.images).toBeUndefined();
});

it("将正文图片候选传递到 clip.article payload", () => {
  const document = new JSDOM(`
    <article>
      <h1>Article with image</h1>
      <p>This article body is long enough to pass extraction and include a safe image.</p>
      <img data-src="https://cdn.example.com/article/hero.png" alt="Hero image">
    </article>
  `, { url: "https://example.com/article-with-image" }).window.document;

  const payload = captureArticleFromDocument(
    document,
    "https://example.com/article-with-image",
    "2026-08-27T22:00:00+08:00"
  );

  expect(payload.images).toEqual([{
    remoteUrl: "https://cdn.example.com/article/hero.png",
    altText: "Hero image"
  }]);
});

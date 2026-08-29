import { expect, it } from "vitest";
import { renderMarkdown, type MarkdownDocument } from "../src/index.js";
import type { ExtractionResult } from "@capture-for-tolaria/extractor";

function resultFromHtml(html: string): ExtractionResult {
  return {
    title: "Conversion article",
    html,
    textContent: "Conversion article content",
    sourceUrl: "https://example.com/articles/conversion",
    extractionMethod: "readability",
    images: [
      {
        remoteUrl: "https://example.com/images/hero.png",
        altText: "Hero"
      }
    ]
  };
}

function render(html: string): MarkdownDocument {
  return renderMarkdown(resultFromHtml(html), "2026-08-21T17:05:00+08:00");
}

it("生成稳定的 frontmatter 但不在正文重复来源", () => {
  const document = render("<h1>Conversion article</h1><p>Body content.</p>");

  expect(document.frontmatter).toMatchObject({
    type: "Resource",
    title: "Conversion article",
    source_url: "https://example.com/articles/conversion",
    site: "example.com",
    clipped: "2026-08-21T17:05:00+08:00"
  });
  expect(document.markdown).toContain("# Conversion article");
  expect(document.markdown).toContain(
    'source_url: "https://example.com/articles/conversion"'
  );
  expect(document.markdown).not.toContain(
    "> Source: https://example.com/articles/conversion"
  );
  expect(document.markdown).not.toContain("## Source");
  expect(document.markdown).not.toContain("\n## Content\n");
  expect(document.markdown.trimEnd()).not.toMatch(
    /https:\/\/example\.com\/articles\/conversion$/u
  );
});

it("移除生成的 Content 包装但保留正文中的同名标题", () => {
  const document = render(
    "<h1>Conversion article</h1><h2>Content</h2><p>Body content.</p>"
  );

  expect(document.markdown.match(/^## Content$/gmu)).toEqual(["## Content"]);
  expect(document.markdown).toContain("Body content.");
});

it("支持 GFM 表格、任务列表、删除线、代码和引用", () => {
  const document = render(`
    <h1>Conversion article</h1>
    <h2>Features</h2>
    <table><thead><tr><th>Channel</th><th>Works</th></tr></thead>
      <tbody><tr><td>File</td><td>Yes</td></tr></tbody></table>
    <ul><li><input type="checkbox" checked>Done</li><li><input type="checkbox">Later</li></ul>
    <del>old text</del>
    <blockquote><p>Keep the fact layer.</p></blockquote>
    <pre><code class="language-typescript">const value = true;</code></pre>
  `);

  expect(document.markdown).toContain("| Channel | Works |");
  expect(document.markdown).toContain("-   [x] Done");
  expect(document.markdown).toContain("~~old text~~");
  expect(document.markdown).toContain("> Keep the fact layer.");
  expect(document.markdown).toContain("```typescript");
});

it("保留链接、图片和 lazy image 转换后的 URL", () => {
  const document = render(`
    <h1>Conversion article</h1>
    <p><a href="https://example.com/docs">Guide</a></p>
    <img src="https://example.com/images/hero.png" alt="Hero">
    <img data-src="https://example.com/images/lazy.png" alt="Lazy">
  `);

  expect(document.markdown).toContain("[Guide](https://example.com/docs)");
  expect(document.markdown).toContain("![Hero](https://example.com/images/hero.png)");
  expect(document.markdown).toContain("![Lazy](https://example.com/images/lazy.png)");
  expect(document.images).toEqual([
    {
      remoteUrl: "https://example.com/images/hero.png",
      altText: "Hero"
    }
  ]);
});

it("不把可执行标签写入 Markdown", () => {
  const document = render(`
    <h1>Conversion article</h1>
    <p>Safe body.</p><script>alert('xss')</script><iframe src="evil"></iframe>
  `);

  expect(document.markdown).not.toMatch(/<script|<iframe|alert/iu);
});

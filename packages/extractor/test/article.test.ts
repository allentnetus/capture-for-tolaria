import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  ArticleExtractionError,
  extractArticle
} from "../src/index.js";

function documentFrom(html: string, url = "https://example.com/articles/page") {
  return new JSDOM(html, { url }).window.document;
}

it("从简单 HTML 提取标题和正文", () => {
  const result = extractArticle(
    documentFrom(`
      <html><head><title>Readable page</title></head><body>
        <article><h1>Readable page</h1>
          <p>This article body is long enough to be accepted as reliable content.</p>
          <p>It contains a second paragraph for the extraction quality check.</p>
        </article>
      </body></html>
    `),
    "https://example.com/articles/page"
  );

  expect(result.title).toBe("Readable page");
  expect(result.textContent).toContain("reliable content");
  expect(result.extractionMethod).toBe("readability");
});

it("保持中文和 Unicode 标点", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>「知识摄取」：你好，世界！</h1>
        <p>这是一段中文正文，包含全角标点、Unicode 字符和可读的语义内容。</p>
      </article>
    `),
    "https://example.com/中文"
  );

  expect(result.title).toBe("「知识摄取」：你好，世界！");
  expect(result.textContent).toContain("全角标点");
});

it("移除 script、iframe、事件属性和 javascript URL", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Sanitized article</h1>
        <p onclick="steal()">This text remains but the event handler does not.</p>
        <script>alert('xss')</script>
        <iframe src="https://evil.example/frame"></iframe>
        <a href="javascript:alert(1)">Unsafe link</a>
        <img src="javascript:alert(1)" onerror="steal()" alt="unsafe">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.html).not.toMatch(/<script|<iframe|javascript:|on\w+=/iu);
  expect(result.html).toContain("Unsafe link");
});

it("将相对图片 URL 解析为来源页面下的绝对 HTTP/HTTPS URL", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Images</h1>
        <p>This article includes a remote image that should remain a URL only.</p>
        <img src="/images/hero.png" alt="Hero">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.html).toContain('src="https://example.com/images/hero.png"');
});

it("从 src、data-src 和 srcset 中选择可用图片 URL", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Lazy images</h1>
        <p>This article includes image loading metadata that should resolve safely.</p>
        <img src="javascript:bad()" data-src="/lazy/hero.png" srcset="/lazy/other.png 2x" alt="Hero">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.html).toContain('src="https://example.com/lazy/hero.png"');
  expect(result.html).not.toContain("data-src");
  expect(result.html).not.toContain("srcset");
  expect(result.images).toEqual([
    {
      remoteUrl: "https://example.com/lazy/hero.png",
      altText: "Hero"
    }
  ]);
});

it("按优先级提取 data-srcset、picture/source 和 srcset 图片候选", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Image candidates</h1>
        <p>This article has several image loading forms that should become reusable candidates.</p>
        <img src="/placeholder.gif" data-srcset="/images/lazy.png 1x, /images/lazy@2x.png 2x" alt="Lazy">
        <picture>
          <source srcset="/images/hero.webp 1x, /images/hero@2x.webp 2x">
          <img src="/placeholder-hero.gif" alt="Hero">
        </picture>
        <img srcset="/images/fallback.png 1x, /images/fallback@2x.png 2x" alt="Fallback">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.images).toEqual([
    {
      remoteUrl: "https://example.com/images/lazy.png",
      altText: "Lazy"
    },
    {
      remoteUrl: "https://example.com/images/hero.webp",
      altText: "Hero"
    },
    {
      remoteUrl: "https://example.com/images/fallback.png",
      altText: "Fallback"
    }
  ]);
});

it("对重复图片 URL 只保留第一个候选", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Repeated images</h1>
        <p>This article repeats one image URL and should download it only once.</p>
        <img src="/images/repeated.png" alt="First">
        <img src="/images/repeated.png" alt="Second">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.images).toEqual([
    {
      remoteUrl: "https://example.com/images/repeated.png",
      altText: "First"
    }
  ]);
});

it("不把代码块中的图片样式文本当作图片候选", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Code image syntax</h1>
        <p>This article contains a code example that resembles Markdown image syntax.</p>
        <pre><code>![Code](https://example.com/code.png)</code></pre>
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.images).toEqual([]);
});

it("拒绝 file、javascript、vbscript、blob、凭据和危险 data URL", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Unsafe URLs</h1>
        <p>This article has unsafe image URLs which must be removed without network access.</p>
        <img src="file:///secret.txt" alt="file">
        <img src="javascript:alert(1)" alt="js">
        <img src="vbscript:msgbox(1)" alt="vbscript">
        <img src="blob:https://example.com/blob-id" alt="blob">
        <img src="https://user:password@example.com/secret.png" alt="credential">
        <img src="data:text/html,<script>alert(1)</script>" alt="data">
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.html).not.toMatch(/file:|javascript:|vbscript:|blob:|data:text|user:password/iu);
  expect(result.html).not.toMatch(/<img/iu);
  expect(result.images).toEqual([]);
});

it("保留代码块的 language class", () => {
  const result = extractArticle(
    documentFrom(`
      <article><h1>Code sample</h1>
        <p>This article keeps a typed code block so Markdown can preserve its language.</p>
        <pre><code class="language-typescript">const value = true;</code></pre>
      </article>
    `),
    "https://example.com/articles/page"
  );

  expect(result.html).toContain("language-typescript");
});

it("不会把 body.innerText 作为无条件 fallback", () => {
  expect(() => extractArticle(
    documentFrom(`
      <body><nav>Navigation text that should not become an article.</nav>
        <footer>Footer text only.</footer>
      </body>
    `),
    "https://example.com/articles/page"
  )).toThrowError(ArticleExtractionError);
});

it("Readability 质量失败后使用 article/main 语义候选", () => {
  const result = extractArticle(
    documentFrom(`
      <div class="shell"><main><h1>Semantic candidate</h1>
        <p>This semantic candidate contains enough content to pass the same quality check.</p>
      </main></div>
    `),
    "https://example.com/articles/page"
  );

  expect(result.extractionMethod).toMatch(/readability|semantic-fallback/u);
  expect(result.textContent).toContain("semantic candidate");
});

it("所有策略失败时返回明确的提取失败", () => {
  expect(() => extractArticle(
    documentFrom("<body><main><p>Too short.</p></main></body>"),
    "https://example.com/articles/page"
  )).toThrow("Unable to extract this page reliably.");
});

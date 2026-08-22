import { expect, it } from "vitest";
import {
  createArticleRequest,
  validateCaptureArticleMessage,
  validateCaptureResponse,
  validateContentPayload
} from "../src/background/messages.js";

const payload = {
  relativeFolder: "Inbox/Web",
  title: "Article",
  markdown: "# Article\n\nBody",
  sourceUrl: "https://example.com/article",
  metadata: {}
};

it("只接受 Extension UI 的 Article Capture 消息", () => {
  expect(validateCaptureArticleMessage({ type: "capture.article" })).toEqual({
    type: "capture.article"
  });
  expect(() => validateCaptureArticleMessage({ type: "writeFile" })).toThrow();
  expect(() => validateCaptureArticleMessage({ type: "capture.article", path: "C:\\outside" })).not.toThrow();
});

it("校验 Content Script payload 并拒绝超大 Markdown", () => {
  expect(validateContentPayload(payload)).toEqual(payload);
  expect(() => validateContentPayload({
    ...payload,
    markdown: "x".repeat(1_000_001)
  })).toThrow();
  expect(() => validateContentPayload({
    ...payload,
    sourceUrl: "javascript:alert(1)"
  })).toThrow();
});

it("创建带 requestId 的 clip.article 请求并校验响应", () => {
  const request = createArticleRequest(payload, "0.1.0-alpha.1", "req-1");
  expect(request).toMatchObject({ action: "clip.article", requestId: "req-1" });
  expect(validateCaptureResponse({ ok: true, relativePath: "Inbox/Web/file.md" })).toEqual({
    ok: true,
    relativePath: "Inbox/Web/file.md"
  });
  expect(() => validateCaptureResponse({ ok: true })).toThrow();
});

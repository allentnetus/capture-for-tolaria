import { expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  createHelloResponse,
  validateHelloResponse,
  validateRequest,
  validateResponse
} from "../src/index.js";

const validArticleRequest = {
  protocolVersion: PROTOCOL_VERSION,
  requestId: "req-1",
  extensionVersion: "0.1.0-alpha.1",
  action: "clip.article",
  payload: {
    relativeFolder: "Inbox/Web",
    title: "Article",
    markdown: "# Article",
    sourceUrl: "https://example.com/article",
    metadata: {}
  }
} as const;

it("接受带版本的文章请求", () => {
  expect(validateRequest(validArticleRequest).action).toBe("clip.article");
});

it("拒绝未知 action", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    action: "clip.unknown"
  })).toThrow();
});

it("拒绝缺少 requestId 的请求", () => {
  const { requestId: _requestId, ...requestWithoutId } = validArticleRequest;
  expect(() => validateRequest(requestWithoutId)).toThrow();
});

it("拒绝不支持的协议版本", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    protocolVersion: 2
  })).toThrow();
});

it("拒绝试图离开相对目录的路径 payload", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      relativeFolder: "../outside"
    }
  })).toThrow();
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      relativeFolder: "C:\\Users\\other"
    }
  })).toThrow();
});

it("拒绝缺少 sourceUrl 或 metadata 的文章 payload", () => {
  const { sourceUrl: _sourceUrl, ...payloadWithoutSource } = validArticleRequest.payload;
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: payloadWithoutSource
  })).toThrow();

  const { metadata: _metadata, ...payloadWithoutMetadata } = validArticleRequest.payload;
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: payloadWithoutMetadata
  })).toThrow();
});

it("拒绝没有 payload 的 clip.article", () => {
  const { payload: _payload, ...requestWithoutPayload } = validArticleRequest;
  expect(() => validateRequest(requestWithoutPayload)).toThrow();
});

it("拒绝携带文章 payload 的 hello 请求", () => {
  expect(() => validateRequest({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-hello",
    extensionVersion: "0.1.0-alpha.1",
    action: "hello",
    payload: validArticleRequest.payload
  })).toThrow();
});

it("校验成功响应时保留 requestId", () => {
  const response = validateResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-1",
    helperVersion: "0.1.0-alpha.1",
    ok: true,
    result: { relativePath: "Inbox/Web/20260821 - Article.md" }
  });
  expect(response.requestId).toBe("req-1");
});

it("能够生成带 capabilities 的 hello 响应", () => {
  expect(createHelloResponse("0.1.0-alpha.1", ["clip.article", "direct-file", "clip.article"])).toEqual({
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: "0.1.0-alpha.1",
    capabilities: ["clip.article", "direct-file"]
  });
});

it("校验 hello response 的 capabilities", () => {
  expect(validateHelloResponse({
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: "0.1.0-alpha.1",
    capabilities: ["clip.article"]
  })).toMatchObject({ capabilities: ["clip.article"] });
});

import { expect, it, vi } from "vitest";
import {
  createArticleRequest,
  createVaultConfigGetRequest,
  createVaultConfigSetRequest,
  validateCaptureArticleMessage,
  validateCaptureResponse,
  validateContentPayload
} from "../src/background/messages.js";
import { handleCaptureMessage, type CaptureDependencies } from "../src/background/main.js";
import type { NativeMessagingPort } from "../src/background/native-messaging.js";

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
  expect(validateContentPayload({
    ...payload,
    images: [{ remoteUrl: "https://cdn.example.com/article/hero.png", altText: "Hero" }]
  }).images).toEqual([{
    remoteUrl: "https://cdn.example.com/article/hero.png",
    altText: "Hero"
  }]);
});

it("创建带 requestId 的 clip.article 请求并校验响应", () => {
  const request = createArticleRequest(payload, "0.1.0-alpha.1", "req-1");
  expect(request).toMatchObject({ action: "clip.article", requestId: "req-1" });
  expect(validateCaptureResponse({ ok: true, relativePath: "Inbox/Web/file.md" })).toEqual({
    ok: true,
    relativePath: "Inbox/Web/file.md"
  });
  expect(() => validateCaptureResponse({ ok: true })).toThrow();
  expect(validateCaptureResponse({
    ok: true,
    relativePath: "Inbox/Web/file.md",
    summary: { requested: 2, localized: 1, fallback: 1 },
    warnings: ["IMAGE_DOWNLOAD_FAILED"]
  })).toEqual({
    ok: true,
    relativePath: "Inbox/Web/file.md",
    summary: { requested: 2, localized: 1, fallback: 1 },
    warnings: ["IMAGE_DOWNLOAD_FAILED"]
  });
});

it("创建仅带绝对 Vault root 的配置请求", () => {
  expect(createVaultConfigGetRequest("0.1.0-beta.2", "vault-get-1")).toEqual({
    protocolVersion: 1,
    requestId: "vault-get-1",
    extensionVersion: "0.1.0-beta.2",
    action: "vault.config.get"
  });
  expect(createVaultConfigSetRequest(
    "C:\\Users\\mrvic\\Vault",
    "0.1.0-beta.2",
    "vault-set-1"
  )).toEqual({
    protocolVersion: 1,
    requestId: "vault-set-1",
    extensionVersion: "0.1.0-beta.2",
    action: "vault.config.set",
    payload: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  });
});

class SummaryPort implements NativeMessagingPort {
  readonly onMessage = {
    addListener: (listener: (value: unknown) => void) => {
      this.messageListeners.add(listener);
    },
    removeListener: (listener: (value: unknown) => void) => {
      this.messageListeners.delete(listener);
    }
  };
  readonly onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListeners.add(listener);
    },
    removeListener: (listener: () => void) => {
      this.disconnectListeners.delete(listener);
    }
  };
  private readonly messageListeners = new Set<(value: unknown) => void>();
  private readonly disconnectListeners = new Set<() => void>();
  readonly postedMessages: unknown[] = [];

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
    const requestId =
      typeof message === "object" &&
      message !== null &&
      "requestId" in message &&
      typeof message.requestId === "string"
        ? message.requestId
        : "request-from-test";
    const response =
      typeof message === "object" && message !== null && "action" in message && message.action === "hello"
        ? {
            protocolVersion: 1,
            helperVersion: "0.1.0-beta.2",
            capabilities: ["clip.article", "direct-file"]
          }
        : {
            protocolVersion: 1,
            requestId,
            helperVersion: "0.1.0-beta.2",
            ok: true,
            result: {
              relativePath: "Inbox/Web/article.md",
              assets: [{
                remoteUrl: "https://cdn.example.com/article/hero.png",
                relativePath: "Inbox/Web/Assets/hash.png",
                contentType: "image/png",
                byteLength: 12
              }],
              summary: { requested: 2, localized: 1, fallback: 1 },
              warnings: ["IMAGE_DOWNLOAD_FAILED"]
            }
          };
    queueMicrotask(() => {
      for (const listener of this.messageListeners) {
        listener(response);
      }
    });
  }

  disconnect(): void {
    for (const listener of this.disconnectListeners) {
      listener();
    }
  }
}

it("转发 Helper 的图片摘要和 warning 且不泄露绝对路径", async () => {
  const payloadWithImages = {
    ...payload,
    markdown: "![Hero](https://cdn.example.com/article/hero.png)",
    images: [{ remoteUrl: "https://cdn.example.com/article/hero.png", altText: "Hero" }]
  };
  const contentMessages: unknown[] = [];
  const port = new SummaryPort();
  const dependencies: CaptureDependencies = {
    getActiveTab: async () => ({ id: 1, url: "https://example.com/article" }),
    executeContentScript: vi.fn(async () => undefined),
    sendContentMessage: vi.fn(async (_tabId, message) => {
      contentMessages.push(message);
      return message.type === "extract.article"
        ? { ok: true, payload: payloadWithImages }
        : { ok: true };
    }),
    connectNative: () => port,
    getDefaultRelativeFolder: async () => "Inbox/Reading"
  };

  const response = await handleCaptureMessage(
    { type: "capture.article" },
    "extension-id",
    "extension-id",
    dependencies
  );

  expect(response).toEqual({
    ok: true,
    relativePath: "Inbox/Web/article.md",
    summary: { requested: 2, localized: 1, fallback: 1 },
    warnings: ["IMAGE_DOWNLOAD_FAILED"]
  });
  expect(JSON.stringify(response)).not.toContain("C:\\Users");
  const articleRequest = port.postedMessages.find(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "action" in message &&
      message.action === "clip.article"
  );
  expect(articleRequest).toMatchObject({
    action: "clip.article",
    payload: { relativeFolder: "Inbox/Reading" }
  });
  expect(JSON.stringify(articleRequest)).not.toContain("vaultRoot");
  expect(contentMessages.at(-1)).toMatchObject({
    type: "capture.result",
    status: "saved",
    summary: { requested: 2, localized: 1, fallback: 1 },
    warnings: ["IMAGE_DOWNLOAD_FAILED"]
  });
});

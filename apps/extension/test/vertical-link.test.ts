import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { handleRawRequest } from "../../helper/src/index.js";
import {
  EXTENSION_VERSION,
  handleCaptureMessage,
  type CaptureDependencies
} from "../src/background/main.js";
import {
  captureArticleFromDocument,
  type CapturedArticlePayload
} from "../src/content/capture-article.js";
import type { NativeMessagingPort } from "../src/background/native-messaging.js";

class MockHostPort implements NativeMessagingPort {
  readonly messages: unknown[] = [];
  private readonly messageListeners = new Set<(value: unknown) => void>();
  private readonly disconnectListeners = new Set<() => void>();
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

  constructor(private readonly vaultRoot: string) {}

  postMessage(message: unknown): void {
    this.messages.push(message);
    void handleRawRequest(message, { getVault: async () => this.vaultRoot }).then(
      (response) => {
        queueMicrotask(() => {
          for (const listener of this.messageListeners) {
            listener(response);
          }
        });
      }
    );
  }

  disconnect(): void {
    for (const listener of this.disconnectListeners) {
      listener();
    }
  }
}

it("完成当前文章到 Helper File Channel 的真实垂直链路", async () => {
  const vault = await mkdtemp(join(tmpdir(), "capture-for-tolaria-integration-"));
  try {
    const sourceUrl = "https://example.com/integration/article";
    const document = new JSDOM(`
      <article>
        <h1>Integration article</h1>
        <p>This public article travels through extraction, Markdown, protocol validation, and File Channel.</p>
      </article>
    `, { url: sourceUrl }).window.document;
    const payload: CapturedArticlePayload = captureArticleFromDocument(
      document,
      sourceUrl,
      "2026-08-21T17:05:00+08:00"
    );
    const contentMessages: unknown[] = [];
    const dependencies: CaptureDependencies = {
      getActiveTab: async () => ({ id: 1, url: sourceUrl }),
      executeContentScript: async () => undefined,
      sendContentMessage: async (_tabId, message) => {
        contentMessages.push(message);
        if (message.type === "extract.article") {
          return { ok: true, payload };
        }
        return { ok: true };
      },
      connectNative: () => new MockHostPort(vault),
      getDefaultRelativeFolder: async () => "Inbox/Reading"
    };

    const first = await handleCaptureMessage(
      { type: "capture.article" },
      "ncjeeembmcgkfjipkfhganbdnadbhdcl",
      "ncjeeembmcgkfjipkfhganbdnadbhdcl",
      dependencies
    );
    const second = await handleCaptureMessage(
      { type: "capture.article" },
      "ncjeeembmcgkfjipkfhganbdnadbhdcl",
      "ncjeeembmcgkfjipkfhganbdnadbhdcl",
      dependencies
    );

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (first.ok && second.ok) {
      expect(second.relativePath).toContain("(2).md");
      expect(first.relativePath).toContain("Inbox/Reading/");
      expect(second.relativePath).toContain("Inbox/Reading/");
      expect(await readFile(join(vault, first.relativePath), "utf8")).toContain(
        "Integration article"
      );
      expect(await readFile(join(vault, second.relativePath), "utf8")).toContain(
        "source_url: \"https://example.com/integration/article\""
      );
    }
    expect(EXTENSION_VERSION).toBe("0.1.0-beta.5");
    const resultMessages = contentMessages.filter(
      (message): message is { type: "capture.result"; status: "saved"; relativePath: string } =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "capture.result" &&
        "status" in message &&
        message.status === "saved"
    );
    expect(resultMessages).toHaveLength(2);
    expect(resultMessages[0]?.relativePath).toBe(first.ok ? first.relativePath : "");
    expect(resultMessages[1]?.relativePath).toBe(second.ok ? second.relativePath : "");
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 15_000);

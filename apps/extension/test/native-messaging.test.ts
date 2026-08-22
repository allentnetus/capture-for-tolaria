import { expect, it } from "vitest";
import {
  NATIVE_HOST_NAME,
  NativeMessagingClientError,
  captureViaNativeMessaging,
  type NativeMessagingPort
} from "../src/background/native-messaging.js";
import type { ClipRequest } from "@capture-for-tolaria/protocol";

class FakePort implements NativeMessagingPort {
  readonly messages: unknown[] = [];
  disconnected = false;
  responseRequestId = "req-1";
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

  postMessage(message: unknown): void {
    this.messages.push(message);
    if (
      typeof message === "object" &&
      message !== null &&
      "action" in message &&
      message.action === "hello"
    ) {
      this.emit({
        protocolVersion: 1,
        helperVersion: "0.1.0-alpha.1",
        capabilities: ["clip.article", "direct-file"]
      });
      return;
    }
    this.emit({
      protocolVersion: 1,
      requestId: this.responseRequestId,
      helperVersion: "0.1.0-alpha.1",
      ok: true,
      result: { relativePath: "Inbox/Web/20260821 - Article.md" }
    });
  }

  disconnect(): void {
    this.disconnected = true;
    for (const listener of this.disconnectListeners) {
      listener();
    }
  }

  private emit(value: unknown): void {
    queueMicrotask(() => {
      for (const listener of this.messageListeners) {
        listener(value);
      }
    });
  }
}

const request: ClipRequest = {
  protocolVersion: 1,
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
};

it("完成 hello、capability 校验和 clip.article 往返", async () => {
  const port = new FakePort();
  const response = await captureViaNativeMessaging(request, (hostName) => {
    expect(hostName).toBe(NATIVE_HOST_NAME);
    return port;
  });

  expect(response).toMatchObject({
    ok: true,
    requestId: "req-1",
    result: { relativePath: "Inbox/Web/20260821 - Article.md" }
  });
  expect(port.messages).toHaveLength(2);
  expect(port.disconnected).toBe(true);
});

it("requestId 不匹配时安全失败并断开连接", async () => {
  const port = new FakePort();
  port.responseRequestId = "wrong-request";
  await expect(captureViaNativeMessaging(request, () => port)).rejects.toThrow(
    NativeMessagingClientError
  );
  expect(port.disconnected).toBe(true);
});

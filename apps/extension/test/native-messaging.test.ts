import { expect, it, vi } from "vitest";
import {
  NATIVE_HOST_NAME,
  NativeMessagingClientError,
  createNativeMessagingClient,
  captureViaNativeMessaging,
  requestVaultConfig,
  type NativeMessagingPort
} from "../src/background/native-messaging.js";
import type { ClipRequest, VaultConfigRequest } from "@capture-for-tolaria/protocol";

class FakePort implements NativeMessagingPort {
  readonly messages: unknown[] = [];
  disconnected = false;
  responseRequestId?: string;
  responseDelayMs = 0;
  capabilities = ["clip.article", "direct-file"];
  vaultConfigResponse: unknown = undefined;
  constructor(private readonly options: { disconnectOnAction?: string } = {}) {}
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
        capabilities: this.capabilities
      });
      return;
    }
    if (this.vaultConfigResponse !== undefined) {
      this.emit(this.vaultConfigResponse);
      return;
    }
    if (
      typeof message === "object" &&
      message !== null &&
      "action" in message &&
      message.action === this.options.disconnectOnAction
    ) {
      queueMicrotask(() => this.disconnect());
      return;
    }
    const requestId =
      typeof message === "object" &&
      message !== null &&
      "requestId" in message &&
      typeof message.requestId === "string"
        ? message.requestId
        : "req-1";
    const response = {
      protocolVersion: 1,
      requestId: this.responseRequestId ?? requestId,
      helperVersion: "0.1.0-alpha.1",
      ok: true,
      result: { relativePath: "Inbox/Web/20260821 - Article.md" }
    };
    if (this.responseDelayMs > 0) {
      setTimeout(() => this.emit(response), this.responseDelayMs);
    } else {
      this.emit(response);
    }
  }

  disconnect(): void {
    if (this.disconnected) {
      return;
    }
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

function isMessageWithAction(
  value: unknown,
  action: string
): value is { action: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    value.action === action
  );
}

const isHelloMessage = (value: unknown): boolean =>
  isMessageWithAction(value, "hello");
const isClipArticleMessage = (value: unknown): boolean =>
  isMessageWithAction(value, "clip.article");

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

it("等待超过旧 10 秒的文章响应，避免图片处理完成后误报超时", async () => {
  vi.useFakeTimers();
  try {
    const port = new FakePort();
    port.responseDelayMs = 15_000;
    const responsePromise = captureViaNativeMessaging(request, () => port);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(responsePromise).resolves.toMatchObject({
      ok: true,
      requestId: "req-1"
    });
  } finally {
    vi.useRealTimers();
  }
});

it("发送真实 Vault 配置请求并保留 Helper 的业务错误", async () => {
  const getPort = new FakePort();
  getPort.capabilities = ["clip.article", "direct-file", "vault.config"];
  getPort.vaultConfigResponse = {
    protocolVersion: 1,
    requestId: "vault-get-1",
    helperVersion: "0.1.0-alpha.1",
    ok: true,
    result: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  };
  const getRequest: VaultConfigRequest = {
    protocolVersion: 1,
    requestId: "vault-get-1",
    extensionVersion: "0.1.0-alpha.1",
    action: "vault.config.get"
  };
  await expect(requestVaultConfig(getRequest, () => getPort)).resolves.toEqual(
    getPort.vaultConfigResponse
  );
  expect(getPort.messages).toEqual([
    expect.objectContaining({ action: "hello" }),
    getRequest
  ]);

  const setPort = new FakePort();
  setPort.capabilities = ["clip.article", "direct-file", "vault.config"];
  setPort.vaultConfigResponse = {
    protocolVersion: 1,
    requestId: "vault-set-1",
    helperVersion: "0.1.0-alpha.1",
    ok: false,
    error: { code: "VAULT_ACCESS_DENIED", message: "Vault root 不可访问" }
  };
  const setRequest: VaultConfigRequest = {
    protocolVersion: 1,
    requestId: "vault-set-1",
    extensionVersion: "0.1.0-alpha.1",
    action: "vault.config.set",
    payload: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  };
  await expect(requestVaultConfig(setRequest, () => setPort)).resolves.toEqual(
    setPort.vaultConfigResponse
  );
  expect(setPort.messages).toEqual([
    expect.objectContaining({ action: "hello" }),
    setRequest
  ]);
});

it("缺少 vault.config capability 时不发送配置请求，Article client 仍兼容旧 Helper", async () => {
  const port = new FakePort();
  const configRequest: VaultConfigRequest = {
    protocolVersion: 1,
    requestId: "vault-set-1",
    extensionVersion: "0.1.0-alpha.1",
    action: "vault.config.set",
    payload: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  };

  await expect(requestVaultConfig(configRequest, () => port)).rejects.toMatchObject({
    code: "INCOMPATIBLE_HELPER"
  });
  expect(port.messages).toEqual([expect.objectContaining({ action: "hello" })]);

  const articlePort = new FakePort();
  await expect(captureViaNativeMessaging(request, () => articlePort)).resolves.toMatchObject({
    ok: true,
    requestId: "req-1"
  });
  expect(articlePort.messages).toEqual([
    expect.objectContaining({ action: "hello" }),
    request
  ]);
  expect(
    articlePort.messages.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "action" in message &&
        (message.action === "vault.config.get" ||
          message.action === "vault.config.set")
    )
  ).toBe(false);
});

it("连续业务请求复用同一个 Native Messaging 端口并只握手一次", async () => {
  const firstPort = new FakePort();
  const connectNative = vi.fn(() => firstPort);
  const client = createNativeMessagingClient(connectNative);

  await client.capture(request);
  await client.capture({ ...request, requestId: "req-2" });

  expect(connectNative).toHaveBeenCalledTimes(1);
  expect(firstPort.messages.filter(isHelloMessage)).toHaveLength(1);
  expect(firstPort.messages.filter(isClipArticleMessage)).toHaveLength(2);
});

it("端口断开后当前请求失败且下一次请求自动建立新连接", async () => {
  const firstPort = new FakePort({ disconnectOnAction: "clip.article" });
  const secondPort = new FakePort();
  const connectNative = vi
    .fn()
    .mockReturnValueOnce(firstPort)
    .mockReturnValueOnce(secondPort);
  const client = createNativeMessagingClient(connectNative);

  await expect(client.capture(request)).rejects.toMatchObject({
    code: "CONNECT_FAILED"
  });
  await expect(client.capture({ ...request, requestId: "req-2" })).resolves.toMatchObject({
    ok: true,
    requestId: "req-2"
  });

  expect(connectNative).toHaveBeenCalledTimes(2);
  expect(firstPort.messages.filter(isClipArticleMessage)).toHaveLength(1);
  expect(secondPort.messages.filter(isHelloMessage)).toHaveLength(1);
});

it("排队请求保持顺序且不重放断线前已经发送的文章", async () => {
  const firstPort = new FakePort({ disconnectOnAction: "clip.article" });
  const secondPort = new FakePort();
  const connectNative = vi
    .fn()
    .mockReturnValueOnce(firstPort)
    .mockReturnValueOnce(secondPort);
  const client = createNativeMessagingClient(connectNative);

  const first = client.capture(request);
  const second = client.capture({ ...request, requestId: "req-2" });

  await expect(first).rejects.toMatchObject({ code: "CONNECT_FAILED" });
  await expect(second).resolves.toMatchObject({ requestId: "req-2" });
  expect(firstPort.messages.filter(isClipArticleMessage)).toHaveLength(1);
  expect(secondPort.messages.filter(isClipArticleMessage)).toHaveLength(1);
});

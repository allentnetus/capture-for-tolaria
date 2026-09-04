import { expect, it, vi } from "vitest";
import type { NativeMessagingPort } from "../src/background/native-messaging.js";
import { createOptionsRuntime } from "../src/options/native-config.js";

class VaultPort implements NativeMessagingPort {
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

  postMessage(message: unknown): void {
    this.messages.push(message);
    const requestId =
      typeof message === "object" &&
      message !== null &&
      "requestId" in message &&
      typeof message.requestId === "string"
        ? message.requestId
        : "unknown";
    const response =
      typeof message === "object" &&
      message !== null &&
      "action" in message &&
      message.action === "hello"
        ? {
            protocolVersion: 1,
            helperVersion: "0.1.0-beta.7",
            capabilities: ["clip.article", "direct-file", "vault.config"]
          }
        : {
            protocolVersion: 1,
            requestId,
            helperVersion: "0.1.0-beta.7",
            ok: true,
            result: { vaultRoot: "C:\\Vault" }
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

it("Options Page 连续读取和保存 Vault 配置时复用同一个连接", async () => {
  const port = new VaultPort();
  const connectNative = vi.fn(() => port);
  const runtime = createOptionsRuntime(connectNative);

  await expect(runtime.getVaultRoot()).resolves.toBe("C:\\Vault");
  await expect(runtime.setVaultRoot("C:\\Vault")).resolves.toBe("C:\\Vault");

  expect(connectNative).toHaveBeenCalledTimes(1);
  expect(
    port.messages.filter(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "action" in message &&
        message.action === "hello"
    )
  ).toHaveLength(1);
});

import {
  adaptChromeNativePort,
  NativeMessagingClientError,
  NATIVE_HOST_NAME,
  requestVaultConfig,
  type ConnectNative
} from "../background/native-messaging.js";
import {
  createVaultConfigGetRequest,
  createVaultConfigSetRequest
} from "../background/messages.js";
import {
  getDefaultRelativeFolder,
  setDefaultRelativeFolder
} from "../settings/storage.js";
import type { OptionsRuntime } from "./App.js";

const EXTENSION_VERSION = "0.1.0-beta.2";

export class OptionsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OptionsError";
    this.code = code;
  }
}

function defaultConnectNative(hostName: string) {
  return adaptChromeNativePort(chrome.runtime.connectNative(hostName));
}

function nativeErrorMessage(error: NativeMessagingClientError): string {
  switch (error.code) {
    case "INCOMPATIBLE_HELPER":
      return "当前 Helper 不支持设置，请运行 configure-vault.ps1 或升级 Helper";
    case "TIMEOUT":
      return "Helper 响应超时，请确认 Helper 正在运行后重试";
    case "CONNECT_FAILED":
      return "无法连接 Capture Helper，请确认 Helper 已安装";
    case "INVALID_RESPONSE":
      return "Helper 返回了无效响应，请升级 Helper 后重试";
  }
}

function toOptionsError(error: unknown, fallbackMessage: string): OptionsError {
  if (error instanceof OptionsError) {
    return error;
  }
  if (error instanceof NativeMessagingClientError) {
    return new OptionsError(error.code, nativeErrorMessage(error));
  }
  return new OptionsError("OPTIONS_REQUEST_FAILED", fallbackMessage);
}

function throwConfigError(
  response: Extract<Awaited<ReturnType<typeof requestVaultConfig>>, { ok: false }>,
  actionLabel: string
): never {
  throw new OptionsError(
    response.error.code,
    `${actionLabel}失败：${response.error.message}`
  );
}

export function createOptionsRuntime(
  connectNative: ConnectNative = defaultConnectNative
): OptionsRuntime {
  return {
    async getVaultRoot(): Promise<string | null> {
      try {
        const request = createVaultConfigGetRequest(
          EXTENSION_VERSION,
          crypto.randomUUID()
        );
        const response = await requestVaultConfig(
          request,
          connectNative,
          NATIVE_HOST_NAME
        );
        if (!response.ok) {
          if (response.error.code === "VAULT_NOT_CONFIGURED") {
            return null;
          }
          throwConfigError(response, "读取 Vault root");
        }
        return response.result.vaultRoot;
      } catch (error) {
        throw toOptionsError(error, "无法读取 Vault root，请检查 Helper 后重试");
      }
    },

    async setVaultRoot(value: string): Promise<string> {
      try {
        const request = createVaultConfigSetRequest(
          value,
          EXTENSION_VERSION,
          crypto.randomUUID()
        );
        const response = await requestVaultConfig(
          request,
          connectNative,
          NATIVE_HOST_NAME
        );
        if (!response.ok) {
          throwConfigError(response, "保存 Vault root");
        }
        return response.result.vaultRoot;
      } catch (error) {
        throw toOptionsError(error, "无法保存 Vault root，请检查路径后重试");
      }
    },

    getDefaultRelativeFolder,

    async setDefaultRelativeFolder(value: string): Promise<void> {
      try {
        await setDefaultRelativeFolder(value);
      } catch {
        throw new OptionsError(
          "INVALID_DEFAULT_FOLDER",
          "默认目录无效，请填写安全的相对目录"
        );
      }
    }
  };
}

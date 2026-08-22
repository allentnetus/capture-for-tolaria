import {
  PROTOCOL_VERSION,
  validateHelloResponse,
  validateResponse,
  type ClipRequest,
  type ClipResponse
} from "@capture-for-tolaria/protocol";

export const NATIVE_HOST_NAME = "com.capture_for_tolaria.helper" as const;
export const NATIVE_MESSAGE_TIMEOUT_MS = 10_000;

interface Listener<T> {
  addListener(listener: (value: T) => void): void;
  removeListener?(listener: (value: T) => void): void;
}

export interface NativeMessagingPort {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: Listener<unknown>;
  onDisconnect: Listener<void>;
}

export type ConnectNative = (hostName: string) => NativeMessagingPort;

export function adaptChromeNativePort(
  port: chrome.runtime.Port
): NativeMessagingPort {
  const messageListeners = new Map<
    (value: unknown) => void,
    (message: unknown) => void
  >();
  const disconnectListeners = new Map<() => void, () => void>();
  return {
    postMessage: (message) => port.postMessage(message),
    disconnect: () => port.disconnect(),
    onMessage: {
      addListener: (listener) => {
        const wrapped = (message: unknown): void => listener(message);
        messageListeners.set(listener, wrapped);
        port.onMessage.addListener(wrapped);
      },
      removeListener: (listener) => {
        const wrapped = messageListeners.get(listener);
        if (wrapped) {
          port.onMessage.removeListener(wrapped);
          messageListeners.delete(listener);
        }
      }
    },
    onDisconnect: {
      addListener: (listener) => {
        const wrapped = (): void => listener(undefined);
        disconnectListeners.set(listener, wrapped);
        port.onDisconnect.addListener(wrapped);
      },
      removeListener: (listener) => {
        const wrapped = disconnectListeners.get(listener);
        if (wrapped) {
          port.onDisconnect.removeListener(wrapped);
          disconnectListeners.delete(listener);
        }
      }
    }
  };
}

export class NativeMessagingClientError extends Error {
  readonly code:
    | "CONNECT_FAILED"
    | "TIMEOUT"
    | "INCOMPATIBLE_HELPER"
    | "INVALID_RESPONSE";

  constructor(
    code: NativeMessagingClientError["code"],
    message: string
  ) {
    super(message);
    this.name = "NativeMessagingClientError";
    this.code = code;
  }
}

function waitForMessage(
  port: NativeMessagingPort,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer: { value?: ReturnType<typeof setTimeout> } = {};
    const onMessage = (message: unknown): void => {
      clearTimeout(timer.value);
      port.onMessage.removeListener?.(onMessage);
      port.onDisconnect.removeListener?.(onDisconnect);
      resolve(message);
    };
    const onDisconnect = (): void => {
      clearTimeout(timer.value);
      port.onMessage.removeListener?.(onMessage);
      reject(new NativeMessagingClientError("CONNECT_FAILED", "Helper 已断开连接"));
    };

    timer.value = setTimeout(() => {
      port.onMessage.removeListener?.(onMessage);
      port.onDisconnect.removeListener?.(onDisconnect);
      reject(new NativeMessagingClientError("TIMEOUT", "Helper 响应超时"));
    }, timeoutMs);
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
  });
}

export async function captureViaNativeMessaging(
  request: ClipRequest,
  connectNative: ConnectNative,
  hostName = NATIVE_HOST_NAME
): Promise<ClipResponse> {
  let port: NativeMessagingPort;
  try {
    port = connectNative(hostName);
  } catch {
    throw new NativeMessagingClientError("CONNECT_FAILED", "无法连接 Capture Helper");
  }

  try {
    const helloPromise = waitForMessage(port, NATIVE_MESSAGE_TIMEOUT_MS);
    port.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: `hello-${request.requestId}`,
      extensionVersion: request.extensionVersion,
      action: "hello"
    });
    const hello = validateHelloResponse(await helloPromise);
    if (
      hello.protocolVersion !== PROTOCOL_VERSION ||
      !hello.capabilities.includes("clip.article")
    ) {
      throw new NativeMessagingClientError(
        "INCOMPATIBLE_HELPER",
        "Helper 不支持当前协议或 Article Capture"
      );
    }

    const responsePromise = waitForMessage(port, NATIVE_MESSAGE_TIMEOUT_MS);
    port.postMessage(request);
    const response = validateResponse(await responsePromise);
    if (response.requestId !== request.requestId) {
      throw new NativeMessagingClientError(
        "INVALID_RESPONSE",
        "Helper 响应 requestId 不匹配"
      );
    }
    return response;
  } catch (error) {
    if (error instanceof NativeMessagingClientError) {
      throw error;
    }
    throw new NativeMessagingClientError("INVALID_RESPONSE", "Helper 响应格式无效");
  } finally {
    port.disconnect();
  }
}

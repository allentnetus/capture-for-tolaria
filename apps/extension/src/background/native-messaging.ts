import {
  PROTOCOL_VERSION,
  validateHelloResponse,
  validateResponse,
  validateVaultConfigResponse,
  type ClipRequest,
  type ClipResponse,
  type VaultConfigRequest,
  type VaultConfigResponse
} from "@capture-for-tolaria/protocol";

export const NATIVE_HOST_NAME = "com.capture_for_tolaria.helper" as const;
export const NATIVE_MESSAGE_TIMEOUT_MS = 10_000;
export const NATIVE_CAPTURE_TIMEOUT_MS = 60_000;
export const NATIVE_IDLE_TIMEOUT_MS = 30_000;

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

export interface NativeMessagingClient {
  capture(request: ClipRequest): Promise<ClipResponse>;
  requestVaultConfig(request: VaultConfigRequest): Promise<VaultConfigResponse>;
  close(): void;
}

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

async function requestViaNativeMessaging<TResponse extends { requestId: string }>(
  request: ClipRequest | VaultConfigRequest,
  connectNative: ConnectNative,
  requiredCapability: string,
  responseTimeoutMs: number,
  validate: (value: unknown) => TResponse,
  incompatibleMessage: string,
  hostName: string
): Promise<TResponse> {
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
      !hello.capabilities.includes(requiredCapability)
    ) {
      throw new NativeMessagingClientError(
        "INCOMPATIBLE_HELPER",
        incompatibleMessage
      );
    }

    const responsePromise = waitForMessage(port, responseTimeoutMs);
    port.postMessage(request);
    const response = validate(await responsePromise);
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

interface NativeRequestOptions<TResponse extends { requestId: string }> {
  request: ClipRequest | VaultConfigRequest;
  requiredCapability: string;
  responseTimeoutMs: number;
  validate: (value: unknown) => TResponse;
  incompatibleMessage: string;
}

class NativeMessagingClientImpl implements NativeMessagingClient {
  private port: NativeMessagingPort | null = null;
  private capabilities: string[] | null = null;
  private disconnectListener: (() => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly connectNative: ConnectNative,
    private readonly hostName: string
  ) {}

  capture(request: ClipRequest): Promise<ClipResponse> {
    return this.enqueue(() =>
      this.requestNow({
        request,
        requiredCapability: "clip.article",
        responseTimeoutMs: NATIVE_CAPTURE_TIMEOUT_MS,
        validate: validateResponse,
        incompatibleMessage: "Helper 不支持当前协议或 Article Capture"
      })
    );
  }

  requestVaultConfig(request: VaultConfigRequest): Promise<VaultConfigResponse> {
    return this.enqueue(() =>
      this.requestNow({
        request,
        requiredCapability: "vault.config",
        responseTimeoutMs: NATIVE_MESSAGE_TIMEOUT_MS,
        validate: validateVaultConfigResponse,
        incompatibleMessage: "Helper 不支持当前协议或 Vault 配置"
      })
    );
  }

  close(): void {
    this.clearIdleTimer();
    const port = this.port;
    if (!port) {
      return;
    }
    this.clearConnection(port);
    port.disconnect();
  }

  private enqueue<TResponse>(operation: () => Promise<TResponse>): Promise<TResponse> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async requestNow<TResponse extends { requestId: string }>(
    options: NativeRequestOptions<TResponse>
  ): Promise<TResponse> {
    const port = await this.ensureConnection(options);
    try {
      const responsePromise = waitForMessage(port, options.responseTimeoutMs);
      port.postMessage(options.request);
      const response = options.validate(await responsePromise);
      if (response.requestId !== options.request.requestId) {
        throw new NativeMessagingClientError(
          "INVALID_RESPONSE",
          "Helper 响应 requestId 不匹配"
        );
      }
      this.scheduleIdleDisconnect(port);
      return response;
    } catch (error) {
      this.disconnectIfCurrent(port);
      if (error instanceof NativeMessagingClientError) {
        throw error;
      }
      throw new NativeMessagingClientError("INVALID_RESPONSE", "Helper 响应格式无效");
    }
  }

  private async ensureConnection<TResponse extends { requestId: string }>(
    options: NativeRequestOptions<TResponse>
  ): Promise<NativeMessagingPort> {
    if (this.port && this.capabilities) {
      if (!this.capabilities.includes(options.requiredCapability)) {
        throw new NativeMessagingClientError(
          "INCOMPATIBLE_HELPER",
          options.incompatibleMessage
        );
      }
      this.clearIdleTimer();
      return this.port;
    }

    let port: NativeMessagingPort;
    try {
      port = this.connectNative(this.hostName);
    } catch {
      throw new NativeMessagingClientError("CONNECT_FAILED", "无法连接 Capture Helper");
    }

    const onDisconnect = (): void => {
      this.clearConnection(port);
    };
    this.port = port;
    this.disconnectListener = onDisconnect;
    port.onDisconnect.addListener(onDisconnect);

    try {
      const helloPromise = waitForMessage(port, NATIVE_MESSAGE_TIMEOUT_MS);
      port.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        requestId: `hello-${options.request.requestId}`,
        extensionVersion: options.request.extensionVersion,
        action: "hello"
      });
      const hello = validateHelloResponse(await helloPromise);
      if (
        hello.protocolVersion !== PROTOCOL_VERSION ||
        !hello.capabilities.includes(options.requiredCapability)
      ) {
        throw new NativeMessagingClientError(
          "INCOMPATIBLE_HELPER",
          options.incompatibleMessage
        );
      }
      this.capabilities = hello.capabilities;
      return port;
    } catch (error) {
      this.disconnectIfCurrent(port);
      if (error instanceof NativeMessagingClientError) {
        throw error;
      }
      throw new NativeMessagingClientError("INVALID_RESPONSE", "Helper 响应格式无效");
    }
  }

  private clearConnection(port: NativeMessagingPort): void {
    if (this.port !== port) {
      return;
    }
    const disconnectListener = this.disconnectListener;
    if (disconnectListener) {
      port.onDisconnect.removeListener?.(disconnectListener);
    }
    this.clearIdleTimer();
    this.port = null;
    this.capabilities = null;
    this.disconnectListener = null;
  }

  private scheduleIdleDisconnect(port: NativeMessagingPort): void {
    if (this.port !== port || !this.capabilities) {
      return;
    }
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.port !== port) {
        return;
      }
      this.clearConnection(port);
      port.disconnect();
    }, NATIVE_IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer === null) {
      return;
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private disconnectIfCurrent(port: NativeMessagingPort): void {
    if (this.port !== port) {
      return;
    }
    this.clearConnection(port);
    port.disconnect();
  }
}

export function createNativeMessagingClient(
  connectNative: ConnectNative,
  hostName = NATIVE_HOST_NAME
): NativeMessagingClient {
  return new NativeMessagingClientImpl(connectNative, hostName);
}

export async function captureViaNativeMessaging(
  request: ClipRequest,
  connectNative: ConnectNative,
  hostName = NATIVE_HOST_NAME
): Promise<ClipResponse> {
  return requestViaNativeMessaging(
    request,
    connectNative,
    "clip.article",
    NATIVE_CAPTURE_TIMEOUT_MS,
    validateResponse,
    "Helper 不支持当前协议或 Article Capture",
    hostName
  );
}

export async function requestVaultConfig(
  request: VaultConfigRequest,
  connectNative: ConnectNative,
  hostName = NATIVE_HOST_NAME
): Promise<VaultConfigResponse> {
  return requestViaNativeMessaging(
    request,
    connectNative,
    "vault.config",
    NATIVE_MESSAGE_TIMEOUT_MS,
    validateVaultConfigResponse,
    "Helper 不支持当前协议或 Vault 配置",
    hostName
  );
}

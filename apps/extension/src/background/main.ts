import {
  adaptChromeNativePort,
  captureViaNativeMessaging,
  type ConnectNative
} from "./native-messaging.js";
import {
  createArticleRequest,
  isHttpPageUrl,
  validateCaptureArticleMessage,
  validateContentPayload,
  type CaptureResponse,
  type ContentMessage
} from "./messages.js";

export const EXTENSION_VERSION = "0.1.0-alpha.1";

export interface ActiveTab {
  id: number;
  url: string;
}

export interface CaptureDependencies {
  getActiveTab(): Promise<ActiveTab | null>;
  executeContentScript(tabId: number): Promise<void>;
  sendContentMessage(tabId: number, message: ContentMessage): Promise<unknown>;
  connectNative: ConnectNative;
}

function errorResponse(code: string, message: string): CaptureResponse {
  return { ok: false, code, message };
}

export async function handleCaptureMessage(
  message: unknown,
  senderId: string | undefined,
  expectedExtensionId: string,
  dependencies: CaptureDependencies
): Promise<CaptureResponse> {
  try {
    validateCaptureArticleMessage(message);
    if (senderId !== expectedExtensionId) {
      return errorResponse("UNTRUSTED_SENDER", "只允许由当前 Extension UI 触发剪藏");
    }

    const tab = await dependencies.getActiveTab();
    if (!tab || !isHttpPageUrl(tab.url)) {
      return errorResponse("UNSUPPORTED_PAGE", "当前页面不是可剪藏的 HTTP/HTTPS 页面");
    }

    await dependencies.executeContentScript(tab.id);
    const contentResponse = await dependencies.sendContentMessage(tab.id, {
      type: "extract.article",
      sourceUrl: tab.url,
      clippedAt: new Date().toISOString()
    });
    if (
      typeof contentResponse !== "object" ||
      contentResponse === null ||
      !("ok" in contentResponse) ||
      contentResponse.ok !== true ||
      !("payload" in contentResponse)
    ) {
      const messageValue =
        typeof contentResponse === "object" &&
        contentResponse !== null &&
        "message" in contentResponse &&
        typeof contentResponse.message === "string"
          ? contentResponse.message
          : "无法可靠提取当前文章";
      return errorResponse("EXTRACTION_FAILED", messageValue);
    }

    const payload = validateContentPayload(contentResponse.payload);
    const request = createArticleRequest(
      payload,
      EXTENSION_VERSION,
      crypto.randomUUID()
    );
    const response = await captureViaNativeMessaging(
      request,
      dependencies.connectNative
    );
    const captureResponse: CaptureResponse = response.ok
      ? { ok: true, relativePath: response.result.relativePath }
      : {
          ok: false,
          code: response.error.code,
          message: response.error.message
        };
    try {
      await dependencies.sendContentMessage(
        tab.id,
        captureResponse.ok
          ? {
              type: "capture.result",
              status: "saved",
              relativePath: captureResponse.relativePath
            }
          : {
              type: "capture.result",
              status: "error",
              code: captureResponse.code,
              message: captureResponse.message
            }
      );
    } catch {
      // A missing content listener must not turn a successful file save into an error.
    }
    return captureResponse;
  } catch (error) {
    return errorResponse(
      "CAPTURE_FAILED",
      error instanceof Error ? error.message : "无法完成 Article Capture"
    );
  }
}

function runtimeDependencies(): CaptureDependencies {
  return {
    getActiveTab: async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.id === undefined || !tab.url) {
        return null;
      }
      return { id: tab.id, url: tab.url };
    },
    executeContentScript: async (tabId) => {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    },
    sendContentMessage: async (tabId, message) =>
      chrome.tabs.sendMessage(tabId, message),
    connectNative: (hostName) =>
      adaptChromeNativePort(chrome.runtime.connectNative(hostName))
  };
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleCaptureMessage(
      message,
      sender.id,
      chrome.runtime.id,
      runtimeDependencies()
    ).then(sendResponse);
    return true;
  });
}

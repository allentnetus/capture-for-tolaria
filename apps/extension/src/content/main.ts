import {
  captureArticleFromDocument,
  type CapturedArticlePayload
} from "./capture-article.js";
import { showCaptureToast } from "./toast.js";
import type { ContentMessage } from "../background/messages.js";

interface ContentSuccess {
  ok: true;
  payload: CapturedArticlePayload;
}

interface ContentFailure {
  ok: false;
  code: "EXTRACTION_FAILED";
  message: string;
}

const CONTENT_LISTENER_REGISTRY_KEY =
  "__captureForTolariaContentListenerRegistry";
type ContentGlobal = typeof globalThis & {
  [CONTENT_LISTENER_REGISTRY_KEY]?: WeakSet<object>;
};

function getInstalledMessageEvents(): WeakSet<object> {
  const contentGlobal = globalThis as ContentGlobal;
  contentGlobal[CONTENT_LISTENER_REGISTRY_KEY] ??= new WeakSet<object>();
  return contentGlobal[CONTENT_LISTENER_REGISTRY_KEY];
}

const installedMessageEvents = getInstalledMessageEvents();

export function installContentCaptureListener(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return;
  }

  const messageEvent = chrome.runtime.onMessage;
  if (installedMessageEvents.has(messageEvent)) {
    return;
  }
  installedMessageEvents.add(messageEvent);

  messageEvent.addListener(
    (message: unknown, _sender, sendResponse) => {
      if (
        typeof message !== "object" ||
        message === null ||
        !("type" in message)
      ) {
        return false;
      }

      const request = message as ContentMessage;
      if (request.type === "capture.result") {
        if (request.status === "error") {
          showCaptureToast(document, request);
        }
        return false;
      }
      if (request.type !== "extract.article") {
        return false;
      }
      try {
        const payload = captureArticleFromDocument(
          document,
          request.sourceUrl,
          request.clippedAt
        );
        const response: ContentSuccess = { ok: true, payload };
        sendResponse(response);
      } catch (error) {
        const response: ContentFailure = {
          ok: false,
          code: "EXTRACTION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "无法可靠提取当前文章"
        };
        sendResponse(response);
      }
      return true;
    }
  );
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  installContentCaptureListener();
}

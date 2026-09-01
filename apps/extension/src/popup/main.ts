import {
  validateCaptureResponse,
  type CaptureResponse
} from "../background/messages.js";
import { getDefaultRelativeFolder } from "../settings/storage.js";
import { mountPopup, type PopupRuntime } from "./App.js";

function runtime(): PopupRuntime {
  return {
    getActiveTab: async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) {
        return null;
      }
      const result: { title?: string; url?: string } = {};
      if (tab.title !== undefined) {
        result.title = tab.title;
      }
      if (tab.url !== undefined) {
        result.url = tab.url;
      }
      return result;
    },
    captureArticle: async (): Promise<CaptureResponse> => {
      const response: unknown = await chrome.runtime.sendMessage({
        type: "capture.article"
      });
      return validateCaptureResponse(response);
    },
    getDefaultRelativeFolder,
    openSettings: async () => {
      if (typeof chrome.runtime?.openOptionsPage !== "function") {
        throw new Error("Settings page is unavailable");
      }
      await chrome.runtime.openOptionsPage();
    }
  };
}

if (typeof chrome !== "undefined" && document.readyState !== "loading") {
  const container = document.querySelector<HTMLElement>("#app");
  if (container) {
    mountPopup(container, runtime());
  }
} else if (typeof chrome !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector<HTMLElement>("#app");
    if (container) {
      mountPopup(container, runtime());
    }
  });
}

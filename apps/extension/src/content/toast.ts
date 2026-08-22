import type { ContentCaptureErrorMessage } from "../background/messages.js";

export const CAPTURE_TOAST_ID = "capture-for-tolaria-toast";
export const CAPTURE_TOAST_DURATION_MS = 4_000;

function extensionAssetUrl(path: string): string | null {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return null;
}

export function showCaptureToast(
  ownerDocument: Document,
  message: ContentCaptureErrorMessage
): void {
  ownerDocument.getElementById(CAPTURE_TOAST_ID)?.remove();
  if (!ownerDocument.documentElement) {
    return;
  }

  const host = ownerDocument.createElement("div");
  host.id = CAPTURE_TOAST_ID;
  host.setAttribute("role", "status");
  Object.assign(host.style, {
    all: "initial",
    position: "fixed",
    inset: "auto 24px 24px auto",
    zIndex: "2147483647"
  });
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-atomic", "true");

  const shadow = host.attachShadow({ mode: "open" });
  const style = ownerDocument.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: min(420px, calc(100vw - 48px));
      max-width: 420px;
      padding: 12px 14px;
      border: 1px solid rgba(167, 155, 244, .46);
      border-radius: 16px;
      color: #f8fafc;
      background: #1e293b;
      box-shadow: 0 12px 28px rgba(15, 23, 42, .28);
      font: 14px/1.4 "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
      animation: toast-in .22s ease-out both;
    }
    .toast[data-state="error"] {
      border-color: rgba(255, 210, 216, .46);
      background: #7f2f3a;
    }
    .toast-icon {
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border: 1px solid rgba(248, 250, 252, .36);
      border-radius: 7px;
    }
    .toast-copy {
      display: grid;
      min-width: 0;
      gap: 2px;
    }
    .toast-title {
      color: #f8fafc;
      font-size: 13px;
      font-weight: 750;
      line-height: 1.3;
    }
    .toast-detail {
      color: rgba(248, 250, 252, .78);
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
    }
  `;

  const toast = ownerDocument.createElement("div");
  toast.className = "toast";
  toast.dataset.state = "error";

  const icon = ownerDocument.createElement("img");
  icon.className = "toast-icon";
  icon.alt = "";
  icon.width = 24;
  icon.height = 24;
  icon.setAttribute("aria-hidden", "true");
  icon.dataset.asset = "icons/icon16.png";
  const iconUrl = extensionAssetUrl("icons/icon16.png");
  if (iconUrl) {
    icon.src = iconUrl;
  }

  const copy = ownerDocument.createElement("div");
  copy.className = "toast-copy";
  const title = ownerDocument.createElement("strong");
  title.className = "toast-title";
  title.textContent = "Capture failed";
  const detail = ownerDocument.createElement("span");
  detail.className = "toast-detail";
  detail.textContent = `${message.code} — ${message.message}`;
  copy.append(title, detail);
  toast.append(icon, copy);
  shadow.append(style, toast);
  ownerDocument.documentElement.append(host);

  const timerWindow = ownerDocument.defaultView;
  if (timerWindow) {
    timerWindow.setTimeout(() => host.remove(), CAPTURE_TOAST_DURATION_MS);
  }
}

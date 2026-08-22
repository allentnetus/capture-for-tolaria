import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { installContentCaptureListener } from "../src/content/main.js";
import { CAPTURE_TOAST_ID } from "../src/content/toast.js";

const originalChrome = globalThis.chrome;
const originalDocument = globalThis.document;

afterEach(() => {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument
  });
});

it("does not show a page toast after a saved result but keeps error feedback", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.com/article"
  });
  const addListener = vi.fn();
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: { runtime: { onMessage: { addListener } } }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: dom.window.document
  });

  try {
    installContentCaptureListener();
    const listener = addListener.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Content listener was not registered");
    }

    listener({
      type: "capture.result",
      status: "saved",
      relativePath: "Inbox/Web/Article.md"
    }, {}, vi.fn());
    expect(dom.window.document.getElementById(CAPTURE_TOAST_ID)).toBeNull();

    listener({
      type: "capture.result",
      status: "error",
      code: "TARGET_EXISTS",
      message: "目标文件已存在"
    }, {}, vi.fn());
    expect(dom.window.document.getElementById(CAPTURE_TOAST_ID)).not.toBeNull();
  } finally {
    dom.window.close();
  }
});

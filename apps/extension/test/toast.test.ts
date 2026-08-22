import { expect, it } from "vitest";
import { afterEach } from "vitest";
import { JSDOM } from "jsdom";
import { showCaptureToast } from "../src/content/toast.js";

const originalChrome = globalThis.chrome;

afterEach(() => {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: originalChrome
  });
});

it("显示错误提示并替换旧提示", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.com/article"
  });
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    }
  });
  try {
    showCaptureToast(dom.window.document, {
      type: "capture.result",
      status: "error",
      code: "TARGET_EXISTS",
      message: "目标文件已存在"
    });
    expect(dom.window.document.querySelectorAll("#capture-for-tolaria-toast")).toHaveLength(1);
    const errorHost = dom.window.document.getElementById("capture-for-tolaria-toast");
    expect(errorHost?.getAttribute("aria-live")).toBe("polite");
    expect(errorHost?.getAttribute("aria-atomic")).toBe("true");
    expect(errorHost?.shadowRoot?.querySelector(".toast")?.getAttribute("data-state")).toBe("error");
    expect(errorHost?.shadowRoot?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(errorHost?.shadowRoot?.querySelector("img")?.getAttribute("data-asset")).toBe(
      "icons/icon16.png"
    );
    expect(errorHost?.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe(
      "chrome-extension://test/icons/icon16.png"
    );
    expect(errorHost?.shadowRoot?.querySelector(".toast-title")?.textContent).toBe(
      "Capture failed"
    );
    expect(errorHost?.shadowRoot?.textContent).toContain("TARGET_EXISTS");
  } finally {
    dom.window.close();
  }
});

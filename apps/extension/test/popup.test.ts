import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { mountPopup, type PopupRuntime } from "../src/popup/App.js";

const originalDocument = globalThis.document;

afterEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument
  });
});

function mount(runtime: PopupRuntime) {
  const dom = new JSDOM("<!doctype html><main id=app></main>");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: dom.window.document
  });
  const container = dom.window.document.querySelector<HTMLElement>("#app");
  if (!container) {
    throw new Error("Popup container missing");
  }
  mountPopup(container, runtime);
  return { dom, container };
}

it("renders the branded capture surface with accessible status semantics", async () => {
  const { container, dom } = mount({
    getActiveTab: async () => ({ title: "Example article" }),
    captureArticle: vi.fn()
  });

  try {
    const icon = container.querySelector<HTMLImageElement>(".brand-icon");
    const status = container.querySelector<HTMLElement>('[role="status"]');

    expect(icon?.getAttribute("src")).toBe("icons/icon32.png");
    expect(icon?.getAttribute("alt")).toBe("");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-role=page-title]")?.textContent).toBe(
      "Loading page…"
    );
    expect(container.textContent).toContain("Capture mode");
    expect(container.textContent).toContain("Folder");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.hidden).toBe(true);

    await Promise.resolve();
    expect(container.querySelector("[data-role=page-title]")?.textContent).toBe(
      "Example article"
    );
  } finally {
    dom.window.close();
  }
});

it("显示自定义默认目录并提供 Settings 入口", async () => {
  const openSettings = vi.fn();
  const { container, dom } = mount({
    getActiveTab: async () => ({ title: "Example article" }),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Reading"),
    openSettings,
    captureArticle: vi.fn()
  });

  try {
    await Promise.resolve();
    expect(container.textContent).toContain("Inbox/Reading");
    const settings = container.querySelector<HTMLButtonElement>(
      "[data-role=settings]"
    );
    if (!settings) throw new Error("Settings button missing");
    settings.click();
    expect(openSettings).toHaveBeenCalledTimes(1);
  } finally {
    dom.window.close();
  }
});

it("默认目录读取失败时回退 Inbox/Web", async () => {
  const getDefaultRelativeFolder = vi.fn().mockRejectedValue(
    new Error("storage unavailable")
  );
  const { container, dom } = mount({
    getActiveTab: async () => null,
    getDefaultRelativeFolder,
    captureArticle: vi.fn()
  });

  try {
    await Promise.resolve();
    const folderRow = [...container.querySelectorAll<HTMLElement>(".meta-row")]
      .find((row) => row.textContent?.includes("Folder"));
    expect(folderRow?.textContent).toContain("Inbox/Web");
  } finally {
    dom.window.close();
  }
});

it("Settings 打开失败时显示稳定错误且不禁用剪藏", async () => {
  const captureArticle = vi.fn().mockResolvedValue({
    ok: true,
    relativePath: "Inbox/Web/Example article.md"
  });
  const { container, dom } = mount({
    getActiveTab: async () => null,
    openSettings: vi.fn().mockRejectedValue(new Error("internal details")),
    captureArticle
  });

  try {
    const settings = container.querySelector<HTMLButtonElement>(
      "[data-role=settings]"
    );
    const capture = container.querySelector<HTMLButtonElement>(
      ".primary-action"
    );
    const status = container.querySelector<HTMLElement>('[role="status"]');
    if (!settings || !capture || !status) {
      throw new Error("Popup controls missing");
    }
    settings.click();
    await Promise.resolve();
    expect(status.dataset.state).toBe("error");
    expect(status.textContent).toContain("Unable to open Settings");
    expect(status.textContent).not.toContain("internal details");
    expect(capture.disabled).toBe(false);

    capture.click();
    await Promise.resolve();
    expect(captureArticle).toHaveBeenCalledTimes(1);
  } finally {
    dom.window.close();
  }
});

it("shows loading and success states without losing the saved path", async () => {
  const captureArticle = vi.fn().mockResolvedValue({
    ok: true,
    relativePath: "Inbox/Web/Example article.md",
    summary: { requested: 3, localized: 2, fallback: 1 },
    warnings: ["IMAGE_DOWNLOAD_FAILED"]
  });
  const { container, dom } = mount({
    getActiveTab: async () => null,
    captureArticle
  });

  try {
    const button = container.querySelector<HTMLButtonElement>("button");
    const status = container.querySelector<HTMLElement>('[role="status"]');
    if (!button || !status) {
      throw new Error("Popup controls missing");
    }

    button.click();
    expect(button.disabled).toBe(true);
    expect(status.dataset.state).toBe("loading");
    expect(status.textContent).toContain("Saving");

    await Promise.resolve();
    expect(captureArticle).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(status.hidden).toBe(false);
    expect(status.dataset.state).toBe("success");
    expect(status.textContent).toContain("Saved to Tolaria");
    expect(status.textContent).toContain("Inbox/Web/Example article.md");
    expect(status.textContent).toContain("Images: 2 localized, 1 fallback");
  } finally {
    dom.window.close();
  }
});

it("shows an actionable error state when capture fails", async () => {
  const { container, dom } = mount({
    getActiveTab: async () => null,
    captureArticle: vi.fn().mockResolvedValue({
      ok: false,
      code: "TARGET_EXISTS",
      message: "目标文件已存在"
    })
  });

  try {
    const button = container.querySelector<HTMLButtonElement>("button");
    const status = container.querySelector<HTMLElement>('[role="status"]');
    if (!button || !status) {
      throw new Error("Popup controls missing");
    }

    button.click();
    await Promise.resolve();

    expect(button.disabled).toBe(false);
    expect(status.hidden).toBe(false);
    expect(status.dataset.state).toBe("error");
    expect(status.textContent).toContain("Capture failed");
    expect(status.textContent).toContain("TARGET_EXISTS");
    expect(status.textContent).toContain("目标文件已存在");
  } finally {
    dom.window.close();
  }
});

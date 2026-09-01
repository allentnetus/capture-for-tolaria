import { JSDOM } from "jsdom";
import { expect, it, vi } from "vitest";
import { mountOptions, type OptionsRuntime } from "../src/options/App.js";

function mountOptionsForTest(runtime: OptionsRuntime) {
  const dom = new JSDOM("<!doctype html><main id=app></main>");
  const container = dom.window.document.querySelector<HTMLElement>("#app");
  if (!container) throw new Error("options container missing");
  mountOptions(container, runtime);
  return { container, dom };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

it("加载 Vault root 和默认目录", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue("E:\\Tolaria\\infra"),
    setVaultRoot: vi.fn(),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Reading"),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    expect(container.querySelector<HTMLInputElement>("#vault-root")?.value).toBe(
      "E:\\Tolaria\\infra"
    );
    expect(container.querySelector<HTMLInputElement>("#default-folder")?.value).toBe(
      "Inbox/Reading"
    );
  } finally {
    dom.window.close();
  }
});

it("Vault 未配置时保留可修复状态并显示默认目录", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue(null),
    setVaultRoot: vi.fn(),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    expect(container.querySelector<HTMLInputElement>("#vault-root")?.value).toBe("");
    expect(container.textContent).toContain("尚未配置");
    expect(container.querySelector<HTMLInputElement>("#default-folder")?.value).toBe(
      "Inbox/Web"
    );
  } finally {
    dom.window.close();
  }
});

it("Helper 和默认目录同时读取失败时保留 Helper 错误", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockRejectedValue(new Error("native unavailable")),
    setVaultRoot: vi.fn(),
    getDefaultRelativeFolder: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    expect(container.textContent).toContain("无法读取 Vault 配置");
    expect(container.textContent).not.toContain("默认目录已回退");
  } finally {
    dom.window.close();
  }
});

it("拒绝越界默认目录而不调用保存函数", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue(null),
    setVaultRoot: vi.fn(),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    const folder = container.querySelector<HTMLInputElement>("#default-folder");
    const button = container.querySelector<HTMLButtonElement>("#save-settings");
    if (!folder || !button) throw new Error("settings controls missing");
    const root = container.querySelector<HTMLInputElement>("#vault-root");
    if (!root) throw new Error("Vault root control missing");
    root.value = "C:\\Vault";
    folder.value = "../outside";
    button.click();
    await flushAsyncWork();
    expect(runtime.setVaultRoot).not.toHaveBeenCalled();
    expect(runtime.setDefaultRelativeFolder).not.toHaveBeenCalled();
    expect(container.textContent).toContain("安全的相对目录");
  } finally {
    dom.window.close();
  }
});

it("拒绝空 Vault root 并保留可修复提示", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue(null),
    setVaultRoot: vi.fn(),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    const root = container.querySelector<HTMLInputElement>("#vault-root");
    const button = container.querySelector<HTMLButtonElement>("#save-settings");
    if (!root || !button) throw new Error("settings controls missing");
    root.value = "   ";
    button.click();
    await flushAsyncWork();
    expect(runtime.setVaultRoot).not.toHaveBeenCalled();
    expect(runtime.setDefaultRelativeFolder).not.toHaveBeenCalled();
    expect(container.textContent).toContain("请输入 Vault root 路径");
  } finally {
    dom.window.close();
  }
});

it("按 Vault root 再默认目录的顺序保存并显示 canonical root", async () => {
  const order: string[] = [];
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue("C:\\Old\\Vault"),
    setVaultRoot: vi.fn(async (value: string) => {
      order.push(`root:${value}`);
      return "C:\\Users\\mrvic\\Vault";
    }),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn(async (value: string) => {
      order.push(`folder:${value}`);
    })
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    const root = container.querySelector<HTMLInputElement>("#vault-root");
    const folder = container.querySelector<HTMLInputElement>("#default-folder");
    const button = container.querySelector<HTMLButtonElement>("#save-settings");
    if (!root || !folder || !button) throw new Error("settings controls missing");
    root.value = "  D:\\Tolaria\\Vault  ";
    folder.value = "  Inbox/Reading  ";
    button.click();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await flushAsyncWork();
    expect(order).toEqual(["root:D:\\Tolaria\\Vault", "folder:Inbox/Reading"]);
    expect(runtime.setVaultRoot).toHaveBeenCalledWith("D:\\Tolaria\\Vault");
    expect(runtime.setDefaultRelativeFolder).toHaveBeenCalledWith("Inbox/Reading");
    expect(button.disabled).toBe(false);
    expect(container.textContent).toContain("保存成功");
    expect(container.textContent).toContain("C:\\Users\\mrvic\\Vault");
  } finally {
    dom.window.close();
  }
});

it("Vault root 保存失败时停止后续保存并恢复表单", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue("C:\\Old\\Vault"),
    setVaultRoot: vi.fn().mockRejectedValue(new Error("原始内部错误")),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn()
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    const button = container.querySelector<HTMLButtonElement>("#save-settings");
    if (!button) throw new Error("settings button missing");
    const root = container.querySelector<HTMLInputElement>("#vault-root");
    if (!root) throw new Error("Vault root control missing");
    root.value = "C:\\Vault";
    button.click();
    expect(button.disabled).toBe(true);
    await flushAsyncWork();
    expect(runtime.setDefaultRelativeFolder).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(container.textContent).toContain("无法保存 Vault root");
    expect(container.textContent).not.toContain("原始内部错误");
  } finally {
    dom.window.close();
  }
});

it("默认目录保存失败时不宣称两项设置都已完成", async () => {
  const runtime: OptionsRuntime = {
    getVaultRoot: vi.fn().mockResolvedValue("C:\\Old\\Vault"),
    setVaultRoot: vi.fn().mockResolvedValue("C:\\Users\\mrvic\\Vault"),
    getDefaultRelativeFolder: vi.fn().mockResolvedValue("Inbox/Web"),
    setDefaultRelativeFolder: vi.fn().mockRejectedValue(new Error("storage unavailable"))
  };
  const { container, dom } = mountOptionsForTest(runtime);
  try {
    await flushAsyncWork();
    const button = container.querySelector<HTMLButtonElement>("#save-settings");
    if (!button) throw new Error("settings button missing");
    button.click();
    await flushAsyncWork();
    expect(runtime.setVaultRoot).toHaveBeenCalledWith("C:\\Old\\Vault");
    expect(runtime.setDefaultRelativeFolder).toHaveBeenCalledWith("Inbox/Web");
    expect(container.textContent).toContain("默认目录");
    expect(container.textContent).not.toContain("保存成功");
  } finally {
    dom.window.close();
  }
});

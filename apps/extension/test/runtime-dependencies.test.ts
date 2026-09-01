import { expect, it, vi } from "vitest";

interface RuntimeDependencies {
  getDefaultRelativeFolder?: () => Promise<string>;
}

it("真实运行时依赖读取 Extension storage 中的默认目录", async () => {
  vi.resetModules();
  const globalWithChrome = globalThis as typeof globalThis & { chrome?: unknown };
  const previousChrome = globalWithChrome.chrome;
  const get = vi.fn().mockResolvedValue({ defaultRelativeFolder: "Inbox/Reading" });

  globalWithChrome.chrome = {
    storage: { local: { get } },
    runtime: {}
  };

  try {
    const extensionModule = (await import("../src/background/main.js")) as unknown as {
      runtimeDependencies?: () => RuntimeDependencies;
    };
    expect(typeof extensionModule.runtimeDependencies).toBe("function");
    if (!extensionModule.runtimeDependencies) {
      return;
    }

    const dependencies = extensionModule.runtimeDependencies();
    expect(typeof dependencies.getDefaultRelativeFolder).toBe("function");
    if (!dependencies.getDefaultRelativeFolder) {
      return;
    }

    await expect(dependencies.getDefaultRelativeFolder()).resolves.toBe("Inbox/Reading");
    expect(get).toHaveBeenCalledWith("defaultRelativeFolder");
  } finally {
    globalWithChrome.chrome = previousChrome;
  }
});

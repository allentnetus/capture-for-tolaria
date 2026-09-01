import { expect, it, vi } from "vitest";
import {
  getDefaultRelativeFolder,
  setDefaultRelativeFolder
} from "../src/settings/storage.js";

it("缺失默认目录时回退 Inbox/Web", async () => {
  const storage = {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn()
  };

  await expect(getDefaultRelativeFolder(storage)).resolves.toBe("Inbox/Web");
  expect(storage.get).toHaveBeenCalledWith("defaultRelativeFolder");
});

it("非法默认目录时回退 Inbox/Web", async () => {
  const storage = {
    get: vi.fn().mockResolvedValue({ defaultRelativeFolder: "../outside" }),
    set: vi.fn()
  };

  await expect(getDefaultRelativeFolder(storage)).resolves.toBe("Inbox/Web");
  expect(storage.get).toHaveBeenCalledWith("defaultRelativeFolder");
});

it("非字符串默认目录时回退 Inbox/Web", async () => {
  const storage = {
    get: vi.fn().mockResolvedValue({ defaultRelativeFolder: 42 }),
    set: vi.fn()
  };

  await expect(getDefaultRelativeFolder(storage)).resolves.toBe("Inbox/Web");
  expect(storage.get).toHaveBeenCalledWith("defaultRelativeFolder");
});

it("读取失败时回退 Inbox/Web", async () => {
  const storage = {
    get: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    set: vi.fn()
  };

  await expect(getDefaultRelativeFolder(storage)).resolves.toBe("Inbox/Web");
  expect(storage.get).toHaveBeenCalledWith("defaultRelativeFolder");
});

it("保存默认目录时使用规范化相对路径", async () => {
  const storage = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };

  await setDefaultRelativeFolder("  Inbox/Reading  ", storage);

  expect(storage.set).toHaveBeenCalledWith({
    defaultRelativeFolder: "Inbox/Reading"
  });
});

import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  assertNoReparsePoint,
  FileChannelError,
  prepareVaultDirectory
} from "../src/index.js";

async function temporaryVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "capture-for-tolaria-vault-"));
}

it("逐级创建 Inbox/Web 并返回 Vault 内目录", async () => {
  const vault = await temporaryVault();
  try {
    const prepared = await prepareVaultDirectory(vault, "Inbox/Web");
    expect(prepared.relativeFolder).toBe("Inbox/Web");
    expect(prepared.absolutePath).toContain("Inbox");
    expect(prepared.absolutePath).toContain("Web");
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("拒绝路径穿越、绝对路径和文件目录冲突", async () => {
  const vault = await temporaryVault();
  try {
    await expect(prepareVaultDirectory(vault, "../outside")).rejects.toThrow(
      FileChannelError
    );
    await expect(
      prepareVaultDirectory(vault, "C:\\Users\\other")
    ).rejects.toThrow(FileChannelError);

    await writeFile(join(vault, "Inbox"), "not a directory", "utf8");
    await expect(prepareVaultDirectory(vault, "Inbox/Web")).rejects.toThrow(
      FileChannelError
    );
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("拒绝指向 Vault 外部的 junction 或 symlink", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    await symlink(outside, join(vault, "link-to-outside"), "junction");
    await expect(
      prepareVaultDirectory(vault, "link-to-outside/escaped")
    ).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}, 30_000);

it("对普通目录和 Windows reparse point 执行属性级检查", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    await expect(assertNoReparsePoint(vault)).resolves.toBeUndefined();
    const junction = join(vault, "junction");
    await symlink(outside, junction, "junction");
    await expect(assertNoReparsePoint(junction)).rejects.toThrow(
      FileChannelError
    );
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it("macOS 路径检查只拒绝 symlink，不调用 Windows 专用检查", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    await expect(
      assertNoReparsePoint(vault, undefined, { platform: "darwin" })
    ).resolves.toBeUndefined();

    const symlinkPath = join(vault, "macos-link");
    await symlink(outside, symlinkPath, "junction");
    await expect(
      assertNoReparsePoint(symlinkPath, undefined, { platform: "darwin" })
    ).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it("macOS 路径检查拒绝包含 symlink 的父级目录", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    const child = join(outside, "child");
    await writeFile(child, "not a directory", "utf8");
    const parentLink = join(vault, "parent-link");
    await symlink(outside, parentLink, "junction");
    await expect(
      assertNoReparsePoint(
        join(parentLink, "child"),
        undefined,
        { platform: "darwin" }
      )
    ).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it("不支持的平台不会静默执行 Vault 路径操作", async () => {
  const vault = await temporaryVault();
  try {
    await expect(
      prepareVaultDirectory(vault, "Inbox/Web", { platform: "linux" })
    ).rejects.toMatchObject({
      code: "VAULT_ACCESS_DENIED",
      userMessage: "当前平台不受支持"
    });
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
});

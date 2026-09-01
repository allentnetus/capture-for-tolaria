import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  getConfiguredVaultConfig,
  getConfiguredVault,
  setConfiguredVault,
  validateConfiguredVault
} from "../src/index.js";

it("保存并读取 per-user Vault 配置且不预创建 Inbox/Web", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-config-"));
  const vault = join(workspace, "vault");
  const configPath = join(workspace, "config.json");
  const previous = process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
  process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = configPath;

  try {
    await mkdir(vault);
    await setConfiguredVault(vault);
    expect(await getConfiguredVault()).toBe(vault);
    expect(await validateConfiguredVault(vault)).toBe("ready");
    expect(await readFile(configPath, "utf8")).toContain('"vaultRoot"');
    await expect(access(join(vault, "Inbox", "Web"))).rejects.toThrow();
  } finally {
    if (previous === undefined) {
      delete process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
    } else {
      process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
}, 30_000);

it("区分缺失 Vault 与不可用 Vault", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-config-"));
  try {
    expect(await validateConfiguredVault(join(workspace, "missing"))).toBe("missing");
    expect(await validateConfiguredVault(workspace)).toBe("ready");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

it("读取 Windows PowerShell 可能写入的 UTF-8 BOM 配置", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-bom-"));
  const vault = join(workspace, "vault");
  const configPath = join(workspace, "config.json");
  const previous = process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
  process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = configPath;

  try {
    await mkdir(vault);
    await writeFile(
      configPath,
      `\uFEFF${JSON.stringify({ vaultRoot: vault })}`,
      "utf8"
    );
    expect(await getConfiguredVault()).toBe(vault);
  } finally {
    if (previous === undefined) {
      delete process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
    } else {
      process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});

it("读取显式启用的 fake-IP DNS 兼容开关", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-fake-dns-"));
  const vault = join(workspace, "vault");
  const configPath = join(workspace, "config.json");
  const previous = process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
  process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = configPath;

  try {
    await mkdir(vault);
    await writeFile(
      configPath,
      JSON.stringify({ vaultRoot: vault, allowSyntheticDns: true }),
      "utf8"
    );
    await expect(getConfiguredVaultConfig()).resolves.toMatchObject({
      vaultRoot: vault,
      allowSyntheticDns: true
    });
    await expect(getConfiguredVault()).resolves.toBe(vault);
  } finally {
    if (previous === undefined) {
      delete process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
    } else {
      process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});

it("更新 Vault root 时保留 allowSyntheticDns", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-config-preserve-"));
  const firstVault = join(workspace, "first-vault");
  const secondVault = join(workspace, "second-vault");
  const configPath = join(workspace, "config.json");
  const previous = process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
  process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = configPath;

  try {
    await mkdir(firstVault);
    await mkdir(secondVault);
    await writeFile(
      configPath,
      JSON.stringify({ vaultRoot: firstVault, allowSyntheticDns: true }),
      "utf8"
    );
    await setConfiguredVault(secondVault);
    await expect(getConfiguredVaultConfig()).resolves.toMatchObject({
      vaultRoot: secondVault,
      allowSyntheticDns: true
    });
  } finally {
    if (previous === undefined) {
      delete process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
    } else {
      process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = previous;
    }
    await rm(workspace, { recursive: true, force: true });
  }
});

it("拒绝相对 Vault root", async () => {
  await expect(setConfiguredVault("relative-vault")).rejects.toMatchObject({
    code: "VAULT_ACCESS_DENIED",
    userMessage: "Vault 根目录必须是绝对路径"
  });
});

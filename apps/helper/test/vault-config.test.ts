import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
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
});

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

import { access, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { assertNoReparsePoint } from "./path-sandbox.js";
import { FileChannelError } from "./errors.js";
import { getPlatformPaths, type PlatformPathOptions } from "./platform-paths.js";

export interface VaultConfig {
  vaultRoot: string;
  allowSyntheticDns?: boolean;
}

function configRoot(options?: PlatformPathOptions): string {
  return getPlatformPaths(options).configPath;
}

export function getConfigPath(options?: PlatformPathOptions): string {
  return configRoot(options);
}

export async function validateConfiguredVault(
  vaultPath: string
): Promise<"ready" | "missing" | "inaccessible"> {
  const resolvedPath = resolve(vaultPath);
  try {
    const stats = await lstat(resolvedPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return "inaccessible";
    }
    await assertNoReparsePoint(resolvedPath, stats);
    await access(resolvedPath, fsConstants.R_OK | fsConstants.W_OK);
    return "ready";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing";
    }
    return "inaccessible";
  }
}

export async function getConfiguredVaultConfig(): Promise<VaultConfig | null> {
  try {
    const raw = await readFile(configRoot(), "utf8");
    const json = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("vaultRoot" in parsed) ||
      typeof parsed.vaultRoot !== "string" ||
      parsed.vaultRoot.trim().length === 0
    ) {
      return null;
    }
    return {
      vaultRoot: resolve(parsed.vaultRoot),
      allowSyntheticDns: "allowSyntheticDns" in parsed && parsed.allowSyntheticDns === true
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      return null;
    }
    throw new FileChannelError(
      "VAULT_ACCESS_DENIED",
      "无法读取 Vault 配置",
      { cause: error }
    );
  }
}

export async function getConfiguredVault(): Promise<string | null> {
  return (await getConfiguredVaultConfig())?.vaultRoot ?? null;
}

export async function setConfiguredVault(vaultPath: string): Promise<void> {
  if (!isAbsolute(vaultPath)) {
    throw new FileChannelError("VAULT_ACCESS_DENIED", "Vault 根目录必须是绝对路径");
  }

  const resolvedPath = resolve(vaultPath);
  const validation = await validateConfiguredVault(resolvedPath);
  if (validation !== "ready") {
    throw new FileChannelError(
      "VAULT_ACCESS_DENIED",
      "Vault 根目录不存在或不可访问"
    );
  }

  const target = configRoot();
  await mkdir(dirname(target), { recursive: true });
  const temporaryPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  const existing = await getConfiguredVaultConfig();
  const serialized = `${JSON.stringify(
    {
      vaultRoot: resolvedPath,
      ...(existing?.allowSyntheticDns === true ? { allowSyntheticDns: true } : {})
    },
    null,
    2
  )}\n`;
  try {
    await writeFile(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, target);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new FileChannelError("VAULT_ACCESS_DENIED", "无法保存 Vault 配置", {
      cause: error
    });
  }
}

import { execFile } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import type { Stats } from "node:fs";
import { promisify } from "node:util";
import { join, relative, resolve, sep } from "node:path";
import { FileChannelError } from "./errors.js";

const execFileAsync = promisify(execFile);

export interface PreparedVaultDirectory {
  vaultRoot: string;
  relativeFolder: string;
  absolutePath: string;
}

const WINDOWS_INVALID_SEGMENT = /[<>:"|?*]/u;
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;

function throwInvalidPath(message: string): never {
  throw new FileChannelError("INVALID_PATH", message);
}

export async function assertNoReparsePoint(
  targetPath: string,
  knownStats?: Stats
): Promise<void> {
  const stats = knownStats ?? await lstat(targetPath);
  if (process.platform !== "win32") {
    if (stats.isSymbolicLink()) {
      throwInvalidPath("路径包含 symlink");
    }
    return;
  }

  const command =
    "$ErrorActionPreference = 'Stop'; " +
    "$item = Get-Item -LiteralPath $env:CAPTURE_FOR_TOLARIA_REPARSE_PATH -Force; " +
    "if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) " +
    "{ [Console]::Write('1') } else { [Console]::Write('0') }";
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      {
        windowsHide: true,
        env: {
          ...process.env,
          CAPTURE_FOR_TOLARIA_REPARSE_PATH: targetPath
        }
      }
    );
    const marker = String(stdout).trim();
    if (marker === "1" || stats.isSymbolicLink()) {
      throwInvalidPath("路径包含 Windows reparse point");
    }
    if (marker !== "0") {
      throwInvalidPath("无法确认 Windows reparse point 状态");
    }
  } catch (error) {
    if (error instanceof FileChannelError) {
      throw error;
    }
    throw new FileChannelError(
      "INVALID_PATH",
      "无法确认 Windows reparse point 状态",
      { cause: error }
    );
  }
}

function pathSegments(relativeFolder: string): string[] {
  const normalized = relativeFolder.trim();
  if (normalized.length === 0 || normalized.length > 512) {
    return throwInvalidPath("relativeFolder 不能为空且不得超出长度限制");
  }
  if (/^[\\/]/u.test(normalized) || /^[A-Za-z]:/u.test(normalized)) {
    return throwInvalidPath("relativeFolder 不能是绝对路径");
  }

  const segments = normalized.split(/[\\/]/u);
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\u0000") ||
        WINDOWS_INVALID_SEGMENT.test(segment) ||
        segment.endsWith(" ") ||
        segment.endsWith(".") ||
        WINDOWS_RESERVED_NAME.test(segment)
    )
  ) {
    return throwInvalidPath("relativeFolder 包含非法或越界路径段");
  }
  return segments;
}

function isContained(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !relativePath.includes(`..${sep}`) && !relativePath.startsWith(sep));
}

async function canonicalVaultRoot(vaultRoot: string): Promise<string> {
  const resolvedRoot = resolve(vaultRoot);
  try {
    const rootStats = await lstat(resolvedRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throwInvalidPath("Vault 根目录必须是普通目录");
    }
    await assertNoReparsePoint(resolvedRoot, rootStats);
    const canonicalRoot = await realpath(resolvedRoot);
    if (!isContained(canonicalRoot, canonicalRoot)) {
      throwInvalidPath("Vault 根目录路径无效");
    }
    return canonicalRoot;
  } catch (error) {
    if (error instanceof FileChannelError) {
      throw error;
    }
    throw new FileChannelError("VAULT_ACCESS_DENIED", "无法访问授权 Vault", {
      cause: error
    });
  }
}

export async function prepareVaultDirectory(
  vaultRoot: string,
  relativeFolder: string
): Promise<PreparedVaultDirectory> {
  const segments = pathSegments(relativeFolder);
  const canonicalRoot = await canonicalVaultRoot(vaultRoot);
  let current = canonicalRoot;

  for (const segment of segments) {
    const next = join(current, segment);
    try {
      await mkdir(next);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw new FileChannelError("VAULT_ACCESS_DENIED", "无法创建 Vault 目录", {
          cause: error
        });
      }
    }

    try {
      const stats = await lstat(next);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throwInvalidPath("Vault 目录包含文件或 reparse point");
      }
      await assertNoReparsePoint(next, stats);
      const canonicalNext = await realpath(next);
      if (!isContained(canonicalRoot, canonicalNext)) {
        throwInvalidPath("Vault 目录逃出授权根目录");
      }
      current = canonicalNext;
    } catch (error) {
      if (error instanceof FileChannelError) {
        throw error;
      }
      throw new FileChannelError("VAULT_ACCESS_DENIED", "无法校验 Vault 目录", {
        cause: error
      });
    }
  }

  return {
    vaultRoot: canonicalRoot,
    relativeFolder: segments.join("/"),
    absolutePath: current
  };
}

export function assertSafeFilename(filename: string): void {
  if (
    filename.length === 0 ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    WINDOWS_INVALID_SEGMENT.test(filename) ||
    filename.endsWith(" ") ||
    filename.endsWith(".") ||
    WINDOWS_RESERVED_NAME.test(filename)
  ) {
    throwInvalidPath("目标文件名不安全");
  }
}

export function relativePathFromVault(vaultRoot: string, targetPath: string): string {
  const relativePath = relative(vaultRoot, targetPath);
  if (!isContained(vaultRoot, targetPath)) {
    throwInvalidPath("目标路径逃出授权 Vault");
  }
  return relativePath.split(sep).join("/");
}

import { lstat, link, open, realpath, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { FileChannelError } from "./errors.js";
import { addConflictSuffix, buildMarkdownFilename } from "./filename.js";
import {
  assertNoReparsePoint,
  assertSafeFilename,
  prepareVaultDirectory,
  relativePathFromVault
} from "./path-sandbox.js";

async function ensureExistingTargetSafe(targetPath: string): Promise<void> {
  try {
    const stats = await lstat(targetPath);
    await assertNoReparsePoint(targetPath, stats);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export interface WriteInput {
  vaultRoot: string;
  relativeFolder: string;
  title: string;
  markdown: string;
  capturedAt?: Date;
}

export interface WriteResult {
  relativePath: string;
  created: true;
}

const MAX_CONFLICT_ATTEMPTS = 100;

async function writeTemporaryFile(
  directory: string,
  markdown: string
): Promise<string> {
  const temporaryPath = join(
    directory,
    `.capture-for-tolaria-${randomUUID()}.tmp`
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(markdown, "utf8");
    await handle.sync();
    await handle.close();
    return temporaryPath;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw new FileChannelError("WRITE_FAILED", "无法准备完整的临时文件", {
      cause: error
    });
  }
}

async function createOnlyLink(
  temporaryPath: string,
  targetPath: string
): Promise<"created" | "exists"> {
  try {
    await link(temporaryPath, targetPath);
    return "created";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "EISDIR") {
      return "exists";
    }
    throw new FileChannelError(
      "ATOMIC_COMMIT_UNAVAILABLE",
      "当前文件系统无法保证 atomic create-only 写入",
      { cause: error }
    );
  }
}

export async function writeMarkdownCreateOnly(
  input: WriteInput
): Promise<WriteResult> {
  const preparedDirectory = await prepareVaultDirectory(
    input.vaultRoot,
    input.relativeFolder
  );
  const initialFilename = buildMarkdownFilename(
    input.title,
    input.capturedAt ?? new Date()
  );
  assertSafeFilename(initialFilename);

  for (let attempt = 1; attempt <= MAX_CONFLICT_ATTEMPTS; attempt += 1) {
    const filename = addConflictSuffix(initialFilename, attempt);
    const targetPath = join(preparedDirectory.absolutePath, filename);
    await ensureExistingTargetSafe(targetPath);
    const temporaryPath = await writeTemporaryFile(
      preparedDirectory.absolutePath,
      input.markdown
    );

    try {
      const commit = await createOnlyLink(temporaryPath, targetPath);
      if (commit === "exists") {
        continue;
      }
      const canonicalTarget = await realpath(targetPath);
      return {
        relativePath: relativePathFromVault(
          preparedDirectory.vaultRoot,
          canonicalTarget
        ),
        created: true
      };
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }

  throw new FileChannelError(
    "NAME_EXHAUSTED",
    "无法为剪藏内容分配不冲突的文件名"
  );
}

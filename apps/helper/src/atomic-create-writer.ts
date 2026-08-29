import {
  lstat,
  link,
  open,
  readFile,
  readdir,
  realpath,
  rmdir,
  unlink
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { LocalizedAsset } from "@capture-for-tolaria/protocol";
import type { PreparedAsset } from "./article-image-localizer.js";
import { FileChannelError } from "./errors.js";
import { addConflictSuffix, buildMarkdownFilename } from "./filename.js";
import {
  assertNoReparsePoint,
  assertSafeFilename,
  prepareVaultAssetsDirectory,
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

async function ensureExistingAssetTargetSafe(targetPath: string): Promise<void> {
  try {
    const stats = await lstat(targetPath);
    await assertNoReparsePoint(targetPath, stats);
    if (!stats.isFile()) {
      throw new FileChannelError("INVALID_PATH", "目标 Asset 不是普通文件");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function ensureExistingAssetContentMatches(
  targetPath: string,
  expectedContent: Uint8Array
): Promise<void> {
  try {
    const stats = await lstat(targetPath);
    await assertNoReparsePoint(targetPath, stats);
    if (!stats.isFile() || stats.size !== expectedContent.byteLength) {
      throw new FileChannelError("WRITE_FAILED", "已有图片资源内容与哈希文件名不匹配");
    }
    const existingContent = await readFile(targetPath);
    const expectedHash = createHash("sha256").update(expectedContent).digest("hex");
    const existingHash = createHash("sha256").update(existingContent).digest("hex");
    if (existingHash !== expectedHash) {
      throw new FileChannelError("WRITE_FAILED", "已有图片资源内容与哈希文件名不匹配");
    }
  } catch (error) {
    if (error instanceof FileChannelError) {
      throw error;
    }
    throw new FileChannelError("WRITE_FAILED", "无法验证已有图片资源", { cause: error });
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

export interface CaptureBundleInput extends WriteInput {
  assets: PreparedAsset[];
}

export interface CaptureBundleWriteResult extends WriteResult {
  assets: LocalizedAsset[];
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

async function writeTemporaryAsset(
  directory: string,
  content: Uint8Array
): Promise<string> {
  const temporaryPath = join(
    directory,
    `.capture-for-tolaria-${randomUUID()}.asset.tmp`
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    return temporaryPath;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw new FileChannelError("WRITE_FAILED", "无法准备完整的图片资源", {
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

const ASSET_MAX_BYTES = 8 * 1024 * 1024;
const ASSET_FILENAME_PATTERN = /^([a-f0-9]{64})\.(jpg|png|gif|webp|avif)$/u;
const ASSET_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif"
};

function assetFilename(asset: PreparedAsset): string {
  if (!asset.relativePath.startsWith("Assets/")) {
    throw new FileChannelError("INVALID_PATH", "图片资源路径必须位于 Assets 目录");
  }
  const filename = asset.relativePath.slice("Assets/".length);
  assertSafeFilename(filename);
  const match = ASSET_FILENAME_PATTERN.exec(filename);
  if (!match) {
    throw new FileChannelError("INVALID_PATH", "图片资源文件名不是安全的内容哈希路径");
  }
  if (ASSET_EXTENSIONS[asset.contentType] !== match[2]) {
    throw new FileChannelError("WRITE_FAILED", "图片资源 MIME 与文件扩展名不匹配");
  }
  if (asset.byteLength !== asset.content.byteLength || asset.byteLength > ASSET_MAX_BYTES) {
    throw new FileChannelError("WRITE_FAILED", "图片资源大小元数据无效");
  }
  const contentHash = createHash("sha256").update(asset.content).digest("hex");
  if (contentHash !== match[1]) {
    throw new FileChannelError("WRITE_FAILED", "图片资源内容与哈希文件名不匹配");
  }
  return filename;
}

async function markdownReferencesAsset(
  markdownDirectory: string,
  relativeAssetPath: string
): Promise<boolean> {
  const entries = await readdir(markdownDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const content = await readFile(join(markdownDirectory, entry.name), "utf8");
    if (content.includes(relativeAssetPath)) {
      return true;
    }
  }
  return false;
}

async function cleanupNewAssets(
  targets: string[],
  markdownDirectory: string,
  relativeAssetPaths: string[]
): Promise<void> {
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const relativeAssetPath = relativeAssetPaths[index];
    if (!target || !relativeAssetPath) {
      continue;
    }
    try {
      await ensureExistingAssetTargetSafe(target);
      if (await markdownReferencesAsset(markdownDirectory, relativeAssetPath)) {
        continue;
      }
      await unlink(target);
    } catch {
      // Cleanup is best effort; the original write error is more actionable.
    }
  }
}

async function wasDirectoryPresent(directory: string): Promise<boolean> {
  try {
    await lstat(directory);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function removeNewEmptyDirectory(
  directory: string,
  wasPresent: boolean
): Promise<void> {
  if (wasPresent) {
    return;
  }
  try {
    if ((await readdir(directory)).length === 0) {
      await rmdir(directory);
    }
  } catch {
    // Do not replace the original capture error with cleanup noise.
  }
}

export async function writeCaptureBundleCreateOnly(
  input: CaptureBundleInput
): Promise<CaptureBundleWriteResult> {
  const preparedDirectory = await prepareVaultDirectory(
    input.vaultRoot,
    input.relativeFolder
  );
  if (input.assets.length === 0) {
    const result = await writeMarkdownCreateOnly(input);
    return { ...result, assets: [] };
  }

  const assetsDirectoryPath = join(preparedDirectory.absolutePath, "Assets");
  const assetsDirectoryWasPresent = await wasDirectoryPresent(assetsDirectoryPath);
  const preparedAssetsDirectory = await prepareVaultAssetsDirectory(
    input.vaultRoot,
    input.relativeFolder
  );
  const createdTargets: string[] = [];
  const createdRelativePaths: string[] = [];
  const localizedAssets: LocalizedAsset[] = [];

  try {
    for (const asset of input.assets) {
      const filename = assetFilename(asset);
      const targetPath = join(preparedAssetsDirectory.absolutePath, filename);
      await ensureExistingAssetTargetSafe(targetPath);
      const temporaryPath = await writeTemporaryAsset(
        preparedAssetsDirectory.absolutePath,
        asset.content
      );

      try {
        const commit = await createOnlyLink(temporaryPath, targetPath);
        if (commit === "exists") {
          await ensureExistingAssetContentMatches(targetPath, asset.content);
        } else {
          createdTargets.push(targetPath);
          createdRelativePaths.push(asset.relativePath);
        }
        const canonicalTarget = await realpath(targetPath);
        localizedAssets.push({
          remoteUrl: asset.remoteUrl,
          relativePath: relativePathFromVault(
            preparedAssetsDirectory.vaultRoot,
            canonicalTarget
          ),
          contentType: asset.contentType,
          byteLength: asset.byteLength
        });
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
    }

    const result = await writeMarkdownCreateOnly(input);
    return { ...result, assets: localizedAssets };
  } catch (error) {
    await cleanupNewAssets(
      createdTargets,
      preparedDirectory.absolutePath,
      createdRelativePaths
    );
    await removeNewEmptyDirectory(assetsDirectoryPath, assetsDirectoryWasPresent);
    throw error;
  }
}

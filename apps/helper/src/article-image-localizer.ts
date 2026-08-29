import { createHash } from "node:crypto";
import type {
  AssetSummary,
  ImageCandidate,
  LocalizedAsset
} from "@capture-for-tolaria/protocol";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  downloadAsset,
  type AssetFetcher,
  type AssetLocalizationPolicy
} from "./asset-downloader.js";
import { FileChannelError, type FileChannelErrorCode } from "./errors.js";

export interface PreparedAsset extends LocalizedAsset {
  content: Uint8Array;
}

export interface ImageLocalizationResult {
  markdown: string;
  assets: PreparedAsset[];
  summary: AssetSummary;
  warnings: string[];
}

const IMAGE_TARGET_PATTERN = /!\[([^\]]{0,512})\]\(([^)\s]{1,2048})\)/gu;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif"
};

function fencedMarker(line: string): { character: "`" | "~"; length: number } | null {
  const match = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
  if (!match?.[1]) {
    return null;
  }
  return {
    character: match[1][0] as "`" | "~",
    length: match[1].length
  };
}

function imageTargetsOutsideFences(markdown: string): Set<string> {
  const targets = new Set<string>();
  let fence: { character: "`" | "~"; length: number } | null = null;

  for (const line of markdown.split(/\r?\n/u)) {
    const marker = fencedMarker(line);
    if (marker) {
      if (!fence) {
        fence = marker;
      } else if (marker.character === fence.character && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence) {
      continue;
    }
    for (const match of line.matchAll(IMAGE_TARGET_PATTERN)) {
      const remoteUrl = match[2];
      if (remoteUrl) {
        targets.add(remoteUrl);
      }
    }
  }
  return targets;
}

function rewriteMarkdown(
  markdown: string,
  replacements: ReadonlyMap<string, string>
): string {
  if (replacements.size === 0) {
    return markdown;
  }

  const lineEnding = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/u);
  let fence: { character: "`" | "~"; length: number } | null = null;
  let changed = false;
  const rewritten = lines.map((line) => {
    const marker = fencedMarker(line);
    if (marker) {
      if (!fence) {
        fence = marker;
      } else if (marker.character === fence.character && marker.length >= fence.length) {
        fence = null;
      }
      return line;
    }
    if (fence) {
      return line;
    }

    return line.replace(IMAGE_TARGET_PATTERN, (whole, alt: string, remoteUrl: string) => {
      const replacement = replacements.get(remoteUrl);
      if (!replacement) {
        return whole;
      }
      changed = true;
      return `![${alt}](${replacement})`;
    });
  });

  return changed ? rewritten.join(lineEnding) : markdown;
}

function uniqueCandidates(images: ImageCandidate[]): ImageCandidate[] {
  const candidates = new Map<string, ImageCandidate>();
  for (const image of images) {
    const remoteUrl = image.remoteUrl.trim();
    if (candidates.has(remoteUrl)) {
      continue;
    }
    const candidate: ImageCandidate = { remoteUrl };
    if (image.altText !== undefined) {
      candidate.altText = image.altText;
    }
    candidates.set(remoteUrl, candidate);
  }
  return [...candidates.values()];
}

function warningFor(error: unknown): string {
  if (!(error instanceof FileChannelError)) {
    return "IMAGE_DOWNLOAD_FAILED";
  }

  const warningCodes: Partial<Record<FileChannelErrorCode, string>> = {
    ASSET_URL_INVALID: "IMAGE_URL_INVALID",
    ASSET_TARGET_BLOCKED: "IMAGE_TARGET_BLOCKED",
    ASSET_REDIRECT_BLOCKED: "IMAGE_REDIRECT_BLOCKED",
    ASSET_REDIRECT_LIMIT: "IMAGE_REDIRECT_LIMIT",
    ASSET_UNSUPPORTED_TYPE: "IMAGE_UNSUPPORTED_TYPE",
    ASSET_TOO_LARGE: "IMAGE_TOO_LARGE",
    ASSET_TOTAL_TOO_LARGE: "IMAGE_TOTAL_TOO_LARGE",
    ASSET_TIMEOUT: "IMAGE_TIMEOUT",
    ASSET_DOWNLOAD_FAILED: "IMAGE_DOWNLOAD_FAILED"
  };
  return warningCodes[error.code] ?? "IMAGE_DOWNLOAD_FAILED";
}

function extensionForContentType(contentType: string): string {
  const extension = MIME_EXTENSIONS[contentType];
  if (!extension) {
    throw new FileChannelError("ASSET_UNSUPPORTED_TYPE", "图片 MIME 类型不受支持");
  }
  return extension;
}

export async function localizeArticleImages(
  markdown: string,
  images: ImageCandidate[],
  policy: AssetLocalizationPolicy = DEFAULT_ASSET_LOCALIZATION_POLICY,
  fetcher: AssetFetcher = {
    fetch: (url, init) => globalThis.fetch(url, init)
  }
): Promise<ImageLocalizationResult> {
  const candidates = uniqueCandidates(images);
  const imageTargets = imageTargetsOutsideFences(markdown);
  const replacements = new Map<string, string>();
  const assets: PreparedAsset[] = [];
  const warnings: string[] = [];
  const summary: AssetSummary = {
    requested: candidates.length,
    localized: 0,
    fallback: 0
  };
  let downloadedBytes = 0;

  for (const candidate of candidates) {
    if (!imageTargets.has(candidate.remoteUrl)) {
      continue;
    }

    try {
      const downloaded = await downloadAsset(
        candidate,
        policy,
        fetcher,
        downloadedBytes
      );
      const extension = extensionForContentType(downloaded.contentType);
      const hash = createHash("sha256").update(downloaded.bytes).digest("hex");
      const relativePath = `Assets/${hash}.${extension}`;
      assets.push({
        remoteUrl: candidate.remoteUrl,
        relativePath,
        contentType: downloaded.contentType,
        byteLength: downloaded.bytes.byteLength,
        content: downloaded.bytes
      });
      replacements.set(candidate.remoteUrl, relativePath);
      downloadedBytes += downloaded.bytes.byteLength;
      summary.localized += 1;
    } catch (error) {
      summary.fallback += 1;
      warnings.push(warningFor(error));
    }
  }

  return {
    markdown: rewriteMarkdown(markdown, replacements),
    assets,
    summary,
    warnings
  };
}

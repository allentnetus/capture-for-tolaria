import { createHash } from "node:crypto";
import type {
  AssetSummary,
  ImageCandidate,
  LocalizedAsset
} from "@capture-for-tolaria/protocol";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  DEFAULT_ASSET_FETCHER,
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

const MAX_IMAGE_ALT_TEXT_LENGTH = 512;
const MAX_IMAGE_URL_LENGTH = 2_048;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif"
};

interface ImageTargetMatch {
  start: number;
  end: number;
  alt: string;
  remoteUrl: string;
}

function findImageTargets(line: string): ImageTargetMatch[] {
  const matches: ImageTargetMatch[] = [];
  let cursor = 0;

  while (cursor < line.length - 1) {
    const start = line.indexOf("![", cursor);
    if (start < 0) {
      break;
    }
    const altStart = start + 2;
    const altEnd = line.indexOf("]", altStart);
    if (altEnd < 0) {
      break;
    }
    if (altEnd - altStart > MAX_IMAGE_ALT_TEXT_LENGTH || line[altEnd + 1] !== "(") {
      cursor = altEnd + 1;
      continue;
    }

    const destinationStart = altEnd + 2;
    let destinationEnd = destinationStart;
    let depth = 1;
    let escaped = false;
    let foundClosingParenthesis = false;
    while (destinationEnd < line.length) {
      const character = line[destinationEnd];
      if (character === undefined) {
        break;
      }
      if (escaped) {
        escaped = false;
        destinationEnd += 1;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        destinationEnd += 1;
        continue;
      }
      if (/\s/u.test(character)) {
        break;
      }
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          foundClosingParenthesis = true;
          break;
        }
      }
      if (destinationEnd - destinationStart + 1 > MAX_IMAGE_URL_LENGTH) {
        break;
      }
      destinationEnd += 1;
    }

    const destinationLength = destinationEnd - destinationStart;
    if (
      foundClosingParenthesis &&
      destinationLength > 0 &&
      destinationLength <= MAX_IMAGE_URL_LENGTH
    ) {
      matches.push({
        start,
        end: destinationEnd + 1,
        alt: line.slice(altStart, altEnd),
        remoteUrl: line.slice(destinationStart, destinationEnd)
      });
      cursor = destinationEnd + 1;
    } else {
      cursor = Math.max(start + 2, destinationEnd + 1);
    }
  }

  return matches;
}

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
    for (const match of findImageTargets(line)) {
      targets.add(match.remoteUrl);
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

    const matches = findImageTargets(line);
    if (matches.length === 0) {
      return line;
    }
    let cursor = 0;
    let rewritten = "";
    for (const match of matches) {
      rewritten += line.slice(cursor, match.start);
      const replacement = replacements.get(match.remoteUrl);
      if (replacement) {
        rewritten += `![${match.alt}](${replacement})`;
        changed = true;
      } else {
        rewritten += line.slice(match.start, match.end);
      }
      cursor = match.end;
    }
    return rewritten + line.slice(cursor);
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
  fetcher: AssetFetcher = DEFAULT_ASSET_FETCHER
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
  const localizationDeadline = Date.now() + policy.maxLocalizationTimeMs;

  for (const candidate of candidates) {
    if (!imageTargets.has(candidate.remoteUrl)) {
      continue;
    }

    const remainingTimeMs = localizationDeadline - Date.now();
    if (remainingTimeMs <= 0) {
      summary.fallback += 1;
      warnings.push("IMAGE_TIMEOUT");
      continue;
    }

    try {
      const downloaded = await downloadAsset(
        candidate,
        { ...policy, timeoutMs: Math.min(policy.timeoutMs, remainingTimeMs) },
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

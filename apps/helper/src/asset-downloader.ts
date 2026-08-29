import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ImageCandidate } from "@capture-for-tolaria/protocol";
import { FileChannelError } from "./errors.js";

export interface AssetLocalizationPolicy {
  maxAssetBytes: number;
  maxTotalBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  allowSyntheticDns: boolean;
}

export interface AssetFetcher {
  fetch(
    url: string,
    init: {
      signal: AbortSignal;
      redirect: "manual";
      headers: { Accept: "image/*" };
    }
  ): Promise<Response>;
  resolveHost?: (hostname: string) => Promise<string[]>;
}

export interface DownloadedAsset {
  remoteUrl: string;
  contentType: string;
  bytes: Uint8Array;
}

export const DEFAULT_ASSET_LOCALIZATION_POLICY: AssetLocalizationPolicy = {
  maxAssetBytes: 8 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024,
  timeoutMs: 10_000,
  maxRedirects: 3,
  allowSyntheticDns: false
};

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif"
]);

const MAX_URL_LENGTH = 2_048;

function fail(code: ConstructorParameters<typeof FileChannelError>[0], message: string): never {
  throw new FileChannelError(code, message);
}

function parseHttpUrl(value: string, errorCode: "ASSET_URL_INVALID" | "ASSET_REDIRECT_BLOCKED"): URL {
  if (value.length === 0 || value.length > MAX_URL_LENGTH) {
    return fail(errorCode, "图片 URL 无效");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(errorCode, "图片 URL 无效");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hostname.length === 0
  ) {
    return fail(errorCode, "图片 URL 必须是无凭据的 HTTP 或 HTTPS URL");
  }
  return url;
}

function parseIPv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/u.test(part)) {
      return -1;
    }
    const octet = Number(part);
    return octet <= 255 ? octet : -1;
  });
  return octets.every((octet) => octet >= 0) ? octets : null;
}

function isBlockedIPv4(value: string): boolean {
  const parts = parseIPv4(value);
  if (!parts) {
    return true;
  }
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  const third = parts[2] ?? -1;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 &&
      ((second === 0 && (third === 0 || third === 2)) ||
        (second === 88 && third === 99) ||
        second === 168)) ||
    (first === 198 &&
      ((second >= 18 && second <= 19) || (second === 51 && third === 100))) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function parseIPv6(value: string): number[] | null {
  const withoutZone = value.replace(/^\[|\]$/gu, "").split("%")[0];
  if (!withoutZone || withoutZone.includes("%")) {
    return null;
  }

  const embeddedIPv4Index = withoutZone.lastIndexOf(":");
  let address = withoutZone;
  if (embeddedIPv4Index >= 0 && withoutZone.slice(embeddedIPv4Index + 1).includes(".")) {
    const embedded = parseIPv4(withoutZone.slice(embeddedIPv4Index + 1));
    if (!embedded) {
      return null;
    }
    const high = (((embedded[0] ?? 0) << 8) | (embedded[1] ?? 0)).toString(16);
    const low = (((embedded[2] ?? 0) << 8) | (embedded[3] ?? 0)).toString(16);
    address = `${withoutZone.slice(0, embeddedIPv4Index)}${high}:${low}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) {
    return null;
  }
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/iu.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/iu.test(part))) {
    return null;
  }
  if (halves.length === 1 && left.length !== 8) {
    return null;
  }
  if (halves.length === 2 && left.length + right.length >= 8) {
    return null;
  }

  const groups = [
    ...left,
    ...(halves.length === 2 ? Array.from({ length: 8 - left.length - right.length }, () => "0") : []),
    ...right
  ];
  const bytes: number[] = [];
  for (const group of groups) {
    const value16 = Number.parseInt(group, 16);
    bytes.push(value16 >> 8, value16 & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
}

function isBlockedIPv6(value: string): boolean {
  const bytes = parseIPv6(value);
  if (!bytes) {
    return true;
  }
  const byte0 = bytes[0] ?? -1;
  const byte1 = bytes[1] ?? -1;
  const byte2 = bytes[2] ?? -1;
  const byte3 = bytes[3] ?? -1;
  const byte10 = bytes[10] ?? -1;
  const byte11 = bytes[11] ?? -1;
  const byte12 = bytes[12] ?? -1;
  const byte13 = bytes[13] ?? -1;
  const byte14 = bytes[14] ?? -1;
  const byte15 = bytes[15] ?? -1;
  const isAllZero = bytes.every((byte) => byte === 0);
  const isLoopback = isAllZero && byte15 === 1;
  const isPrivate = (byte0 & 0xfe) === 0xfc;
  const isLinkLocal = byte0 === 0xfe && (byte1 & 0xc0) === 0x80;
  const isMulticast = byte0 === 0xff;
  const isMappedIPv4 = bytes.slice(0, 10).every((byte) => byte === 0) && byte10 === 0xff && byte11 === 0xff;
  const isCompatibleIPv4 = bytes.slice(0, 12).every((byte) => byte === 0);
  const mapped = `${byte12}.${byte13}.${byte14}.${byte15}`;
  const isReservedDocumentation =
    byte0 === 0x20 && byte1 === 0x01 && byte2 === 0x0d && byte3 === 0xb8;
  return (
    isAllZero ||
    isLoopback ||
    isPrivate ||
    isLinkLocal ||
    isMulticast ||
    (isMappedIPv4 && isBlockedIPv4(mapped)) ||
    (isCompatibleIPv4 && isBlockedIPv4(mapped)) ||
    isReservedDocumentation
  );
}

function isSyntheticIPv4(value: string): boolean {
  const parts = parseIPv4(value);
  return parts?.[0] === 198 && parts[1] !== undefined && parts[1] >= 18 && parts[1] <= 19;
}

function isSyntheticIPv6(value: string): boolean {
  const bytes = parseIPv6(value);
  return (
    bytes?.[0] === 0xfd &&
    bytes[1] === 0xfe &&
    bytes[2] === 0xdc &&
    bytes[3] === 0xba &&
    bytes[4] === 0x98 &&
    bytes[5] === 0x76
  );
}

function isSyntheticDnsAddress(value: string): boolean {
  return isSyntheticIPv4(value) || isSyntheticIPv6(value);
}

function isBlockedAddress(value: string, allowSyntheticDns: boolean): boolean {
  if (allowSyntheticDns && isSyntheticDnsAddress(value)) {
    return false;
  }

  const version = isIP(value);
  if (version === 4) {
    return isBlockedIPv4(value);
  }
  if (version === 6) {
    return isBlockedIPv6(value);
  }
  return true;
}

async function resolveAndValidateTarget(
  url: URL,
  fetcher: AssetFetcher,
  redirect: boolean,
  allowSyntheticDns: boolean
): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  const allowSyntheticDnsForHostname = allowSyntheticDns && isIP(hostname) === 0;
  const addresses = isIP(hostname)
    ? [hostname]
    : await (fetcher.resolveHost
        ? fetcher.resolveHost(hostname)
        : lookup(hostname, { all: true, verbatim: true }).then((records) => records.map((record) => record.address))
      ).catch(() => fail("ASSET_TARGET_BLOCKED", "图片目标地址不可访问"));

  if (
    addresses.length === 0 ||
    addresses.some((address) => isBlockedAddress(address, allowSyntheticDnsForHostname))
  ) {
    return fail(redirect ? "ASSET_REDIRECT_BLOCKED" : "ASSET_TARGET_BLOCKED", "图片目标地址被阻止");
  }
}

function contentTypeOf(response: Response): string {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return fail("ASSET_UNSUPPORTED_TYPE", "图片 MIME 类型不受支持");
  }
  return contentType;
}

function declaredLength(response: Response): number | null {
  const value = response.headers.get("content-length");
  if (!value || !/^\d+$/u.test(value.trim())) {
    return null;
  }
  return Number(value);
}

function combineChunks(chunks: Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function downloadAsset(
  candidate: ImageCandidate,
  policy: AssetLocalizationPolicy,
  fetcher: AssetFetcher,
  alreadyDownloadedBytes: number
): Promise<DownloadedAsset> {
  const candidateValue = candidate.remoteUrl.trim();
  let currentUrl = parseHttpUrl(candidateValue, "ASSET_URL_INVALID");
  if (alreadyDownloadedBytes >= policy.maxTotalBytes) {
    return fail("ASSET_TOTAL_TOO_LARGE", "图片总大小超出限制");
  }

  let redirectCount = 0;
  while (true) {
    await resolveAndValidateTarget(
      currentUrl,
      fetcher,
      redirectCount > 0,
      policy.allowSyntheticDns
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetcher.fetch(currentUrl.toString(), {
          signal: controller.signal,
          redirect: "manual",
          headers: { Accept: "image/*" }
        });
      } catch (error) {
        if (error instanceof FileChannelError) {
          throw error;
        }
        if (controller.signal.aborted || isAbortError(error)) {
          return fail("ASSET_TIMEOUT", "图片请求超时");
        }
        return fail("ASSET_DOWNLOAD_FAILED", "图片下载失败");
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return fail("ASSET_REDIRECT_BLOCKED", "图片重定向目标无效");
        }
        if (redirectCount >= policy.maxRedirects) {
          return fail("ASSET_REDIRECT_LIMIT", "图片重定向次数超出限制");
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return fail("ASSET_REDIRECT_BLOCKED", "图片重定向目标无效");
        }
        currentUrl = parseHttpUrl(nextUrl.toString(), "ASSET_REDIRECT_BLOCKED");
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        return fail("ASSET_DOWNLOAD_FAILED", "图片下载失败");
      }

      const contentType = contentTypeOf(response);
      const contentLength = declaredLength(response);
      const remainingTotal = policy.maxTotalBytes - alreadyDownloadedBytes;
      if (contentLength !== null && contentLength > policy.maxAssetBytes) {
        return fail("ASSET_TOO_LARGE", "单张图片超出大小限制");
      }
      if (contentLength !== null && contentLength > remainingTotal) {
        return fail("ASSET_TOTAL_TOO_LARGE", "图片总大小超出限制");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return { remoteUrl: currentUrl.toString(), contentType, bytes: new Uint8Array() };
      }

      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            break;
          }
          const chunk = next.value;
          const nextLength = length + chunk.byteLength;
          if (nextLength > policy.maxAssetBytes) {
            return fail("ASSET_TOO_LARGE", "单张图片超出大小限制");
          }
          if (nextLength > remainingTotal) {
            return fail("ASSET_TOTAL_TOO_LARGE", "图片总大小超出限制");
          }
          chunks.push(chunk);
          length = nextLength;
        }
      } catch (error) {
        if (error instanceof FileChannelError) {
          throw error;
        }
        if (controller.signal.aborted || isAbortError(error)) {
          return fail("ASSET_TIMEOUT", "图片请求超时");
        }
        return fail("ASSET_DOWNLOAD_FAILED", "图片下载失败");
      } finally {
        await reader.releaseLock();
      }

      return {
        remoteUrl: currentUrl.toString(),
        contentType,
        bytes: combineChunks(chunks, length)
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

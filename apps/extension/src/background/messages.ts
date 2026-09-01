import {
  validateRequest,
  type AssetSummary,
  type ArticlePayload,
  type ArticleRequest,
  type VaultConfigGetRequest,
  type VaultConfigSetRequest
} from "@capture-for-tolaria/protocol";

export const DEFAULT_RELATIVE_FOLDER = "Inbox/Web" as const;

export interface CaptureArticleMessage {
  type: "capture.article";
}

export interface ContentCaptureMessage {
  type: "extract.article";
  sourceUrl: string;
  clippedAt: string;
}

export interface ContentCaptureResultMessage {
  type: "capture.result";
  status: "saved";
  relativePath: string;
  summary?: AssetSummary;
  warnings?: string[];
}

export interface ContentCaptureErrorMessage {
  type: "capture.result";
  status: "error";
  code: string;
  message: string;
}

export type ContentMessage =
  | ContentCaptureMessage
  | ContentCaptureResultMessage
  | ContentCaptureErrorMessage;

export interface CaptureSuccessMessage {
  ok: true;
  relativePath: string;
  summary?: AssetSummary;
  warnings?: string[];
}

export interface CaptureErrorMessage {
  ok: false;
  code: string;
  message: string;
}

export type CaptureResponse = CaptureSuccessMessage | CaptureErrorMessage;

export function validateCaptureArticleMessage(
  value: unknown
): CaptureArticleMessage {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    value.type !== "capture.article"
  ) {
    throw new Error("只允许由 Extension UI 触发 Article Capture");
  }
  return { type: "capture.article" };
}

export function validateContentPayload(value: unknown): ArticlePayload {
  if (
    typeof value !== "object" ||
    value === null ||
    !("relativeFolder" in value) ||
    !("title" in value) ||
    !("markdown" in value) ||
    !("sourceUrl" in value) ||
    !("metadata" in value)
  ) {
    throw new Error("Content Script 返回的文章 payload 无效");
  }

  const payload = value as ArticlePayload;
  const request = validateRequest({
    protocolVersion: 1,
    requestId: "content-validation",
    extensionVersion: "0.1.0-beta.3",
    action: "clip.article",
    payload
  });
  if (request.action !== "clip.article") {
    throw new Error("Content Script 返回的 action 无效");
  }
  return request.payload;
}

export function createArticleRequest(
  payload: ArticlePayload,
  extensionVersion: string,
  requestId: string
): ArticleRequest {
  const request = validateRequest({
    protocolVersion: 1,
    requestId,
    extensionVersion,
    action: "clip.article",
    payload
  });
  if (request.action !== "clip.article") {
    throw new Error("无法创建 Article Capture 请求");
  }
  return request;
}

export function createVaultConfigGetRequest(
  extensionVersion: string,
  requestId: string
): VaultConfigGetRequest {
  const request = validateRequest({
    protocolVersion: 1,
    requestId,
    extensionVersion,
    action: "vault.config.get"
  });
  if (request.action !== "vault.config.get") {
    throw new Error("无法创建 Vault 配置读取请求");
  }
  return request;
}

export function createVaultConfigSetRequest(
  vaultRoot: string,
  extensionVersion: string,
  requestId: string
): VaultConfigSetRequest {
  const request = validateRequest({
    protocolVersion: 1,
    requestId,
    extensionVersion,
    action: "vault.config.set",
    payload: { vaultRoot }
  });
  if (request.action !== "vault.config.set") {
    throw new Error("无法创建 Vault 配置保存请求");
  }
  return request;
}

export function isHttpPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateCaptureResponse(value: unknown): CaptureResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    typeof value.ok !== "boolean"
  ) {
    throw new Error("Service Worker 返回的 Capture 响应无效");
  }
  if (value.ok === true) {
    if (!("relativePath" in value) || typeof value.relativePath !== "string") {
      throw new Error("Service Worker 成功响应缺少相对路径");
    }
    const response: CaptureSuccessMessage = {
      ok: true,
      relativePath: value.relativePath
    };
    if ("summary" in value) {
      if (!isAssetSummary(value.summary)) {
        throw new Error("Service Worker 成功响应的图片摘要无效");
      }
      response.summary = value.summary;
    }
    if ("warnings" in value) {
      if (!isWarnings(value.warnings)) {
        throw new Error("Service Worker 成功响应的图片 warning 无效");
      }
      response.warnings = value.warnings;
    }
    return response;
  }
  if (
    !("code" in value) ||
    typeof value.code !== "string" ||
    !("message" in value) ||
    typeof value.message !== "string"
  ) {
    throw new Error("Service Worker 错误响应无效");
  }
  return { ok: false, code: value.code, message: value.message };
}

function isAssetSummary(value: unknown): value is AssetSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "requested" in value &&
    "localized" in value &&
    "fallback" in value &&
    [value.requested, value.localized, value.fallback].every(
      (count) => typeof count === "number" && Number.isInteger(count) && count >= 0
    )
  );
}

function isWarnings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 128 &&
    value.every((warning) => typeof warning === "string" && warning.length <= 512)
  );
}

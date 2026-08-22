import { z } from "zod";
import { MAX_MARKDOWN_CHARACTERS } from "./schema.js";
import { PROTOCOL_VERSION } from "./types.js";

export type RequestValidationErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_PATH"
  | "INVALID_URL"
  | "PAYLOAD_TOO_LARGE";

export interface RequestValidationError {
  code: RequestValidationErrorCode;
  message: string;
}

function hasIssuePath(error: unknown, prefix: string): boolean {
  return (
    error instanceof z.ZodError &&
    error.issues.some((issue) => {
      const path = issue.path.join(".");
      return path === prefix || path.startsWith(`${prefix}.`);
    })
  );
}

export function classifyRequestValidationError(
  value: unknown,
  error: unknown
): RequestValidationError {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;

  if (
    candidate &&
    "protocolVersion" in candidate &&
    typeof candidate.protocolVersion === "number" &&
    candidate.protocolVersion !== PROTOCOL_VERSION
  ) {
    return {
      code: "UNSUPPORTED_PROTOCOL",
      message: "不支持的协议版本"
    };
  }

  if (hasIssuePath(error, "payload.relativeFolder")) {
    return {
      code: "INVALID_PATH",
      message: "relativeFolder 必须是安全的相对目录"
    };
  }

  if (hasIssuePath(error, "payload.sourceUrl")) {
    return {
      code: "INVALID_URL",
      message: "sourceUrl 必须是无凭据的 HTTP 或 HTTPS URL"
    };
  }

  const payload =
    candidate?.payload && typeof candidate.payload === "object"
      ? (candidate.payload as Record<string, unknown>)
      : null;
  if (
    payload &&
    typeof payload.markdown === "string" &&
    payload.markdown.length > MAX_MARKDOWN_CHARACTERS &&
    hasIssuePath(error, "payload.markdown")
  ) {
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: "markdown 超出长度限制"
    };
  }

  return {
    code: "INVALID_REQUEST",
    message: "请求格式无效"
  };
}

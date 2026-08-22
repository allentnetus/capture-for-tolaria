export const PACKAGE_NAME = "@capture-for-tolaria/protocol" as const;

export {
  PROTOCOL_VERSION,
  SUPPORTED_ACTIONS
} from "./types.js";
export type {
  ArticlePayload,
  ArticleRequest,
  CaptureAction,
  ClipErrorResponse,
  ClipRequest,
  ClipResponse,
  ClipSuccessResponse,
  HelloRequest,
  HelloResponse
} from "./types.js";

export {
  MAX_MARKDOWN_CHARACTERS,
  MAX_METADATA_KEY_LENGTH,
  MAX_METADATA_VALUE_LENGTH,
  MAX_RELATIVE_FOLDER_LENGTH,
  MAX_REQUEST_ID_LENGTH,
  MAX_RESPONSE_PATH_LENGTH,
  MAX_SOURCE_URL_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_VERSION_LENGTH,
  articlePayloadSchema,
  articleRequestSchema,
  errorResponseSchema,
  helloRequestSchema,
  helloResponseSchema,
  requestSchema,
  responseSchema,
  successResponseSchema
} from "./schema.js";

import {
  helloResponseSchema,
  requestSchema,
  responseSchema
} from "./schema.js";
import {
  PROTOCOL_VERSION,
  type ClipRequest,
  type ClipResponse,
  type HelloResponse
} from "./types.js";

export function validateRequest(value: unknown): ClipRequest {
  return requestSchema.parse(value) as ClipRequest;
}

export function validateResponse(value: unknown): ClipResponse {
  return responseSchema.parse(value) as ClipResponse;
}
export function validateHelloResponse(value: unknown): HelloResponse {
  return helloResponseSchema.parse(value) as HelloResponse;
}

export function createHelloResponse(
  version: string,
  capabilities: string[]
): HelloResponse {
  const trimmedVersion = version.trim();
  if (trimmedVersion.length === 0 || trimmedVersion.length > 64) {
    throw new Error("helperVersion 不能为空且不得超出长度限制");
  }

  const normalizedCapabilities = capabilities.map((capability) => {
    const normalized = capability.trim();
    if (normalized.length === 0 || normalized.length > 64) {
      throw new Error("capability 不能为空且不得超出长度限制");
    }
    return normalized;
  });

  return {
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: trimmedVersion,
    capabilities: [...new Set(normalizedCapabilities)]
  };
}

export const PROTOCOL_VERSION = 1 as const;

export const SUPPORTED_ACTIONS = ["hello", "clip.article"] as const;

export type CaptureAction = (typeof SUPPORTED_ACTIONS)[number];

export interface ArticlePayload {
  relativeFolder: string;
  title: string;
  markdown: string;
  sourceUrl: string;
  metadata: Record<string, string | undefined>;
}

export interface HelloRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  extensionVersion: string;
  action: "hello";
}

export interface ArticleRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  extensionVersion: string;
  action: "clip.article";
  payload: ArticlePayload;
}

export type ClipRequest = HelloRequest | ArticleRequest;

export interface ClipSuccessResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  helperVersion: string;
  ok: true;
  result: { relativePath: string };
}

export interface ClipErrorResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  helperVersion: string;
  ok: false;
  error: { code: string; message: string };
}

export type ClipResponse = ClipSuccessResponse | ClipErrorResponse;

export interface HelloResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  helperVersion: string;
  capabilities: string[];
}

export const PROTOCOL_VERSION = 1 as const;

export const SUPPORTED_ACTIONS = ["hello", "clip.article", "vault.config.get", "vault.config.set"] as const;

export type CaptureAction = (typeof SUPPORTED_ACTIONS)[number];

export interface ImageCandidate {
  remoteUrl: string;
  altText?: string;
}

export interface LocalizedAsset {
  remoteUrl: string;
  relativePath: string;
  contentType: string;
  byteLength: number;
}

export interface AssetSummary {
  requested: number;
  localized: number;
  fallback: number;
}

export interface ClipResult {
  relativePath: string;
  assets?: LocalizedAsset[];
  summary?: AssetSummary;
  warnings?: string[];
}

export interface ArticlePayload {
  relativeFolder: string;
  title: string;
  markdown: string;
  sourceUrl: string;
  metadata: Record<string, string | undefined>;
  images?: ImageCandidate[];
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

export interface VaultConfigGetRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  extensionVersion: string;
  action: "vault.config.get";
}

export interface VaultConfigSetRequest {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  extensionVersion: string;
  action: "vault.config.set";
  payload: { vaultRoot: string };
}

export type VaultConfigRequest = VaultConfigGetRequest | VaultConfigSetRequest;
export type ProtocolRequest = ClipRequest | VaultConfigRequest;

export interface ClipSuccessResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  helperVersion: string;
  ok: true;
  result: ClipResult;
}

export interface ClipErrorResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  helperVersion: string;
  ok: false;
  error: { code: string; message: string };
}

export type ClipResponse = ClipSuccessResponse | ClipErrorResponse;

export interface VaultConfigSuccessResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  requestId: string;
  helperVersion: string;
  ok: true;
  result: { vaultRoot: string };
}

export type VaultConfigResponse = VaultConfigSuccessResponse | ClipErrorResponse;

export interface HelloResponse {
  protocolVersion: typeof PROTOCOL_VERSION;
  helperVersion: string;
  capabilities: string[];
}

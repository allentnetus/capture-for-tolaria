import {
  createHelloResponse,
  classifyRequestValidationError,
  MAX_REQUEST_ID_LENGTH,
  PROTOCOL_VERSION,
  validateRequest,
  type ClipErrorResponse,
  type ClipRequest,
  type ClipResponse,
  type HelloResponse
} from "@capture-for-tolaria/protocol";
import { writeMarkdownCreateOnly, type WriteInput, type WriteResult } from "./atomic-create-writer.js";
import {
  writeCaptureBundleCreateOnly,
  type CaptureBundleInput,
  type CaptureBundleWriteResult
} from "./atomic-create-writer.js";
import { localizeArticleImages } from "./article-image-localizer.js";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  type AssetFetcher
} from "./asset-downloader.js";
import { FileChannelError } from "./errors.js";
import { resolveConfiguredVaultConfig } from "./vault-resolver.js";

export type HelperResponse = ClipResponse | HelloResponse;

export interface RequestHandlerOptions {
  helperVersion?: string;
  capabilities?: string[];
  getVault?: () => Promise<string | null>;
  writeMarkdown?: (input: WriteInput) => Promise<WriteResult>;
  writeCaptureBundle?: (
    input: CaptureBundleInput
  ) => Promise<CaptureBundleWriteResult>;
  assetFetcher?: AssetFetcher;
}

const DEFAULT_HELPER_VERSION = "0.1.0-beta.1";
const DEFAULT_CAPABILITIES = ["clip.article", "direct-file"];

const DEFAULT_ASSET_FETCHER: AssetFetcher = {
  fetch: (url, init) => globalThis.fetch(url, init)
};

function errorResponse(
  requestId: string,
  helperVersion: string,
  code: string,
  message: string
): ClipErrorResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    helperVersion,
    ok: false,
    error: { code, message }
  };
}

function mapError(error: unknown): { code: string; message: string } {
  if (error instanceof FileChannelError) {
    return { code: error.code, message: error.userMessage };
  }
  return { code: "WRITE_FAILED", message: "无法保存剪藏内容" };
}

function getCorrelationRequestId(value: unknown): string {
  if (typeof value !== "object" || value === null || !("requestId" in value)) {
    return "unknown";
  }

  const requestId = value.requestId;
  if (typeof requestId !== "string") {
    return "unknown";
  }

  const normalized = requestId.trim();
  return normalized.length > 0 && normalized.length <= MAX_REQUEST_ID_LENGTH
    ? normalized
    : "unknown";
}

export async function handleRequest(
  request: ClipRequest,
  options: RequestHandlerOptions = {}
): Promise<HelperResponse> {
  const helperVersion = options.helperVersion ?? DEFAULT_HELPER_VERSION;
  const capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;

  if (request.action === "hello") {
    return createHelloResponse(helperVersion, capabilities);
  }

  try {
    let configuredVault: string | null;
    let allowSyntheticDns = false;
    if (options.getVault) {
      configuredVault = await options.getVault();
    } else {
      const configured = await resolveConfiguredVaultConfig();
      configuredVault = configured.vaultRoot;
      allowSyntheticDns = configured.allowSyntheticDns === true;
    }
    if (!configuredVault) {
      return errorResponse(
        request.requestId,
        helperVersion,
        "VAULT_NOT_CONFIGURED",
        "尚未配置 Tolaria Vault"
      );
    }

    if (request.payload.images !== undefined) {
      const localized = await localizeArticleImages(
        request.payload.markdown,
        request.payload.images,
        { ...DEFAULT_ASSET_LOCALIZATION_POLICY, allowSyntheticDns },
        options.assetFetcher ?? DEFAULT_ASSET_FETCHER
      );
      const bundleWriter = options.writeCaptureBundle ?? writeCaptureBundleCreateOnly;
      const result = await bundleWriter({
        vaultRoot: configuredVault,
        relativeFolder: request.payload.relativeFolder,
        title: request.payload.title,
        markdown: localized.markdown,
        assets: localized.assets
      });
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        helperVersion,
        ok: true,
        result: {
          relativePath: result.relativePath,
          assets: result.assets,
          summary: localized.summary,
          warnings: localized.warnings
        }
      };
    }

    const writer = options.writeMarkdown ?? writeMarkdownCreateOnly;
    const result = await writer({
      vaultRoot: configuredVault,
      relativeFolder: request.payload.relativeFolder,
      title: request.payload.title,
      markdown: request.payload.markdown
    });
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      helperVersion,
      ok: true,
      result: { relativePath: result.relativePath }
    };
  } catch (error) {
    const mapped = mapError(error);
    return errorResponse(request.requestId, helperVersion, mapped.code, mapped.message);
  }
}

export async function handleRawRequest(
  value: unknown,
  options: RequestHandlerOptions = {}
): Promise<HelperResponse> {
  let request: ClipRequest;
  try {
    request = validateRequest(value);
  } catch (error) {
    const helperVersion = options.helperVersion ?? DEFAULT_HELPER_VERSION;
    const validationError = classifyRequestValidationError(value, error);
    return errorResponse(
      getCorrelationRequestId(value),
      helperVersion,
      validationError.code,
      validationError.message
    );
  }

  return handleRequest(request, options);
}

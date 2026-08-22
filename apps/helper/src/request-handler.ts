import {
  createHelloResponse,
  validateRequest,
  type ClipErrorResponse,
  type ClipRequest,
  type ClipResponse,
  type HelloResponse
} from "@capture-for-tolaria/protocol";
import { writeMarkdownCreateOnly, type WriteInput, type WriteResult } from "./atomic-create-writer.js";
import { FileChannelError } from "./errors.js";
import { resolveConfiguredVault } from "./vault-resolver.js";

export type HelperResponse = ClipResponse | HelloResponse;

export interface RequestHandlerOptions {
  helperVersion?: string;
  capabilities?: string[];
  getVault?: () => Promise<string | null>;
  writeMarkdown?: (input: WriteInput) => Promise<WriteResult>;
}

const DEFAULT_HELPER_VERSION = "0.1.0-alpha.1";
const DEFAULT_CAPABILITIES = ["clip.article", "direct-file"];

function errorResponse(
  requestId: string,
  helperVersion: string,
  code: string,
  message: string
): ClipErrorResponse {
  return {
    protocolVersion: 1,
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
    const configuredVault = options.getVault
      ? await options.getVault()
      : await resolveConfiguredVault();
    if (!configuredVault) {
      return errorResponse(
        request.requestId,
        helperVersion,
        "VAULT_NOT_CONFIGURED",
        "尚未配置 Tolaria Vault"
      );
    }

    const writer = options.writeMarkdown ?? writeMarkdownCreateOnly;
    const result = await writer({
      vaultRoot: configuredVault,
      relativeFolder: request.payload.relativeFolder,
      title: request.payload.title,
      markdown: request.payload.markdown
    });
    return {
      protocolVersion: 1,
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
  try {
    const request = validateRequest(value);
    return await handleRequest(request, options);
  } catch {
    const helperVersion = options.helperVersion ?? DEFAULT_HELPER_VERSION;
    return errorResponse("unknown", helperVersion, "INVALID_REQUEST", "请求格式无效");
  }
}

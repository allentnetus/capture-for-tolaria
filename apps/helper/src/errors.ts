export type FileChannelErrorCode =
  | "VAULT_NOT_CONFIGURED"
  | "VAULT_ACCESS_DENIED"
  | "INVALID_PATH"
  | "TARGET_EXISTS"
  | "NAME_EXHAUSTED"
  | "ATOMIC_COMMIT_UNAVAILABLE"
  | "WRITE_FAILED"
  | "ASSET_URL_INVALID"
  | "ASSET_TARGET_BLOCKED"
  | "ASSET_REDIRECT_BLOCKED"
  | "ASSET_REDIRECT_LIMIT"
  | "ASSET_UNSUPPORTED_TYPE"
  | "ASSET_TOO_LARGE"
  | "ASSET_TOTAL_TOO_LARGE"
  | "ASSET_TIMEOUT"
  | "ASSET_DOWNLOAD_FAILED";

export class FileChannelError extends Error {
  readonly code: FileChannelErrorCode;
  readonly userMessage: string;

  constructor(
    code: FileChannelErrorCode,
    userMessage: string,
    options?: { cause?: unknown }
  ) {
    super(userMessage, options);
    this.name = "FileChannelError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

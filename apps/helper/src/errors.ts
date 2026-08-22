export type FileChannelErrorCode =
  | "VAULT_NOT_CONFIGURED"
  | "VAULT_ACCESS_DENIED"
  | "INVALID_PATH"
  | "TARGET_EXISTS"
  | "NAME_EXHAUSTED"
  | "ATOMIC_COMMIT_UNAVAILABLE"
  | "WRITE_FAILED";

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

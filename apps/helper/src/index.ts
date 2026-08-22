export const PACKAGE_NAME = "@capture-for-tolaria/helper" as const;

export const HELPER_ACTIONS = ["hello", "clip.article"] as const;

export type HelperAction = (typeof HELPER_ACTIONS)[number];

export {
  writeMarkdownCreateOnly,
  type WriteInput,
  type WriteResult
} from "./atomic-create-writer.js";
export {
  FileChannelError,
  type FileChannelErrorCode
} from "./errors.js";
export {
  handleRawRequest,
  handleRequest,
  type HelperResponse,
  type RequestHandlerOptions
} from "./request-handler.js";
export {
  assertNoReparsePoint,
  assertSafeFilename,
  prepareVaultDirectory,
  relativePathFromVault,
  type PreparedVaultDirectory
} from "./path-sandbox.js";
export {
  addConflictSuffix,
  buildMarkdownFilename,
  sanitizeTitle
} from "./filename.js";
export {
  getConfigPath,
  getConfiguredVault,
  setConfiguredVault,
  validateConfiguredVault,
  type VaultConfig
} from "./vault-config.js";
export { resolveConfiguredVault } from "./vault-resolver.js";
export {
  MAX_NATIVE_MESSAGE_BYTES,
  NativeMessageParser,
  NativeMessagingError,
  encodeNativeMessage,
  readNativeMessages,
  writeNativeMessage,
  type NativeMessagingErrorCode
} from "./native-messaging.js";

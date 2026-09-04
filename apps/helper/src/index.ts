export const PACKAGE_NAME = "@capture-for-tolaria/helper" as const;

export const HELPER_ACTIONS = [
  "hello",
  "clip.article",
  "vault.config.get",
  "vault.config.set"
] as const;

export type HelperAction = (typeof HELPER_ACTIONS)[number];

export {
  writeCaptureBundleCreateOnly,
  writeMarkdownCreateOnly,
  type CaptureBundleInput,
  type CaptureBundleWriteResult,
  type WriteInput,
  type WriteResult
} from "./atomic-create-writer.js";
export {
  FileChannelError,
  type FileChannelErrorCode
} from "./errors.js";
export {
  DEFAULT_ASSET_FETCHER,
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  downloadAsset,
  type AssetFetcher,
  type AssetFetchInit,
  type AssetLocalizationPolicy,
  type DownloadedAsset
} from "./asset-downloader.js";
export {
  localizeArticleImages,
  type ImageLocalizationResult,
  type PreparedAsset
} from "./article-image-localizer.js";
export {
  handleRawRequest,
  handleRequest,
  type HelperResponse,
  type RequestHandlerOptions
} from "./request-handler.js";
export {
  assertNoReparsePoint,
  assertSafeFilename,
  prepareVaultAssetsDirectory,
  prepareVaultDirectory,
  relativePathFromVault,
  type PathSandboxOptions,
  type PreparedVaultDirectory
} from "./path-sandbox.js";
export {
  addConflictSuffix,
  buildMarkdownFilename,
  sanitizeTitle
} from "./filename.js";
export {
  getConfigPath,
  getConfiguredVaultConfig,
  getConfiguredVault,
  setConfiguredVault,
  validateConfiguredVault,
  type VaultConfig
} from "./vault-config.js";
export {
  getPlatformPaths,
  type PlatformPathOptions,
  type PlatformPaths
} from "./platform-paths.js";
export {
  resolveConfiguredVault,
  resolveConfiguredVaultConfig
} from "./vault-resolver.js";
export {
  MAX_NATIVE_MESSAGE_BYTES,
  NativeMessageParser,
  NativeMessagingError,
  encodeNativeMessage,
  readNativeMessages,
  writeNativeMessage,
  type NativeMessagingErrorCode
} from "./native-messaging.js";

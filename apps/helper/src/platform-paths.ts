import { homedir } from "node:os";
import { posix, win32 } from "node:path";

const HOST_NAME = "com.capture_for_tolaria.helper";
const APP_DATA_DIRECTORY = "CaptureForTolaria";

export interface PlatformPaths {
  configPath: string;
  nativeHostManifestPath: string;
  installRoot: string;
  helperFileName: string;
}

export interface PlatformPathOptions {
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  environment?: NodeJS.ProcessEnv;
}

function valueOrEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

function homeDirectory(
  platform: NodeJS.Platform,
  options: PlatformPathOptions,
  environment: NodeJS.ProcessEnv
): string {
  const explicitHome = valueOrEmpty(options.homeDirectory);
  if (explicitHome) {
    return explicitHome;
  }

  const environmentHome = valueOrEmpty(
    platform === "win32" ? environment.USERPROFILE : environment.HOME
  );
  return environmentHome || homedir();
}

export function getPlatformPaths(
  options: PlatformPathOptions = {}
): PlatformPaths {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;

  if (platform === "darwin") {
    const path = posix;
    const home = homeDirectory(platform, options, environment);
    const applicationData = path.join(
      home,
      "Library",
      "Application Support",
      APP_DATA_DIRECTORY
    );
    const configOverride = valueOrEmpty(
      environment.CAPTURE_FOR_TOLARIA_CONFIG_PATH
    );

    return {
      configPath: configOverride
        ? path.resolve(configOverride)
        : path.join(applicationData, "config.json"),
      nativeHostManifestPath: path.join(
        home,
        "Library",
        "Application Support",
        "Google",
        "Chrome",
        "NativeMessagingHosts",
        `${HOST_NAME}.json`
      ),
      installRoot: path.join(applicationData, "Helper"),
      helperFileName: "capture-for-tolaria-helper"
    };
  }

  if (platform === "win32") {
    const path = win32;
    const home = homeDirectory(platform, options, environment);
    const localAppData =
      valueOrEmpty(environment.LOCALAPPDATA) ||
      path.join(home, "AppData", "Local");
    const configOverride = valueOrEmpty(
      environment.CAPTURE_FOR_TOLARIA_CONFIG_PATH
    );

    return {
      configPath: configOverride
        ? path.resolve(configOverride)
        : path.join(localAppData, APP_DATA_DIRECTORY, "config.json"),
      nativeHostManifestPath: path.join(
        localAppData,
        APP_DATA_DIRECTORY,
        "native-host",
        `${HOST_NAME}.json`
      ),
      installRoot: path.join(
        localAppData,
        "Programs",
        APP_DATA_DIRECTORY
      ),
      helperFileName: "capture-for-tolaria-helper.exe"
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

import { expect, it } from "vitest";
import { getPlatformPaths } from "../src/platform-paths.js";

it("为 macOS 返回用户级配置、Chrome Native Host 和独立 Helper 路径", () => {
  const paths = getPlatformPaths({
    platform: "darwin",
    homeDirectory: "/Users/tester",
    environment: { HOME: "/Users/tester" }
  });

  expect(paths).toEqual({
    configPath:
      "/Users/tester/Library/Application Support/CaptureForTolaria/config.json",
    nativeHostManifestPath:
      "/Users/tester/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.capture_for_tolaria.helper.json",
    installRoot:
      "/Users/tester/Library/Application Support/CaptureForTolaria/Helper",
    helperFileName: "capture-for-tolaria-helper"
  });
});

it("macOS 的配置覆盖只改变 configPath", () => {
  const paths = getPlatformPaths({
    platform: "darwin",
    homeDirectory: "/Users/tester",
    environment: {
      HOME: "/Users/tester",
      CAPTURE_FOR_TOLARIA_CONFIG_PATH:
        "/Users/tester/Library/Application Support/custom-config.json"
    }
  });

  expect(paths.configPath).toBe(
    "/Users/tester/Library/Application Support/custom-config.json"
  );
  expect(paths.nativeHostManifestPath).toContain(
    "/Users/tester/Library/Application Support/Google/Chrome/NativeMessagingHosts/"
  );
  expect(paths.installRoot).toBe(
    "/Users/tester/Library/Application Support/CaptureForTolaria/Helper"
  );
});

it("保留 Windows 的 LOCALAPPDATA 路径语义", () => {
  const paths = getPlatformPaths({
    platform: "win32",
    homeDirectory: String.raw`C:\Users\tester`,
    environment: {
      LOCALAPPDATA: String.raw`C:\Users\tester\AppData\Local`
    }
  });

  expect(paths).toEqual({
    configPath: String.raw`C:\Users\tester\AppData\Local\CaptureForTolaria\config.json`,
    nativeHostManifestPath: String.raw`C:\Users\tester\AppData\Local\CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json`,
    installRoot: String.raw`C:\Users\tester\AppData\Local\Programs\CaptureForTolaria`,
    helperFileName: "capture-for-tolaria-helper.exe"
  });
});

it("Windows 缺少 LOCALAPPDATA 时沿用用户主目录 fallback", () => {
  const paths = getPlatformPaths({
    platform: "win32",
    homeDirectory: String.raw`C:\Users\tester`,
    environment: {}
  });

  expect(paths.configPath).toBe(
    String.raw`C:\Users\tester\AppData\Local\CaptureForTolaria\config.json`
  );
});

it("不支持的平台显式失败而不是套用 Windows 路径", () => {
  expect(() =>
    getPlatformPaths({
      platform: "linux",
      homeDirectory: "/home/tester",
      environment: { HOME: "/home/tester" }
    })
  ).toThrow(/unsupported platform/i);
});

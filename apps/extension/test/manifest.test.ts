import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const extensionRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(extensionRoot, "manifest.json"), "utf8")
) as {
  key?: string;
  permissions?: string[];
  host_permissions?: string[];
  icons?: Record<string, string>;
  action?: {
    default_icon?: Record<string, string>;
  };
  [key: string]: unknown;
};

function extensionIdFromPublicKey(publicKey: string): string {
  const digest = createHash("sha256")
    .update(Buffer.from(publicKey, "base64"))
    .digest();
  return Array.from(digest.subarray(0, 16), (byte) =>
    String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))
  ).join("");
}

it("声明设置页所需的最小权限", () => {
  expect(manifest.version).toBe("0.1.0");
  expect(manifest.version_name).toBe("0.1.0 Beta 4");
  expect(manifest.permissions).toEqual([
    "activeTab",
    "scripting",
    "nativeMessaging",
    "storage"
  ]);
  expect(manifest.options_page).toBe("options.html");
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest).not.toHaveProperty("cookies");
  expect(manifest).not.toHaveProperty("history");
});

it("使用固定公开 key 且与 Native Host allowed_origins 一致", () => {
  expect(manifest.key).toBeTruthy();
  const extensionId = extensionIdFromPublicKey(manifest.key ?? "");
  expect(extensionId).toBe("ncjeeembmcgkfjipkfhganbdnadbhdcl");

  const hostTemplate = JSON.parse(
    readFileSync(
      join(extensionRoot, "../../installer/windows/native-host-manifest.json.in"),
      "utf8"
    )
  ) as { allowed_origins?: string[] };
  expect(hostTemplate.allowed_origins).toEqual([
    `chrome-extension://${extensionId}/`
  ]);
});

it("声明可加载的多尺寸扩展图标", () => {
  const expectedIcons = {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  };

  expect(manifest.icons).toEqual(expectedIcons);
  expect(manifest.action?.default_icon).toEqual(expectedIcons);

  for (const [size, relativePath] of Object.entries(expectedIcons)) {
    const pngPath = join(extensionRoot, "public", relativePath);
    expect(existsSync(pngPath)).toBe(true);

    const png = readFileSync(pngPath);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    expect(png.readUInt32BE(16)).toBe(Number(size));
    expect(png.readUInt32BE(20)).toBe(Number(size));
  }
});

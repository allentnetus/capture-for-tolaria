export const PACKAGE_NAME = "@capture-for-tolaria/shared" as const;

export const V0_1_SCOPE = {
  platform: "windows",
  browser: "chrome",
  captureMode: "article",
  channel: "direct-file"
} as const;

export type V0_1Scope = typeof V0_1_SCOPE;

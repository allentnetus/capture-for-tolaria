import { expect, it } from "vitest";
import { PACKAGE_NAME, V0_1_SCOPE } from "../src/index.js";

it("公开冻结的 V0.1 产品边界", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/shared");
  expect(V0_1_SCOPE).toEqual({
    platform: "windows",
    browser: "chrome",
    captureMode: "article",
    channel: "direct-file"
  });
});

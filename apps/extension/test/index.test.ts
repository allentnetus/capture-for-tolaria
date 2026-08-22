import { expect, it } from "vitest";
import {
  PACKAGE_NAME,
  REQUIRED_MV3_PERMISSIONS
} from "../src/index.js";

it("公开最小化的 MV3 权限集合", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/extension");
  expect(REQUIRED_MV3_PERMISSIONS).toEqual([
    "activeTab",
    "scripting",
    "nativeMessaging"
  ]);
});

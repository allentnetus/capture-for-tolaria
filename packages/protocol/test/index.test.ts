import { expect, it } from "vitest";
import {
  PACKAGE_NAME,
  PROTOCOL_VERSION,
  SUPPORTED_ACTIONS
} from "../src/index.js";

it("公开 V0.1 协议版本和业务 action", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/protocol");
  expect(PROTOCOL_VERSION).toBe(1);
  expect(SUPPORTED_ACTIONS).toEqual(["hello", "clip.article", "vault.config.get", "vault.config.set"]);
});

import { expect, it } from "vitest";
import {
  HELPER_ACTIONS,
  PACKAGE_NAME
} from "../src/index.js";

it("公开受限的 Helper 业务 action", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/helper");
  expect(HELPER_ACTIONS).toEqual([
    "hello",
    "clip.article",
    "vault.config.get",
    "vault.config.set"
  ]);
});

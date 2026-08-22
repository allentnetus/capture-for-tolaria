import { expect, it } from "vitest";
import {
  EXTRACTION_STEPS,
  PACKAGE_NAME
} from "../src/index.js";

it("公开安全的 Article 提取管线顺序", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/extractor");
  expect(EXTRACTION_STEPS).toEqual([
    "clone-dom",
    "readability",
    "quality-check",
    "sanitize",
    "dom-cleanup"
  ]);
});

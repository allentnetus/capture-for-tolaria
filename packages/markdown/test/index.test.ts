import { expect, it } from "vitest";
import {
  FRONTMATTER_REQUIRED_FIELDS,
  MARKDOWN_FORMAT,
  PACKAGE_NAME
} from "../src/index.js";

it("公开 V0.1 Markdown 输出约束", () => {
  expect(PACKAGE_NAME).toBe("@capture-for-tolaria/markdown");
  expect(MARKDOWN_FORMAT).toBe("turndown-gfm");
  expect(FRONTMATTER_REQUIRED_FIELDS).toEqual([
    "title",
    "source_url",
    "clipped",
    "type"
  ]);
});

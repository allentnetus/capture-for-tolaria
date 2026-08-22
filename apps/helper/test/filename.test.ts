import { expect, it } from "vitest";
import {
  addConflictSuffix,
  buildMarkdownFilename,
  sanitizeTitle
} from "../src/index.js";

it("清理 Windows 非法字符并保留 Unicode 可读性", () => {
  expect(sanitizeTitle('  「Capture」: Tolaria / Web?  ')).toBe(
    "「Capture」- Tolaria - Web-"
  );
  expect(sanitizeTitle("   ")).toBe("Untitled");
  expect(sanitizeTitle("CON")).toBe("_CON");
  expect(sanitizeTitle("报告. ")).toBe("报告");
});

it("生成确定性的日期文件名和冲突后缀", () => {
  const date = new Date(2026, 7, 21, 12, 30);
  const filename = buildMarkdownFilename("Article", date);
  expect(filename).toBe("20260821 - Article.md");
  expect(addConflictSuffix(filename, 1)).toBe(filename);
  expect(addConflictSuffix(filename, 2)).toBe("20260821 - Article (2).md");
});

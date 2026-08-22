import { mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  FileChannelError,
  writeMarkdownCreateOnly
} from "../src/index.js";

async function temporaryVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "capture-for-tolaria-writer-"));
}

const capturedAt = new Date(2026, 7, 21, 12, 30);

it("不会覆盖已有 Markdown 并使用冲突后缀", async () => {
  const vault = await temporaryVault();
  try {
    const first = await writeMarkdownCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: "first",
      capturedAt
    });
    const second = await writeMarkdownCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: "second",
      capturedAt
    });

    expect(first.relativePath).toBe("Inbox/Web/20260821 - Article.md");
    expect(second.relativePath).toBe("Inbox/Web/20260821 - Article (2).md");
    expect(await readFile(join(vault, first.relativePath), "utf8")).toBe("first");
    expect(await readFile(join(vault, second.relativePath), "utf8")).toBe("second");
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("并发创建不会选择同一个最终路径且清理临时文件", async () => {
  const vault = await temporaryVault();
  try {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        writeMarkdownCreateOnly({
          vaultRoot: vault,
          relativeFolder: "Inbox/Web",
          title: "Concurrent",
          markdown: `content-${index}`,
          capturedAt
        })
      )
    );
    const paths = new Set(results.map((result) => result.relativePath));
    expect(paths.size).toBe(6);
    const files = await readdir(join(vault, "Inbox", "Web"));
    expect(files.filter((file) => file.includes(".capture-for-tolaria-")).length).toBe(0);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("路径逃逸在 Writer 前被拒绝", async () => {
  const vault = await temporaryVault();
  try {
    await expect(writeMarkdownCreateOnly({
      vaultRoot: vault,
      relativeFolder: "../outside",
      title: "Article",
      markdown: "content",
      capturedAt
    })).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
});

it("拒绝最终目标文件上的 reparse point", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    const directory = join(vault, "Inbox", "Web");
    await writeMarkdownCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Seed",
      markdown: "seed",
      capturedAt
    });
    const target = join(directory, "20260821 - Article.md");
    await symlink(outside, target, "junction");

    await expect(writeMarkdownCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: "content",
      capturedAt
    })).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

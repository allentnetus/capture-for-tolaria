import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  FileChannelError,
  writeCaptureBundleCreateOnly,
  writeMarkdownCreateOnly,
  type PreparedAsset
} from "../src/index.js";

async function temporaryVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "capture-for-tolaria-writer-"));
}

const capturedAt = new Date(2026, 7, 21, 12, 30);

function preparedAsset(
  relativePath = "Assets/039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.png",
  bytes = new Uint8Array([1, 2, 3])
): PreparedAsset {
  return {
    remoteUrl: "https://public.example/image.png",
    relativePath,
    contentType: "image/png",
    byteLength: bytes.byteLength,
    content: bytes
  };
}

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
}, 30_000);

it("图片剪藏才创建 Assets 并写入资源元数据", async () => {
  const vault = await temporaryVault();
  try {
    const asset = preparedAsset();
    const result = await writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article with image",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt
    });

    expect(result.relativePath).toBe("Inbox/Web/20260821 - Article with image.md");
    expect(result.assets).toEqual([{
      remoteUrl: asset.remoteUrl,
      relativePath: "Inbox/Web/Assets/039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.png",
      contentType: asset.contentType,
      byteLength: asset.byteLength
    }]);
    expect(await readFile(join(vault, "Inbox/Web", asset.relativePath), "utf8")).toBe(
      "\u0001\u0002\u0003"
    );
    expect(await readdir(join(vault, "Inbox/Web/Assets"))).toEqual([
      "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.png"
    ]);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("重复剪藏复用同一个内容寻址 Asset 且不覆盖原资源", async () => {
  const vault = await temporaryVault();
  try {
    const asset = preparedAsset();
    await writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Repeated article",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt
    });
    const second = await writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Repeated article",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt
    });

    expect(second.relativePath).toBe("Inbox/Web/20260821 - Repeated article (2).md");
    expect(await readdir(join(vault, "Inbox/Web/Assets"))).toHaveLength(1);
    expect(await readFile(join(vault, "Inbox/Web", asset.relativePath))).toEqual(
      Buffer.from([1, 2, 3])
    );
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("已有内容寻址 Asset 内容不匹配时拒绝复用", async () => {
  const vault = await temporaryVault();
  try {
    const asset = preparedAsset();
    const assetPath = join(vault, "Inbox", "Web", asset.relativePath);
    await mkdir(join(vault, "Inbox", "Web", "Assets"), { recursive: true });
    await writeFile(assetPath, new Uint8Array([9]));

    await expect(writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Corrupted asset",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt
    })).rejects.toMatchObject({ code: "WRITE_FAILED" });

    await expect(readFile(assetPath)).resolves.toEqual(Buffer.from([9]));
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("Markdown 提交失败时只清理本次创建且未被引用的 Asset", async () => {
  const vault = await temporaryVault();
  try {
    const markdownDirectory = join(vault, "Inbox", "Web");
    await mkdir(markdownDirectory, { recursive: true });
    const asset = preparedAsset();

    await expect(writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Broken",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt: new Date(Number.NaN)
    })).rejects.toThrow(FileChannelError);

    await expect(
      readFile(join(vault, "Inbox/Web", asset.relativePath))
    ).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("拒绝 Assets 目录上的 reparse point", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    await mkdir(join(vault, "Inbox", "Web"), { recursive: true });
    await symlink(outside, join(vault, "Inbox", "Web", "Assets"), "junction");

    await expect(writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: "![Image](Assets/image.png)",
      assets: [preparedAsset()],
      capturedAt
    })).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}, 30_000);

it("拒绝目标 Asset 上的 reparse point", async () => {
  const vault = await temporaryVault();
  const outside = await temporaryVault();
  try {
    await mkdir(join(vault, "Inbox", "Web", "Assets"), { recursive: true });
    const asset = preparedAsset();
    await symlink(
      outside,
      join(vault, "Inbox", "Web", asset.relativePath),
      "junction"
    );

    await expect(writeCaptureBundleCreateOnly({
      vaultRoot: vault,
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: `![Image](${asset.relativePath})`,
      assets: [asset],
      capturedAt
    })).rejects.toThrow(FileChannelError);
  } finally {
    await rm(vault, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}, 30_000);

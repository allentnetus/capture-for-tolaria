import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  localizeArticleImages,
  type AssetFetcher,
  type AssetLocalizationPolicy
} from "../src/index.js";

const policy: AssetLocalizationPolicy = {
  ...DEFAULT_ASSET_LOCALIZATION_POLICY,
  maxAssetBytes: 16,
  maxTotalBytes: 32,
  timeoutMs: 100
};

function fakeFetcher(
  responses: Record<string, Response | Error>
): AssetFetcher & { fetch: ReturnType<typeof vi.fn> } {
  return {
    fetch: vi.fn(async (url: string) => {
      const result = responses[url];
      if (result instanceof Error) {
        throw result;
      }
      if (!result) {
        throw new Error(`unexpected URL: ${url}`);
      }
      return result;
    }),
    resolveHost: vi.fn(async () => ["93.184.216.34"])
  };
}

function imageResponse(bytes: Uint8Array, contentType = "image/png"): Response {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": contentType }
  });
}

function assetPath(bytes: Uint8Array, extension = "png"): string {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return `Assets/${hash}.${extension}`;
}

it("成功下载后将 Markdown 图片改为内容寻址的 Assets 引用", async () => {
  const remoteUrl = "https://public.example/hero.png";
  const bytes = new Uint8Array([1, 2, 3]);
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(bytes) });

  const result = await localizeArticleImages(
    `# Article\n\n![Hero](${remoteUrl})`,
    [{ remoteUrl, altText: "Hero" }],
    policy,
    fetcher
  );

  expect(result.markdown).toBe(`# Article\n\n![Hero](${assetPath(bytes)})`);
  expect(result.assets).toMatchObject([{
    remoteUrl,
    relativePath: assetPath(bytes),
    contentType: "image/png",
    byteLength: 3
  }]);
  expect([...result.assets[0].content]).toEqual([1, 2, 3]);
  expect(result.summary).toEqual({ requested: 1, localized: 1, fallback: 0 });
  expect(result.warnings).toEqual([]);
});

it("重复候选只下载一次并替换所有相同图片目标", async () => {
  const remoteUrl = "https://public.example/duplicate.png";
  const bytes = new Uint8Array([4, 5]);
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(bytes) });

  const result = await localizeArticleImages(
    `![One](${remoteUrl})\n\n![Two](${remoteUrl})`,
    [{ remoteUrl }, { remoteUrl, altText: "duplicate" }],
    policy,
    fetcher
  );

  expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  expect(result.markdown).toBe(
    `![One](${assetPath(bytes)})\n\n![Two](${assetPath(bytes)})`
  );
  expect(result.assets).toHaveLength(1);
  expect(result.summary).toEqual({ requested: 1, localized: 1, fallback: 0 });
});

it("支持图片 URL 中的平衡括号", async () => {
  const remoteUrl = "https://public.example/image(1).png";
  const bytes = new Uint8Array([5, 6]);
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(bytes) });

  const result = await localizeArticleImages(
    `![Parenthesized](${remoteUrl})`,
    [{ remoteUrl }],
    policy,
    fetcher
  );

  expect(fetcher.fetch).toHaveBeenCalledWith(
    remoteUrl,
    expect.objectContaining({ pinnedAddress: "93.184.216.34" })
  );
  expect(result.markdown).toBe(`![Parenthesized](${assetPath(bytes)})`);
  expect(result.summary).toEqual({ requested: 1, localized: 1, fallback: 0 });
});

it("候选未出现在 Markdown 中时不下载也不写入资源", async () => {
  const remoteUrl = "https://public.example/not-present.png";
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(new Uint8Array([1])) });

  const result = await localizeArticleImages(
    "# Article\n\nNo image here.",
    [{ remoteUrl }],
    policy,
    fetcher
  );

  expect(fetcher.fetch).not.toHaveBeenCalled();
  expect(result.markdown).toBe("# Article\n\nNo image here.");
  expect(result.assets).toEqual([]);
  expect(result.summary).toEqual({ requested: 1, localized: 0, fallback: 0 });
});

it("图片引用超出协议字段上限时不执行本地化", async () => {
  const remoteUrl = "https://public.example/overlong-alt.png";
  const markdown = `![${"a".repeat(513)}](${remoteUrl})`;
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(new Uint8Array([2])) });

  const result = await localizeArticleImages(markdown, [{ remoteUrl }], policy, fetcher);

  expect(fetcher.fetch).not.toHaveBeenCalled();
  expect(result.markdown).toBe(markdown);
  expect(result.assets).toEqual([]);
  expect(result.summary).toEqual({ requested: 1, localized: 0, fallback: 0 });
});

it("达到整体本地化时限后不再发起图片请求", async () => {
  const firstUrl = "https://public.example/first.png";
  const secondUrl = "https://public.example/second.png";
  const fetcher = fakeFetcher({
    [firstUrl]: imageResponse(new Uint8Array([3])),
    [secondUrl]: imageResponse(new Uint8Array([4]))
  });
  const deadlinePolicy = { ...policy, maxLocalizationTimeMs: 0 };

  const result = await localizeArticleImages(
    `![First](${firstUrl})\n\n![Second](${secondUrl})`,
    [{ remoteUrl: firstUrl }, { remoteUrl: secondUrl }],
    deadlinePolicy,
    fetcher
  );

  expect(fetcher.fetch).not.toHaveBeenCalled();
  expect(result.markdown).toContain(firstUrl);
  expect(result.markdown).toContain(secondUrl);
  expect(result.summary).toEqual({ requested: 2, localized: 0, fallback: 2 });
  expect(result.warnings).toEqual(["IMAGE_TIMEOUT", "IMAGE_TIMEOUT"]);
});

it("不改写普通链接和 fenced code 中的同 URL", async () => {
  const remoteUrl = "https://public.example/code.png";
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(new Uint8Array([6])) });
  const markdown = [
    `[reference](${remoteUrl})`,
    "",
    "```markdown",
    `![Code](${remoteUrl})`,
    "```"
  ].join("\n");

  const result = await localizeArticleImages(markdown, [{ remoteUrl }], policy, fetcher);

  expect(fetcher.fetch).not.toHaveBeenCalled();
  expect(result.markdown).toBe(markdown);
  expect(result.assets).toEqual([]);
});

it("部分下载失败时保留远程引用并返回局部成功摘要", async () => {
  const successUrl = "https://public.example/success.png";
  const failedUrl = "https://public.example/failed.png";
  const successBytes = new Uint8Array([7, 8]);
  const fetcher = fakeFetcher({
    [successUrl]: imageResponse(successBytes),
    [failedUrl]: new Error("private response detail")
  });

  const result = await localizeArticleImages(
    `![Success](${successUrl})\n\n![Failed](${failedUrl})`,
    [{ remoteUrl: successUrl }, { remoteUrl: failedUrl }],
    policy,
    fetcher
  );

  expect(result.markdown).toBe(
    `![Success](${assetPath(successBytes)})\n\n![Failed](${failedUrl})`
  );
  expect(result.summary).toEqual({ requested: 2, localized: 1, fallback: 1 });
  expect(result.warnings).toContain("IMAGE_DOWNLOAD_FAILED");
  expect(JSON.stringify(result)).not.toContain("private response detail");
});

it("全部失败时仍返回原始 Markdown 和安全 warning", async () => {
  const remoteUrl = "https://public.example/failed.png";
  const fetcher = fakeFetcher({ [remoteUrl]: new Error("network body") });
  const markdown = `![Failed](${remoteUrl})`;

  const result = await localizeArticleImages(markdown, [{ remoteUrl }], policy, fetcher);

  expect(result.markdown).toBe(markdown);
  expect(result.assets).toEqual([]);
  expect(result.summary).toEqual({ requested: 1, localized: 0, fallback: 1 });
  expect(result.warnings).toEqual(["IMAGE_DOWNLOAD_FAILED"]);
});

it("使用安全的相对资源路径且不返回绝对路径", async () => {
  const remoteUrl = "https://public.example/hero.webp";
  const bytes = new Uint8Array([9, 10]);
  const fetcher = fakeFetcher({ [remoteUrl]: imageResponse(bytes, "image/webp") });

  const result = await localizeArticleImages(
    `![Hero](${remoteUrl})`,
    [{ remoteUrl }],
    policy,
    fetcher
  );

  expect(result.assets[0].relativePath).toMatch(/^Assets\/[a-f0-9]{64}\.webp$/u);
  expect(JSON.stringify(result)).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\//u);
});

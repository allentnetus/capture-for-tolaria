import { expect, it, vi } from "vitest";
import {
  DEFAULT_ASSET_LOCALIZATION_POLICY,
  FileChannelError,
  downloadAsset,
  type AssetFetcher,
  type AssetLocalizationPolicy
} from "../src/index.js";

const candidate = (remoteUrl = "https://public.example/image.png") => ({
  remoteUrl
});

function response(
  body: BodyInit | null,
  contentType: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType, ...headers }
  });
}

function fakeFetcher(
  implementation: AssetFetcher["fetch"],
  addresses = ["93.184.216.34"]
): AssetFetcher & { fetch: ReturnType<typeof vi.fn> } {
  return {
    fetch: vi.fn(implementation),
    resolveHost: vi.fn(async () => addresses)
  };
}

const smallPolicy: AssetLocalizationPolicy = {
  ...DEFAULT_ASSET_LOCALIZATION_POLICY,
  maxAssetBytes: 4,
  maxTotalBytes: 8,
  timeoutMs: 100,
  maxRedirects: 3
};

it("接受 JPEG、PNG 和 WebP 响应并返回字节", async () => {
  for (const [contentType, bytes] of [
    ["image/jpeg", new Uint8Array([1, 2, 3])],
    ["image/png", new Uint8Array([4, 5, 6])],
    ["image/webp", new Uint8Array([7, 8, 9])]
  ] as const) {
    const fetcher = fakeFetcher(async () => response(bytes, contentType));
    const result = await downloadAsset(
      candidate(`https://public.example/${contentType.slice(6)}.bin`),
      smallPolicy,
      fetcher,
      0
    );

    expect(result.contentType).toBe(contentType);
    expect([...result.bytes]).toEqual([...bytes]);
  }
});

it("拒绝 HTML 和 SVG MIME 类型", async () => {
  for (const contentType of ["text/html", "image/svg+xml"]) {
    const fetcher = fakeFetcher(async () => response("not an image", contentType));
    await expect(
      downloadAsset(candidate(), smallPolicy, fetcher, 0)
    ).rejects.toMatchObject({ code: "ASSET_UNSUPPORTED_TYPE" });
  }
});

it("在读取响应体前拒绝超出单图限制的 Content-Length", async () => {
  const fetcher = fakeFetcher(async () =>
    response("12345", "image/png", { "content-length": "5" })
  );

  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_TOO_LARGE" });
});

it("读取流时拒绝超过单图限制的响应体", async () => {
  const fetcher = fakeFetcher(async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.enqueue(new Uint8Array([5]));
        controller.close();
      }
    });
    return response(body, "image/png");
  });

  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_TOO_LARGE" });
});

it("在发起请求前拒绝超出总大小限制的候选", async () => {
  const fetcher = fakeFetcher(async () => response(new Uint8Array([1]), "image/png"));

  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, smallPolicy.maxTotalBytes)
  ).rejects.toMatchObject({ code: "ASSET_TOTAL_TOO_LARGE" });
  expect(fetcher.fetch).not.toHaveBeenCalled();
});

it("通过 AbortController 计时器将超时转换为稳定错误", async () => {
  const fetcher = fakeFetcher(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      })
  );

  await expect(
    downloadAsset(candidate(), { ...smallPolicy, timeoutMs: 5 }, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_TIMEOUT" });
});

it("手动跟随安全重定向并限制重定向次数", async () => {
  const fetcher = fakeFetcher(async (url) => {
    if (url === "https://public.example/start") {
      return new Response(null, {
        status: 302,
        headers: { location: "/final.png" }
      });
    }
    return response(new Uint8Array([1, 2]), "image/png");
  });

  const result = await downloadAsset(
    candidate("https://public.example/start"),
    smallPolicy,
    fetcher,
    0
  );

  expect(result.remoteUrl).toBe("https://public.example/final.png");
  expect(fetcher.fetch).toHaveBeenCalledTimes(2);

  const loopingFetcher = fakeFetcher(async (url) =>
    new Response(null, {
      status: 302,
      headers: { location: `${url}?next=1` }
    })
  );
  await expect(
    downloadAsset(candidate("https://public.example/start"), smallPolicy, loopingFetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_REDIRECT_LIMIT" });
});

it.each([
  "file:///secret.png",
  "http://127.0.0.1/secret.png",
  "http://192.168.1.10/secret.png",
  "http://169.254.169.254/latest/meta-data",
  "http://[::1]/secret.png",
  "http://[fc00::1]/secret.png",
  "http://[fe80::1]/secret.png",
  "http://[::ffff:127.0.0.1]/secret.png",
  "https://user:password@public.example/image.png"
])("拒绝危险重定向目标 %s 且不发起目标请求", async (location) => {
  const fetcher = fakeFetcher(async () =>
    new Response(null, { status: 302, headers: { location } })
  );

  await expect(
    downloadAsset(candidate("https://public.example/start"), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_REDIRECT_BLOCKED" });
  expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  expect(fetcher.fetch.mock.calls[0]?.[0]).toBe("https://public.example/start");
});

it("默认拒绝 fake-IP DNS 目标", async () => {
  const fetcher = fakeFetcher(
    async () => response(new Uint8Array([1]), "image/png"),
    ["198.18.1.175", "fdfe:dcba:9876::1ab"]
  );

  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_TARGET_BLOCKED" });
  expect(fetcher.fetch).not.toHaveBeenCalled();
});

it("仅在显式启用 fake-IP 兼容时接受当前代理映射", async () => {
  const fetcher = fakeFetcher(
    async () => response(new Uint8Array([1, 2, 3]), "image/png"),
    ["198.18.1.175", "fdfe:dcba:9876::1ab"]
  );

  const result = await downloadAsset(
    candidate(),
    { ...smallPolicy, allowSyntheticDns: true },
    fetcher,
    0
  );

  expect(result.contentType).toBe("image/png");
  expect([...result.bytes]).toEqual([1, 2, 3]);
  expect(fetcher.fetch).toHaveBeenCalledTimes(1);
});

it("fake-IP 兼容模式仍拒绝真实私有目标", async () => {
  const fetcher = fakeFetcher(
    async () => response(new Uint8Array([1]), "image/png"),
    ["192.168.1.10"]
  );

  await expect(
    downloadAsset(
      candidate(),
      { ...smallPolicy, allowSyntheticDns: true },
      fetcher,
      0
    )
  ).rejects.toMatchObject({ code: "ASSET_TARGET_BLOCKED" });
  expect(fetcher.fetch).not.toHaveBeenCalled();
});

it("fake-IP 兼容模式仍拒绝直接写入的 fake-IP 地址", async () => {
  const fetcher = fakeFetcher(async () => response(new Uint8Array([1]), "image/png"));

  await expect(
    downloadAsset(
      candidate("https://198.18.1.175/image.png"),
      { ...smallPolicy, allowSyntheticDns: true },
      fetcher,
      0
    )
  ).rejects.toMatchObject({ code: "ASSET_TARGET_BLOCKED" });
  expect(fetcher.fetch).not.toHaveBeenCalled();
});

it("在调用 fetcher 前拒绝非法候选 URL", async () => {
  const fetcher = fakeFetcher(async () => response(new Uint8Array([1]), "image/png"));

  await expect(
    downloadAsset(candidate("file:///secret.png"), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_URL_INVALID" });
  expect(fetcher.fetch).not.toHaveBeenCalled();
});

it("只向 fetcher 传递手动重定向、图片 Accept 和 AbortSignal", async () => {
  const fetcher = fakeFetcher(async () => response(new Uint8Array([1]), "image/png"));

  await downloadAsset(candidate(), smallPolicy, fetcher, 0);
  const [, init] = fetcher.fetch.mock.calls[0] ?? [];
  expect(init).toMatchObject({
    redirect: "manual",
    headers: { Accept: "image/*" },
    signal: expect.any(AbortSignal)
  });
  expect(init.headers).not.toHaveProperty("Cookie");
  expect(init.headers).not.toHaveProperty("Authorization");
});

it("将 fetcher 的未知异常转换为不泄露网络细节的稳定错误", async () => {
  const fetcher = fakeFetcher(async () => {
    throw new Error("secret response body and cookie");
  });

  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, 0)
  ).rejects.toMatchObject({ code: "ASSET_DOWNLOAD_FAILED" });
  await expect(
    downloadAsset(candidate(), smallPolicy, fetcher, 0)
  ).rejects.not.toThrow("secret response body");
});

it("保持 FileChannelError 的稳定错误类型", async () => {
  const fetcher = fakeFetcher(async () => response("body", "text/html"));
  const error = await downloadAsset(candidate(), smallPolicy, fetcher, 0).catch(
    (value: unknown) => value
  );

  expect(error).toBeInstanceOf(FileChannelError);
});

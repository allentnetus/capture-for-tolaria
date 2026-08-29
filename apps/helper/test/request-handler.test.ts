import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  FileChannelError,
  handleRawRequest,
  handleRequest,
  type AssetFetcher,
  type WriteInput
} from "../src/index.js";
import {
  MAX_MARKDOWN_CHARACTERS,
  PROTOCOL_VERSION,
  type ClipRequest
} from "@capture-for-tolaria/protocol";

const request: ClipRequest = {
  protocolVersion: PROTOCOL_VERSION,
  requestId: "req-article",
  extensionVersion: "0.1.0-alpha.1",
  action: "clip.article",
  payload: {
    relativeFolder: "Inbox/Web",
    title: "Handler article",
    markdown: "# Handler article\n\nBody",
    sourceUrl: "https://example.com/article",
    metadata: {}
  }
};

it("处理 hello 并返回能力声明", async () => {
  const response = await handleRequest({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-hello",
    extensionVersion: "0.1.0-alpha.1",
    action: "hello"
  });

  expect(response).toMatchObject({
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: "0.1.0-beta.1",
    capabilities: ["clip.article", "direct-file"]
  });
});

it("从授权 Vault 写入并返回相对路径而不暴露绝对路径", async () => {
  const vault = await mkdtemp(join(tmpdir(), "capture-for-tolaria-handler-"));
  try {
    const response = await handleRequest(request, {
      getVault: async () => vault,
      writeMarkdown: async (input: WriteInput) => {
        expect(input.vaultRoot).toBe(vault);
        expect(input.relativeFolder).toBe("Inbox/Web");
        return {
          relativePath: "Inbox/Web/20260821 - Handler article.md",
          created: true
        };
      }
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "req-article",
      result: { relativePath: "Inbox/Web/20260821 - Handler article.md" }
    });
    expect(JSON.stringify(response)).not.toContain(vault);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
});

it("未配置 Vault 时返回稳定错误", async () => {
  const response = await handleRequest(request, { getVault: async () => null });
  expect(response).toMatchObject({
    ok: false,
    requestId: "req-article",
    error: {
      code: "VAULT_NOT_CONFIGURED"
    }
  });
});

it("将 Writer 错误映射为稳定错误码", async () => {
  const response = await handleRequest(request, {
    getVault: async () => "C:\\vault",
    writeMarkdown: async () => {
      throw new FileChannelError("TARGET_EXISTS", "目标文件已存在");
    }
  });
  expect(response).toMatchObject({
    ok: false,
    error: { code: "TARGET_EXISTS", message: "目标文件已存在" }
  });
});

it("拒绝未经校验的 raw request", async () => {
  const response = await handleRawRequest({
    protocolVersion: 1,
    requestId: "req-bad",
    extensionVersion: "0.1.0-alpha.1",
    action: "writeFile",
    path: "C:\\outside"
  });
  expect(response).toMatchObject({
    ok: false,
    requestId: "req-bad",
    error: { code: "INVALID_REQUEST" }
  });
});

it("协议版本不匹配时保留 requestId 并返回 UNSUPPORTED_PROTOCOL", async () => {
  const response = await handleRawRequest({
    ...request,
    requestId: "req-unsupported",
    protocolVersion: 2
  });

  expect(response).toMatchObject({
    ok: false,
    requestId: "req-unsupported",
    error: { code: "UNSUPPORTED_PROTOCOL" }
  });
});

it("协议版本类型无效时返回 INVALID_REQUEST", async () => {
  const response = await handleRawRequest({
    ...request,
    requestId: "req-invalid-version-type",
    protocolVersion: "1"
  });

  expect(response).toMatchObject({
    ok: false,
    requestId: "req-invalid-version-type",
    error: { code: "INVALID_REQUEST" }
  });
});

it("非法 relativeFolder 映射为 INVALID_PATH", async () => {
  const response = await handleRawRequest({
    ...request,
    requestId: "req-path",
    payload: { ...request.payload, relativeFolder: "../outside" }
  });

  expect(response).toMatchObject({
    ok: false,
    requestId: "req-path",
    error: { code: "INVALID_PATH" }
  });
});

it("非法 sourceUrl 映射为 INVALID_URL", async () => {
  const response = await handleRawRequest({
    ...request,
    requestId: "req-url",
    payload: { ...request.payload, sourceUrl: "file:///outside" }
  });

  expect(response).toMatchObject({
    ok: false,
    requestId: "req-url",
    error: { code: "INVALID_URL" }
  });
});

it("超限 markdown 映射为 PAYLOAD_TOO_LARGE", async () => {
  const response = await handleRawRequest({
    ...request,
    requestId: "req-large",
    payload: {
      ...request.payload,
      markdown: "x".repeat(MAX_MARKDOWN_CHARACTERS + 1)
    }
  });

  expect(response).toMatchObject({
    ok: false,
    requestId: "req-large",
    error: { code: "PAYLOAD_TOO_LARGE" }
  });
});

it("真实 Writer 集成创建 Inbox/Web 文件", async () => {
  const vault = await mkdtemp(join(tmpdir(), "capture-for-tolaria-handler-"));
  try {
    const response = await handleRequest(request, { getVault: async () => vault });
    expect(response).toMatchObject({ ok: true });
    if (response.ok) {
      expect(await readFile(join(vault, response.result.relativePath), "utf8")).toContain(
        "Handler article"
      );
    }
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("图片请求执行本地化并返回摘要和 Asset 元数据", async () => {
  const vault = await mkdtemp(join(tmpdir(), "capture-for-tolaria-handler-images-"));
  const remoteUrl = "https://public.example/handler.png";
  const fetcher: AssetFetcher = {
    fetch: async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" }
      }),
    resolveHost: async () => ["93.184.216.34"]
  };
  const imageRequest: ClipRequest = {
    ...request,
    requestId: "req-handler-images",
    payload: {
      ...request.payload,
      markdown: `![Handler image](${remoteUrl})`,
      images: [{ remoteUrl, altText: "Handler image" }]
    }
  };

  try {
    const response = await handleRequest(imageRequest, {
      getVault: async () => vault,
      assetFetcher: fetcher
    });

    expect(response).toMatchObject({
      ok: true,
      requestId: "req-handler-images",
      result: {
        summary: { requested: 1, localized: 1, fallback: 0 },
        assets: [{ remoteUrl, contentType: "image/png", byteLength: 3 }],
        warnings: []
      }
    });
    if (response.ok) {
      const markdown = await readFile(join(vault, response.result.relativePath), "utf8");
      expect(markdown).not.toContain(remoteUrl);
      expect(markdown).toMatch(/!\[Handler image\]\(Assets\/[a-f0-9]{64}\.png\)/u);
      expect(response.result.assets?.[0]?.relativePath).toMatch(
        /^Inbox\/Web\/Assets\/[a-f0-9]{64}\.png$/u
      );
    }
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

it("从配置读取 fake-IP 兼容开关并执行图片本地化", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "capture-for-tolaria-handler-fake-dns-"));
  const vault = join(workspace, "vault");
  const configPath = join(workspace, "config.json");
  const previousConfigPath = process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
  process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = configPath;
  const remoteUrl = "https://public.example/fake-dns.png";
  const fetcher: AssetFetcher = {
    fetch: async () =>
      new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "content-type": "image/png" }
      }),
    resolveHost: async () => ["198.18.1.175", "fdfe:dcba:9876::1ab"]
  };

  try {
    await mkdir(vault);
    await writeFile(
      configPath,
      JSON.stringify({ vaultRoot: vault, allowSyntheticDns: true }),
      "utf8"
    );
    const response = await handleRequest(
      {
        ...request,
        requestId: "req-handler-fake-dns",
        payload: {
          ...request.payload,
          markdown: `![Fake DNS image](${remoteUrl})`,
          images: [{ remoteUrl, altText: "Fake DNS image" }]
        }
      },
      { assetFetcher: fetcher }
    );

    expect(response).toMatchObject({
      ok: true,
      result: { summary: { requested: 1, localized: 1, fallback: 0 } }
    });
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH;
    } else {
      process.env.CAPTURE_FOR_TOLARIA_CONFIG_PATH = previousConfigPath;
    }
    await rm(workspace, { recursive: true, force: true });
  }
}, 30_000);

it("图片下载失败时仍保存正文并返回 fallback warning", async () => {
  const vault = await mkdtemp(join(tmpdir(), "capture-for-tolaria-handler-fallback-"));
  const remoteUrl = "https://public.example/handler-failed.png";
  const fetcher: AssetFetcher = {
    fetch: async () => {
      throw new Error("network body must not escape");
    },
    resolveHost: async () => ["93.184.216.34"]
  };
  const imageRequest: ClipRequest = {
    ...request,
    requestId: "req-handler-fallback",
    payload: {
      ...request.payload,
      markdown: `![Failed image](${remoteUrl})`,
      images: [{ remoteUrl }]
    }
  };

  try {
    const response = await handleRequest(imageRequest, {
      getVault: async () => vault,
      assetFetcher: fetcher
    });

    expect(response).toMatchObject({
      ok: true,
      result: {
        summary: { requested: 1, localized: 0, fallback: 1 },
        assets: [],
        warnings: ["IMAGE_DOWNLOAD_FAILED"]
      }
    });
    expect(JSON.stringify(response)).not.toContain("network body must not escape");
    if (response.ok) {
      await expect(readFile(join(vault, response.result.relativePath), "utf8")).resolves.toContain(
        remoteUrl
      );
    }
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
}, 30_000);

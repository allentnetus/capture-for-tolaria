import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  FileChannelError,
  handleRawRequest,
  handleRequest,
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
    helperVersion: "0.1.0-alpha.1",
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
});

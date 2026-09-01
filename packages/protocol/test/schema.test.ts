import { expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  classifyRequestValidationError,
  createHelloResponse,
  validateHelloResponse,
  validateRequest,
  validateVaultConfigResponse,
  validateResponse
} from "../src/index.js";

const validArticleRequest = {
  protocolVersion: PROTOCOL_VERSION,
  requestId: "req-1",
  extensionVersion: "0.1.0-alpha.1",
  action: "clip.article",
  payload: {
    relativeFolder: "Inbox/Web",
    title: "Article",
    markdown: "# Article",
    sourceUrl: "https://example.com/article",
    metadata: {}
  }
} as const;

const validVaultConfigGetRequest = {
  protocolVersion: 1,
  requestId: "vault-get-1",
  extensionVersion: "0.1.0-beta.3",
  action: "vault.config.get"
};

const validVaultConfigSetRequest = {
  protocolVersion: 1,
  requestId: "vault-set-1",
  extensionVersion: "0.1.0-beta.3",
  action: "vault.config.set",
  payload: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
};

it("接受 Vault 配置读取和保存请求", () => {
  expect(validateRequest(validVaultConfigGetRequest).action).toBe("vault.config.get");
  expect(validateRequest(validVaultConfigSetRequest).action).toBe("vault.config.set");
});

it("拒绝没有 vaultRoot 的配置保存请求", () => {
  expect(() => validateRequest({
    ...validVaultConfigSetRequest,
    payload: {}
  })).toThrow();
});

it("校验 Vault 配置成功响应并拒绝额外字段", () => {
  expect(validateVaultConfigResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-response-1",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    result: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  })).toMatchObject({ result: { vaultRoot: "C:\\Users\\mrvic\\Vault" } });

  expect(() => validateVaultConfigResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-response-2",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    extra: true,
    result: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  })).toThrow();
  expect(() => validateVaultConfigResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-response-3",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    result: { vaultRoot: "C:\\Users\\mrvic\\Vault", extra: true }
  })).toThrow();
});

it("接受合法的长 Vault root 成功响应", () => {
  const vaultRoot = "V".repeat(2_048);

  expect(validateVaultConfigResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-response-long-root",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    result: { vaultRoot }
  })).toMatchObject({ result: { vaultRoot } });
});

it("接受 Vault 配置错误响应并保持 Article 响应校验分离", () => {
  const errorResponse = {
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-error-1",
    helperVersion: "0.1.0-beta.3",
    ok: false,
    error: { code: "VAULT_NOT_CONFIGURED", message: "Vault 尚未配置" }
  };

  expect(validateVaultConfigResponse(errorResponse)).toEqual(errorResponse);
  expect(() => validateResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "vault-response-4",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    result: { vaultRoot: "C:\\Users\\mrvic\\Vault" }
  })).toThrow();
});

it("为配置请求返回稳定且不泄露内部异常的校验错误", () => {
  const cases = [
    {
      value: { ...validVaultConfigSetRequest, payload: {} },
      code: "INVALID_PATH",
      message: "vaultRoot 无效或超出长度限制"
    },
    {
      value: { ...validVaultConfigSetRequest, payload: { vaultRoot: "x".repeat(4097) } },
      code: "INVALID_PATH",
      message: "vaultRoot 无效或超出长度限制"
    },
    {
      value: { ...validVaultConfigGetRequest, action: "vault.config.unknown" },
      code: "INVALID_REQUEST",
      message: "请求格式无效"
    },
    {
      value: { ...validVaultConfigGetRequest, protocolVersion: 2 },
      code: "UNSUPPORTED_PROTOCOL",
      message: "不支持的协议版本"
    }
  ] as const;

  for (const testCase of cases) {
    let error: unknown;
    try {
      validateRequest(testCase.value);
    } catch (caught) {
      error = caught;
    }

    const classified = classifyRequestValidationError(testCase.value, error);
    expect(classified).toEqual({ code: testCase.code, message: testCase.message });
    expect(classified).not.toHaveProperty("issues");
    expect(classified).not.toHaveProperty("stack");
    expect(JSON.stringify(classified)).not.toContain("Zod");
  }
});

it("接受带版本的文章请求", () => {
  expect(validateRequest(validArticleRequest).action).toBe("clip.article");
});

it("接受带图片候选的文章请求", () => {
  const request = validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      images: [
        {
          remoteUrl: "https://cdn.example.com/article/hero.png",
          altText: "Hero"
        }
      ]
    }
  });

  expect(request.action === "clip.article" && request.payload.images).toEqual([
    {
      remoteUrl: "https://cdn.example.com/article/hero.png",
      altText: "Hero"
    }
  ]);
});

it("拒绝超出数量、长度或协议限制的图片候选", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      images: Array.from({ length: 129 }, (_, index) => ({
        remoteUrl: `https://cdn.example.com/${index}.png`
      }))
    }
  })).toThrow();

  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      images: [{ remoteUrl: "file:///secret.png" }]
    }
  })).toThrow();

  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      images: [{ remoteUrl: "https://user:password@cdn.example.com/image.png" }]
    }
  })).toThrow();

  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      images: [{
        remoteUrl: "https://cdn.example.com/image.png",
        altText: "x".repeat(513)
      }]
    }
  })).toThrow();
});

it("拒绝未知 action", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    action: "clip.unknown"
  })).toThrow();
});

it("拒绝缺少 requestId 的请求", () => {
  const { requestId: _requestId, ...requestWithoutId } = validArticleRequest;
  expect(() => validateRequest(requestWithoutId)).toThrow();
});

it("拒绝不支持的协议版本", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    protocolVersion: 2
  })).toThrow();
});

it("拒绝试图离开相对目录的路径 payload", () => {
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      relativeFolder: "../outside"
    }
  })).toThrow();
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: {
      ...validArticleRequest.payload,
      relativeFolder: "C:\\Users\\other"
    }
  })).toThrow();
});

it("拒绝缺少 sourceUrl 或 metadata 的文章 payload", () => {
  const { sourceUrl: _sourceUrl, ...payloadWithoutSource } = validArticleRequest.payload;
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: payloadWithoutSource
  })).toThrow();

  const { metadata: _metadata, ...payloadWithoutMetadata } = validArticleRequest.payload;
  expect(() => validateRequest({
    ...validArticleRequest,
    payload: payloadWithoutMetadata
  })).toThrow();
});

it("拒绝没有 payload 的 clip.article", () => {
  const { payload: _payload, ...requestWithoutPayload } = validArticleRequest;
  expect(() => validateRequest(requestWithoutPayload)).toThrow();
});

it("拒绝携带文章 payload 的 hello 请求", () => {
  expect(() => validateRequest({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-hello",
    extensionVersion: "0.1.0-alpha.1",
    action: "hello",
    payload: validArticleRequest.payload
  })).toThrow();
});

it("校验成功响应时保留 requestId", () => {
  const response = validateResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-1",
    helperVersion: "0.1.0-alpha.1",
    ok: true,
    result: { relativePath: "Inbox/Web/20260821 - Article.md" }
  });
  expect(response.requestId).toBe("req-1");
});

it("接受带图片本地化摘要的成功响应", () => {
  const response = validateResponse({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "req-images",
    helperVersion: "0.1.0-beta.3",
    ok: true,
    result: {
      relativePath: "Inbox/Web/20260821 - Article.md",
      assets: [{
        remoteUrl: "https://cdn.example.com/article/hero.png",
        relativePath: "Inbox/Web/Assets/abc.png",
        contentType: "image/png",
        byteLength: 128
      }],
      summary: { requested: 1, localized: 1, fallback: 0 },
      warnings: []
    }
  });

  expect(response).toMatchObject({
    requestId: "req-images",
    result: {
      summary: { requested: 1, localized: 1, fallback: 0 }
    }
  });
});

it("能够生成带 capabilities 的 hello 响应", () => {
  expect(createHelloResponse("0.1.0-alpha.1", ["clip.article", "direct-file", "clip.article"])).toEqual({
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: "0.1.0-alpha.1",
    capabilities: ["clip.article", "direct-file"]
  });
});

it("校验 hello response 的 capabilities", () => {
  expect(validateHelloResponse({
    protocolVersion: PROTOCOL_VERSION,
    helperVersion: "0.1.0-alpha.1",
    capabilities: ["clip.article"]
  })).toMatchObject({ capabilities: ["clip.article"] });
});

# Capture for Tolaria V0.1 协议

> 状态：V0.1 wire contract 基线；Beta.1 图片字段保持 `protocolVersion=1`
>
> 传输使用 Chrome Native Messaging。业务 action 只允许 `hello` 和 `clip.article`；协议校验由 `@capture-for-tolaria/protocol` 实现。

## 1. Native Messaging framing

每条消息使用 Chrome Native Messaging 标准 framing：

```text
4 bytes little-endian unsigned length
N bytes UTF-8 JSON
```

一个进程可以连续收发多条消息。读取必须支持分段读取，并拒绝超过统一 payload 上限的长度、非法 UTF-8、非法 JSON 和截断帧。Helper 的 stdout 只能承载 framing 后的协议消息；日志、诊断和调试输出必须写入 stderr。

## 2. 通用请求字段

所有请求都必须包含：

```json
{
  "protocolVersion": 1,
  "requestId": "req-01H...",
  "extensionVersion": "0.1.0-beta.1",
  "action": "hello"
}
```

约束：

- `protocolVersion` 当前只能为 `1`。
- `requestId` 是非空、最长 128 个字符的字符串；`clip.article` 的成功或错误响应必须返回校验后的规范化值。`hello` 响应是只声明协议和 capabilities 的握手响应，不携带请求级 `requestId`。
- `extensionVersion` 是非空、最长 64 个字符的版本字符串。
- `action` 只能是已注册的业务 action。
- V0.1 schema 对 action 对象使用严格字段集合；扩展字段必须通过新的协议版本引入。

## 3. `hello`

请求：

```json
{
  "protocolVersion": 1,
  "requestId": "req-hello",
  "extensionVersion": "0.1.0-beta.1",
  "action": "hello"
}
```

响应：

```json
{
  "protocolVersion": 1,
  "helperVersion": "0.1.0-beta.1",
  "capabilities": ["clip.article", "direct-file"]
}
```

`hello` 请求仍必须携带通用请求字段中的 `requestId`，但不得携带文章 payload。当前 `hello` 响应只返回协议版本、Helper 版本和 capabilities，不返回请求级 `requestId`；Extension 只在后续 `clip.article` 响应中校验对应的 `requestId`。Helper 返回的 capabilities 只声明真实实现并可安全使用的能力。

## 4. `clip.article`

请求：

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "extensionVersion": "0.1.0-beta.1",
  "action": "clip.article",
  "payload": {
    "relativeFolder": "Inbox/Web",
    "title": "Article title",
    "markdown": "# Article title\n\nContent",
    "sourceUrl": "https://example.com/article",
    "metadata": {
      "author": "Author",
      "type": "Reference"
    },
    "images": [
      {
        "remoteUrl": "https://cdn.example.com/article/hero.png",
        "altText": "Hero"
      }
    ]
  }
}
```

`ArticlePayload` 约束：

- `relativeFolder` 必须是非空相对目录，最长 512 个字符；不能包含盘符、UNC 前缀、绝对路径、空段、`.`、`..` 或 Windows 非法字符。
- `title` 必须是非空、最长 240 个字符的字符串；Helper 负责 Windows 文件名规范化。
- `markdown` 必须是非空、最长 1,000,000 个字符的字符串；上限由协议包的 `MAX_MARKDOWN_CHARACTERS` 导出。
- `sourceUrl` 只接受最长 2,048 个字符、无用户名和密码的 `http:` 或 `https:` URL。
- `metadata` 只接受最多 32 个字符串字段；key 最长 64 个字符，value 最长 512 个字符。
- `images` 为可选字段，最多 128 个候选；每个 `remoteUrl` 只接受最长 2,048 个字符、无用户名和密码的 `http:` 或 `https:` URL，`altText` 最长 512 个字符。
- 请求不接受最终绝对路径、目标文件名、任意写入动作或图片二进制；图片二进制只在 Helper 内部受限下载和写入。

成功响应：

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "helperVersion": "0.1.0-beta.1",
  "ok": true,
  "result": {
    "relativePath": "Inbox/Web/20260821 - Article title.md",
    "assets": [
      {
        "remoteUrl": "https://cdn.example.com/article/hero.png",
        "relativePath": "Inbox/Web/Assets/<sha256>.png",
        "contentType": "image/png",
        "byteLength": 128
      }
    ],
    "summary": {
      "requested": 1,
      "localized": 1,
      "fallback": 0
    },
    "warnings": []
  }
}
```

`assets`、`summary` 和 `warnings` 都是可选结果字段；没有 `images` 的旧请求仍只返回 `relativePath`。`assets.relativePath` 相对于 Vault，正文 Markdown 中使用当前文章目录下的 `Assets/<sha256>.<ext>`。

Helper 只允许 `image/jpeg`、`image/png`、`image/gif`、`image/webp` 和 `image/avif`。Extension 在协议校验前最多传递 128 个图片候选；超出部分保留远程引用。单图默认上限为 8 MiB，单次剪藏默认总上限为 32 MiB，单图请求超时 10 秒，整次图片本地化预算 45 秒，最多跟随 3 次重定向；实际连接固定到已检查的 DNS 地址，同时保留原始主机名用于 HTTP Host 和 TLS SNI。Extension 对完整 `clip.article` 响应最多等待 60 秒，以覆盖图片处理和文件提交时间。请求不携带 cookies、`Authorization` 或页面凭据；`image/svg+xml`、CSS 背景图、`blob:`、登录后图片和需要浏览器凭据的防盗链资源不属于本能力范围。已有同名内容寻址 Asset 复用前校验文件大小和 SHA-256；失败图片保留安全的远程 Markdown 引用，并计入 `fallback`。

## 5. 错误响应

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "helperVersion": "0.1.0-beta.1",
  "ok": false,
  "error": {
    "code": "INVALID_PATH",
    "message": "relativeFolder 必须是安全的相对目录"
  }
}
```

错误码必须稳定且可供 UI 展示。请求 schema 失败至少区分：`INVALID_REQUEST`、`UNSUPPORTED_PROTOCOL`、`INVALID_PATH`、`INVALID_URL` 和 `PAYLOAD_TOO_LARGE`；文件通道还包括 `VAULT_NOT_CONFIGURED`、`VAULT_ACCESS_DENIED`、`TARGET_EXISTS`、`NAME_EXHAUSTED`、`ATOMIC_COMMIT_UNAVAILABLE` 和 `WRITE_FAILED`。图片下载失败优先在成功结果的 `warnings` 中表达，不以单张图片失败阻止正文保存。如果 raw request 中带有合法的 `requestId`，错误响应保留校验后的规范化关联值；缺失或不合法时使用 `unknown`。错误消息不能泄露绝对 Vault 路径、响应正文、cookies 或凭据。

## 6. 版本协商

Helper 启动后先处理 `hello`。协议版本不匹配时返回带原始关联 `requestId` 的 `UNSUPPORTED_PROTOCOL` 错误，且不得执行文件写入。capabilities 只用于声明能力，不改变路径安全、create-only 或请求校验规则。

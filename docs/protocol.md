# Capture for Tolaria V0.1 协议

> 状态：V0.1 wire contract 基线
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
  "extensionVersion": "0.1.0-alpha.1",
  "action": "hello"
}
```

约束：

- `protocolVersion` 当前只能为 `1`。
- `requestId` 是非空、最长 128 个字符的字符串，响应必须原样返回。
- `extensionVersion` 是非空、最长 64 个字符的版本字符串。
- `action` 只能是已注册的业务 action。
- V0.1 schema 对 action 对象使用严格字段集合；扩展字段必须通过新的协议版本引入。

## 3. `hello`

请求：

```json
{
  "protocolVersion": 1,
  "requestId": "req-hello",
  "extensionVersion": "0.1.0-alpha.1",
  "action": "hello"
}
```

响应：

```json
{
  "protocolVersion": 1,
  "helperVersion": "0.1.0-alpha.1",
  "capabilities": ["clip.article", "direct-file"]
}
```

`hello` 不得携带文章 payload，也不含请求级 `requestId`。Helper 返回的 capabilities 只声明真实实现并可安全使用的能力；Extension 仍须在后续业务响应中校验对应的 `requestId`。

## 4. `clip.article`

请求：

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "extensionVersion": "0.1.0-alpha.1",
  "action": "clip.article",
  "payload": {
    "relativeFolder": "Inbox/Web",
    "title": "Article title",
    "markdown": "# Article title\n\nContent",
    "sourceUrl": "https://example.com/article",
    "metadata": {
      "author": "Author",
      "type": "Reference"
    }
  }
}
```

`ArticlePayload` 约束：

- `relativeFolder` 必须是非空相对目录，最长 512 个字符；不能包含盘符、UNC 前缀、绝对路径、空段、`.`、`..` 或 Windows 非法字符。
- `title` 必须是非空、最长 240 个字符的字符串；Helper 负责 Windows 文件名规范化。
- `markdown` 必须是非空、最长 1,000,000 个字符的字符串；上限由协议包的 `MAX_MARKDOWN_CHARACTERS` 导出。
- `sourceUrl` 只接受最长 2,048 个字符、无用户名和密码的 `http:` 或 `https:` URL。
- `metadata` 只接受最多 32 个字符串字段；key 最长 64 个字符，value 最长 512 个字符。
- 请求不接受最终绝对路径、目标文件名、任意写入动作或二进制资源。

成功响应：

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "helperVersion": "0.1.0-alpha.1",
  "ok": true,
  "result": {
    "relativePath": "Inbox/Web/20260821 - Article title.md"
  }
}
```

## 5. 错误响应

```json
{
  "protocolVersion": 1,
  "requestId": "req-clip-01",
  "ok": false,
  "error": {
    "code": "TARGET_EXISTS",
    "message": "目标文件已存在，未覆盖原文件"
  }
}
```

错误码必须稳定且可供 UI 展示。至少包括：`INVALID_REQUEST`、`UNSUPPORTED_PROTOCOL`、`INVALID_PATH`、`INVALID_URL`、`PAYLOAD_TOO_LARGE`、`VAULT_NOT_CONFIGURED`、`VAULT_ACCESS_DENIED`、`TARGET_EXISTS` 和 `WRITE_FAILED`。错误消息不能泄露绝对 Vault 路径之外的敏感信息。

## 6. 版本协商

Helper 启动后先处理 `hello`。协议版本不匹配时返回 `UNSUPPORTED_PROTOCOL`，不得执行文件写入。capabilities 只用于声明能力，不改变路径安全、create-only 或请求校验规则。

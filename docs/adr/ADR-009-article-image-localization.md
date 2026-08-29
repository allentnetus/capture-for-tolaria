# ADR-009：Article 图片本地化与一致提交

- 状态：Accepted
- 日期：2026-08-27
- 适用版本：`v0.1.0-beta.1`

## 背景

在本 ADR 实施前，Article Capture 会把安全的图片 URL 保留为 Markdown 远程引用，Helper 只负责创建 Markdown 文件，不会把图片写入 Tolaria Vault。微信公众号文章通常把真实图片地址放在 `data-src`、`data-srcset` 或 `<picture>` 中，`src` 可能只是占位图，因此只处理普通 `src` 不能保证剪藏后的内容完整。

这项能力必须适用于当前文章以及后续类似的公开 Article，不能针对文章标题、公众号域名或单个图片 URL 编写特例。同时，浏览器扩展不应读取或转发 cookies、Authorization、页面凭据或图片二进制；单张图片失败也不能导致整篇正文丢失。

## 决策

### 范围

`v0.1.0-beta.1` 增加公开 Article 图片本地化 MVP：

- 处理 `img` 的 `data-src`、`src`、`data-srcset`、`srcset`；
- 处理 `picture/source` 的 `srcset`；
- 将相对 URL 根据文章来源 URL 解析为绝对 URL；
- 只接受无用户名、无密码的 HTTP/HTTPS URL；
- 默认拒绝私有、回环、链路本地、组播、未指定和保留目标；对使用 fake-IP DNS 的本机网络，只有用户显式配置 `allowSyntheticDns=true` 时，DNS 名称解析出的 `198.18.0.0/15` 与 `fdfe:dcba:9876::/48` 映射可以继续请求，直接写入的 IP 和真实私有目标仍拒绝；
- 对同一远程 URL 去重，只下载一次；
- 只处理 Article 正文中已被 Extractor 识别的图片，不实现网页镜像。

以下内容不属于本版本：CSS 背景图、`blob:`、视频封面、截图、登录后图片和需要浏览器凭据的防盗链资源。

候选优先级固定为：

```text
data-src
→ data-srcset
→ picture/source 的 srcset
→ srcset
→ src
```

危险协议、危险 `data:`、文件路径和带凭据 URL 在 Extractor 阶段被拒绝，不进入图片下载队列。

### 数据流

```text
DOM
  → Extractor 清理并生成 ImageCandidate[]
  → Markdown 生成远程图片引用与 ArticlePayload.images
  → Helper 校验候选并以无凭据方式下载
  → Vault 内临时 Assets
  → 校验完成后 create-only 提交 Assets
  → 只替换成功资源的 Markdown 引用
  → create-only 提交 Markdown
```

`ArticlePayload.images` 是可选字段。旧 Extension、旧 Helper 调用和没有图片的 Article 不携带该字段时，继续使用 Alpha.1 的保存行为。

### 下载安全边界

Helper 使用注入的 `AssetFetcher`，真实下载器必须：

- 每次请求只发送有限的 `Accept: image/*` 请求头；
- 不发送 cookies、Authorization、Referer 中的敏感信息或页面凭据；
- 手动处理重定向并限制最多 3 次；
- 在初始 URL、每个重定向目标和最终 URL 上重新检查 HTTP/HTTPS；
- 将通过检查的 DNS 地址固定到实际 HTTP(S) 连接，同时保留原始主机名用于 HTTP Host 和 TLS SNI，避免校验后的地址被 DNS rebinding 替换；
- 拒绝 loopback、link-local、私有网段、保留地址和无法安全解析的目标；
- 检查允许的图片 MIME 类型；
- 限制单图 8 MiB、整次请求 32 MiB、单图请求超时 10 秒和整次图片本地化预算 45 秒；
- 超限或响应不符合要求时清理临时内容并返回稳定 warning。

默认允许的 MIME 类型为 `image/jpeg`、`image/png`、`image/gif`、`image/webp` 和 `image/avif`。`image/svg+xml` 不在允许列表内，避免把可执行 SVG 内容写入 Vault。

### Assets 命名和一致提交

资源写入当前 Article 的 `relativeFolder` 下的 `Assets/`，文件名采用下载内容的 SHA-256 前缀和由 MIME 推导的扩展名；已有同名 Asset 复用前校验文件大小和 SHA-256：

```text
Inbox/Web/
├─ 20260827 - Article.md
└─ Assets/
   └─ <sha256>.<ext>
```

内容哈希使不同文章可以安全复用相同资源，也使同名 Article 的冲突文件不会覆盖已有图片。

提交顺序为：

1. 在 Vault 内受保护的临时目录写入并校验资源；
2. 逐级检查 Vault、`relativeFolder` 和 `Assets` 的真实路径与 reparse point；
3. 使用 create-only 方式提交资源，已有相同哈希资源视为可复用；
4. 仅将已经成功提交或确认可复用的资源映射到相对 Markdown 路径；
5. 使用现有 create-only 冲突后缀逻辑提交 Markdown；
6. Markdown 提交失败时，只清理本次创建且没有被已有 Markdown 引用的资源。

禁止覆盖已有 Markdown、已有 Assets 或其他 Vault 数据。

### 失败语义和兼容性

图片下载失败时：

- 正文仍然保存；
- 对应图片保留原来的安全远程 URL；
- 失败数量进入 `fallback`；
- 成功响应包含本地化数量和 warning；
- UI 不显示“全部本地化”，除非确实全部成功。

Markdown 替换只针对 `ImageCandidate.remoteUrl` 精确匹配的图片目标，不替换普通链接，也不修改 fenced code 中的 URL。

成功响应的 `assets`、`summary` 和 `warnings` 为可选字段，旧 Extension 可以忽略它们。协议版本仍为 `protocolVersion=1`，不把图片二进制放入 Native Messaging payload。

## 备选方案

### 只把远程 URL 写入 Markdown

实现成本最低，但离线阅读和长期保存依赖第三方 URL，无法解决当前 Article 的内容完整性问题，因此不采用。

### 让 Extension 直接下载并写入 Vault

浏览器扩展无法安全、稳定地访问用户 Vault，也容易把浏览器权限、cookies 和文件写入权限混在一起，因此不采用。

### 将整页 HTML 或图片二进制直接发送给 Helper

会放大 Native Messaging payload，增加内存压力和权限边界，也不能替代 Helper 对最终下载目标和 Vault 路径的安全校验，因此不采用。

## 后果

### 正面后果

- 当前公众号文章和后续类似公开 Article 使用同一套规则；
- 失败图片不会破坏整篇文章；
- Assets 与 Markdown 具有可验证的一致提交边界；
- Alpha.1 的无图片请求和旧 Helper 调用保持兼容。

### 成本和限制

- Helper 需要承担受限网络下载和资源提交；
- 图片本地化受大小、超时、重定向和 MIME 限制；
- 需要对真实公众号文章、通用文章、失败回退和 Tolaria watcher 做独立验收；
- 需要在后续版本继续维护 URL/SSRF 安全规则。

## 验收标准

- 当前真实公众号文章至少一张图片保存到 `Assets/`，Markdown 使用相对引用；
- 另一篇结构不同但公开的 Article 也能完成相同流程；
- `data-src`、`data-srcset`、`srcset`、`picture/source` 和相对 URL 测试通过；
- 重复 URL 只下载一次；
- 单张失败时正文保存且远程引用安全回退；
- 普通链接和代码块 URL 不被改写；
- 危险协议、私有地址、错误 MIME、超时和大小超限均被拒绝；
- 已有 Markdown、Assets 和 Vault 数据不被覆盖或删除；
- Alpha.1 无 `images` payload 的测试、Helper 握手和现有 Article Capture 继续通过。

# Capture for Tolaria —— 最终产品与技术方案

> 文档状态：`v0.1.0-beta.2` 当前方案基线（实现已完成，真实 Chrome/Tolaria 验收待完成）
>
> 项目名称：Capture for Tolaria
>
> 项目定位：Unofficial Web Clipper & Knowledge Intake Tool for Tolaria

本文记录当前已经实现并收敛的产品边界、技术架构、安全约束、发布策略和验收标准。代码、测试和发布脚本是实现事实来源；本文是当前方案基线，不替代真实 Chrome、Tolaria 和 Vault 验收，也不把未验证状态写成已完成。Tolaria 当前 API、许可证、商标政策以及浏览器商店政策，在正式发布前仍需独立核验。

## 1. 产品定位

### 1.1 产品名称

- 产品名：`Capture for Tolaria`
- 副标题：`Unofficial Web Clipper & Knowledge Intake Tool for Tolaria`
- GitHub 仓库：`capture-for-tolaria`

使用 `Capture` 而不是直接使用 `Tolaria Web Clipper`，有两个原因：

1. 产品最终能力不止是传统的网页剪藏，还包括元数据、资源、Vault-aware 分类和后续 AI 增强。
2. 产品必须明确是独立社区项目，不应让用户误以为获得 Tolaria 官方授权或背书。

README 和商店页面应明确声明：

```text
本项目与 Tolaria 项目无隶属关系，也未获得 Tolaria 项目的背书。
```

### 1.2 长期定位

产品不是简单的“网页转 Markdown”，而是 Tolaria 的 Web Knowledge Intake Layer：

```text
Web
  ↓
Capture
  ↓
Clean / Normalize
  ↓
Markdown + Assets + Metadata
  ↓
理解当前 Tolaria Vault
  ↓
分类 / Context / AI 增强
  ↓
Tolaria Knowledge Base
```

长期资产仍然保持为：

```text
普通 Markdown
+
普通图片
+
普通文件夹
```

不引入会锁定用户数据的私有数据库。

## 2. 产品边界

### 2.1 V0.1 目标

V0.1 只解决一条可靠、可离线、可验证的主链路：

```text
打开网页
  ↓
点击 Capture
  ↓
提取文章正文
  ↓
转换为 Markdown
  ↓
安全写入 Tolaria Vault
  ↓
Tolaria 通过文件监听感知新文件
```

V0.1 范围：

| 能力 | V0.1 目标 |
| --- | --- |
| 操作系统 | Windows |
| 浏览器 | Chrome |
| Capture 模式 | Article |
| 正文提取 | Mozilla Readability |
| HTML 安全处理 | Sanitization + DOM Cleanup |
| Markdown 转换 | Turndown + GFM |
| 浏览器与本机通信 | Chrome Native Messaging |
| 本机组件 | Helper 单文件可执行程序 |
| Tolaria 写入方式 | Direct File Channel |
| 默认目录 | `Inbox/Web`（Settings 可自定义 Vault 内默认相对目录） |
| 文件写入语义 | Atomic + Create-only，不覆盖已有文件 |
| 图片 | `v0.1.0-beta.2` 对公开 Article 提供受限图片本地化 MVP；失败时保留安全的远程 HTTP/HTTPS URL |
| Tolaria 运行状态 | Tolaria 未运行时仍尽量支持保存 |
| Vault 配置 | V0.1 配置一个用户授权的 Vault，保存到当前用户应用数据目录中的 `CaptureForTolaria` 配置文件 |
| 目录创建 | 写入时逐级 `mkdir`，每一级创建或发现后立即检查真实路径和 reparse 状态 |
| Extension 权限 | `activeTab` + `scripting` + `nativeMessaging`，不使用 V0.1 的宽泛 `host_permissions` |
| Helper 分发 | 单文件可执行程序；目标用户不需要安装 Node.js |

本项目及后续相关说明文档的正文统一使用中文；代码、命令、API、包名、协议字段和外部产品名保留其约定写法，除非用户明确要求其他语言。

Vault 配置采用单 Vault、per-user 配置。首次配置只记录并验证 Vault 根目录，不预创建 `Inbox/Web`；`Inbox/Web` 在第一次实际写入时按目录段逐级创建并校验。

V0.1 的 Article Capture 由用户点击触发，Extension 使用 `activeTab`、`scripting` 和 `nativeMessaging` 完成当前页面读取与 Helper 通信，不申请宽泛的站点访问权限。

### 2.2 明确不属于 V0.1

以下能力放入后续版本，不作为 V0.1 的隐性承诺：

- Selection、Bookmark、Screenshot 和右键菜单的完整体验
- MCP 9710 集成
- 多 Vault 和 Vault Context
- 当前 `v0.1.0-beta.2` 已包含公开 Article 图片本地化 MVP；完整的 Assets 管理、资源复用和模板能力继续排入后续版本
- AI 摘要、标签、类型推荐和知识关联
- Edge、macOS、Linux
- 云同步、账号系统和自建云服务
- 完整 Read-it-later 服务
- RSS Reader
- 浏览器历史管理
- 网页代理服务
- 全文搜索引擎

这样可以避免项目从 Web Clipper 失控扩张为另一个浏览器知识管理平台。

## 3. 总体架构

### 3.1 架构结论

V0.1 当前实现采用：

```text
Chrome Extension
        +
Native Messaging Helper
        +
File Channel
```

V0.2+ 的路线图再评估 Edge Extension 和 MCP Channel；它们不是当前 Beta.2 的已实现能力。两个 Channel 的职责必须分离：

```text
基础 Capture
    → File Channel
    → 直接创建 Vault 文件

高级 Integration
    → MCP Channel
    → Tolaria 9710
```

不要把所有操作都强制串成“浏览器 → Helper → MCP → Vault”。基础剪藏必须拥有不依赖 Tolaria 进程和 MCP Bridge 的可靠保存路径。

### 3.2 长期组件关系（V0.2+ 路线图，不代表 V0.1 已实现）

```text
┌────────────────────────────────────────┐
│ Chrome / Edge                          │
│                                        │
│ Content Script                         │
│ ├─ DOM clone                           │
│ ├─ Readability                         │
│ ├─ Sanitizer                           │
│ ├─ DOM Cleanup                         │
│ └─ Turndown + GFM                     │
│                                        │
│ Popup / Context Menu / Shortcut        │
│ MV3 Service Worker                     │
└─────────────────┬──────────────────────┘
                  │
           Native Messaging
                  │
                  ▼
┌────────────────────────────────────────┐
│ Capture for Tolaria Helper             │
│                                        │
│ ├─ Protocol                            │
│ ├─ Request Validation                  │
│ ├─ Vault Resolver                      │
│ ├─ Path Sandbox                        │
│ ├─ Duplicate Resolver                  │
│ ├─ Atomic Writer                       │
│ ├─ Asset Manager                       │
│ ├─ Write Retry Store                   │
│ └─ MCP Adapter                         │
└───────────────┬──────────────┬─────────┘
                │              │
         File Channel     MCP Channel
                │              │
                │        127.0.0.1:9710
                │              │
                │        Tolaria Tools
                │
             Tolaria Vault
```

### 3.3 File Channel 与 MCP Channel

| 能力 | File Channel | MCP Channel |
| --- | --- | --- |
| Tolaria 未启动时保存 | 支持 | 不依赖其实现 |
| 9710 未运行时保存 | 支持 | 不支持 |
| 创建 Markdown | 支持 | 支持 |
| 保存 Assets | `v0.1.0-beta.2` 提供 Article 图片本地化 MVP；`v0.2.5-beta.1` 扩展高级资源管理 | 视 Tolaria 能力而定 |
| Vault Context | 不支持 | 支持 |
| 搜索已有知识 | 不支持 | 支持 |
| 更新已有笔记 | 有限 | 支持 |
| UI 控制 | 不支持 | 支持 |
| 高级知识操作 | 有限 | 支持 |

职责固定为：

```text
File Channel
= Capture / Create / Assets / Offline

MCP Channel
= Context / Search / Update / UI / Intelligence
```

### 3.4 Native Helper 的必要性

Native Helper 不只是通信转发层，还承担以下职责：

- 连接浏览器 Native Messaging 和本地文件系统
- 在浏览器无法直接安全访问 Vault 时提供受限写入能力
- 统一跨浏览器的本地写入逻辑
- 进行路径边界、文件名和请求校验
- 实现 create-only 与 atomic write
- 在后续版本管理图片资源
- 在需要时适配 Tolaria MCP
- 在 Vault 暂时不可用时保存重试状态

V0.1 的正式路径是 Direct File Channel：

```text
Chrome
    ↓
Native Messaging
    ↓
Native Helper
    ↓
Tolaria Vault / Inbox/Web/*.md
```

V0.2+ 如果启用 MCP，才评估以下可选路径；它不属于当前 Beta.2 验收链路：

```text
Chrome / Edge
    ↓
Native Messaging
    ↓
Native Helper
    ↓
Tolaria 9710 MCP Bridge
```

## 4. 用户体验

### 4.1 Popup

长期目标 Popup：

```text
┌────────────────────────────────┐
│ Capture for Tolaria            │
├────────────────────────────────┤
│ Title                          │
│ Pi Agent Architecture          │
│                                │
│ Capture                        │
│ ● Article                      │
│ ○ Selection                    │
│ ○ Bookmark                     │
│ ○ Screenshot                   │
│                                │
│ Vault                          │
│ Research                  ▼    │
│                                │
│ Folder                         │
│ Resources/Web             ▼    │
│                                │
│ Type                           │
│ Reference                 ▼    │
│                                │
│ Tags                           │
│ [AI] [Agent] [+]               │
│                                │
│ ☑ Download images              │
│ ☑ Generate summary             │
│ ☑ Extract key points           │
│ ☑ Open after save              │
│                                │
│       Save to Tolaria          │
└────────────────────────────────┘
```

V0.1 可以只实现 Article、标题预览、默认 Vault/目录和保存按钮；其余字段在对应能力进入版本时开放。

### 4.2 其他入口

后续支持：

```text
右键菜单
Capture for Tolaria
├─ Save Page
├─ Save Selection
├─ Save Bookmark
├─ Save Image
└─ Clip Linked Page
```

快捷键目标：

```text
Alt + Shift + S
    → 快速保存当前网页
```

`Save Bookmark` 只保存标题、URL 和描述，不需要抓取目标页面；`Clip Linked Page` 才执行目标页面的提取流程。

## 5. 网页采集与 Markdown 输出

### 5.1 Article 提取管线

```text
Current DOM
    ↓
clone
    ↓
Mozilla Readability
    ↓
Quality Check
    ↓
Sanitization
    ↓
DOM Cleanup
    ↓
Turndown
    ↓
GFM Plugins
    ↓
Custom Rules
    ↓
Markdown
```

Readability 负责识别标题、作者和文章主体，但它不是 Sanitizer。未经清理的网页 DOM 不能直接进入 Markdown 或文件写入流程。

### 5.2 Sanitization 要求

至少过滤或检查：

- `<script>`、`<iframe>`、`<object>`、`<embed>`
- HTML event handler
- `javascript:`、`vbscript:` 等危险协议
- 异常或危险的 `data:` URL
- `file://` 和其他不应出现在输出中的本地资源引用
- 不必要的导航、Cookie Banner、Footer、推荐内容和隐藏内容

图片 URL 以来源页面的 `sourceUrl` 解析相对路径，按 `src`、`data-src`、`srcset` 选择可用值；只保留 HTTP/HTTPS，拒绝 `file:`、`javascript:`、`vbscript:` 和危险 `data:`。无法安全解析的图片引用删除或保留为不可执行的原始文本，不触发网络下载。

### 5.3 Readability 失败处理

不得在 Readability 失败后直接把 `body.innerText` 全部写入 Markdown，因为结果会混入导航、按钮、Footer、Cookie Banner 和隐藏内容。

推荐 fallback：

```text
Readability
    ↓ 失败
Quality Check Failed
    ↓
Semantic DOM Extractor
    ↓
article / main / [role="main"]
.post-content / .entry-content / .article-content / ...
    ↓ 仍失败
提示用户使用 Selection Mode
```

V0.1 的明确提示可以是：

```text
Unable to extract this page reliably.
```

### 5.4 Capture 模式

| 模式 | 行为 |
| --- | --- |
| Article | 保存正文、标题和来源元数据 |
| Selection | 保存当前选中的文字 |
| Bookmark | 保存标题、URL 和描述 |
| Screenshot | 保存页面或区域截图 |

V0.1 先完成 Article；其余模式按路线图逐步实现。

### 5.5 Markdown 转换规范

使用：

```text
Turndown
+
turndown-plugin-gfm
+
Custom Rules
```

必须覆盖：

- Heading
- Table
- Task List
- Strikethrough
- Fenced Code
- Code Language
- Blockquote
- Figure / Figcaption
- Details / Summary
- Link
- Image
- Relative URL
- Lazy-loaded Image

必须保留代码语言。例如：

```html
<code class="language-typescript">
```

应转换为：

````markdown
```typescript
...
```
````

## 6. Markdown 数据结构

### 6.1 基础文档格式

V0.1 建议输出：

```markdown
---
type: Resource
title: "Pi Agent Architecture"
source_url: "https://example.com/pi-agent"
site: "Example"
author: "John Smith"
published: "2026-08-20"
clipped: "2026-08-21T17:05:00+08:00"
---

# Pi Agent Architecture

完整网页正文……
```

### 6.2 AI 增强内容

AI 能力进入后，可以追加：

```markdown
## Summary

...

## Key Points

...

## Original Content

完整原始内容……
```

原始网页内容是事实层，AI 生成内容是增强层；AI 不能替代或覆盖原始内容。

### 6.3 Folder 与 Type

两者必须分开：

```text
Folder = Filesystem Concern
Type   = Frontmatter Metadata
```

V0.1 默认值：

```text
Folder = Inbox/Web
Type   = Resource
```

默认值不代表固定绑定。后续应由当前 Vault 的约定决定实际目录、Type、模板和标签。

## 7. Vault、文件名与写入语义

### 7.1 Vault-aware 设计

V0.2+ 通过 MCP 读取：

- `list_vaults`
- `vault_context`
- Mounted Vaults
- Types
- Folders
- Recent Notes
- `AGENTS.md`
- Vault conventions

再据此推荐：

```text
Folder
Type
Template
Tags
```

Clipper 不应自行硬编码所有知识库结构，而应遵守当前 Vault 的约定。

### 7.2 文件名

默认可以采用：

```text
YYYYMMDD - Title.md
```

例如：

```text
20260821 - Pi Agent Architecture.md
```

必须处理：

- Windows 非法字符
- Reserved names
- 文件名长度限制
- Unicode
- 尾部空格
- 尾部 `.`

### 7.3 重名处理

不能使用：

```text
exists()
  ↓
write()
```

该流程存在 TOCTOU 竞态。

必须直接使用 create-only 语义尝试创建，冲突后生成下一个候选名：

```text
Article.md
    ↓ create-only
冲突
    ↓
Article (2).md
    ↓ create-only
冲突
    ↓
Article (3).md
```

Node 实现可以使用 `wx` 等 create-only flag 创建临时文件；最终发布仍必须使用 ADR-003 冻结的 Windows no-replace 提交流程，不能把直接 `wx` 写最终路径当作 atomic write。MCP 模式也采用创建失败后递增后缀并重试，不先用 `get_note()` 进行存在性判断。

### 7.4 AtomicCreateWriter

目标语义：

```text
create-only
+
完整内容一次可见
+
绝不覆盖现有文件
```

推荐流程：

```text
准备完整 Markdown
    ↓
创建安全临时文件
    ↓
完整写入
    ↓
flush / close
    ↓
在同一卷内使用 Node `fs.link` 的 create-only hard-link 提交（Windows 对应 `CreateHardLinkW`），将完整临时文件作为最终文件显现，成功后删除临时链接；禁止使用可能覆盖目标的普通 `rename`
```

V0.1 只实现并验证 Windows 语义。ADR-003 的 proof test 必须覆盖同卷提交、目标冲突、跨卷和提交失败：已有目标文件不会被覆盖，最终文件不会被 Tolaria watcher 读取到半写内容。如果当前文件系统无法同时满足 atomic 和 create-only，必须安全失败并阻断 Release，不得退化为覆盖写。

## 8. 路径、资源与文件系统安全

### 8.1 Vault 路径边界

只做字符串判断，例如：

```text
target.startsWith(vaultPath)
```

不足以形成安全边界。必须防护：

- `../` 路径穿越
- symlink
- junction
- reparse point
- 通过链接或重解析点逃出 Vault

Helper 写文件前的检查顺序：

```text
获取 Vault canonical path
    ↓
按 relativeFolder 的路径段逐级处理
    ↓
目标段不存在 → 只创建当前一级目录
    ↓
对当前目录执行 lstat / realpath
    ↓
检查 Symlink / Junction / Reparse
    ↓
确认真实路径仍位于 Vault 内
    ↓
全部目录准备完成后执行 create-only 写入
```

这意味着 `Inbox/Web` 不在安装或首次配置时预创建，而是在实际写入时逐级创建。每一级目录都必须在创建或发现后立即验证；如果某一级是文件、链接、junction、reparse point，或者真实路径逃出 Vault，整个写入请求必须失败。

### 8.2 禁止任意文件写入

Helper 不能暴露这种通用接口：

```json
{
  "action": "writeFile",
  "path": "<Path>",
  "content": "..."
}
```

应只暴露业务级动作，并由 Helper 自己决定最终路径：

```text
clip.article
clip.selection
clip.bookmark
asset.save
vault.list
vault.context
```

### 8.3 图片策略

当前 `v0.1.0-beta.2` 对公开 Article 图片执行受限本地化；下载失败时仍保留经过检查的远程 URL：

```markdown
![](https://cdn.example.com/image.png)
```

图片下载成功时，Markdown 改用当前 Article 目录下的相对资源路径：

```markdown
![](Assets/<sha256>.png)
```

`v0.1.0-beta.2` 已实现公众号 Article 的图片本地化 MVP；`v0.2.5-beta.1` 再扩展完整的 Assets 管理、资源复用和模板能力：

```text
Remote Image
    ↓
Helper
    ↓
安全下载
    ↓
    Assets/
    ↓
重写 Markdown 引用
```

目标结构：

```text
Resources/Web/
├─ Pi Agent Architecture.md
└─ Assets/
   └─ pi-agent-architecture/
      ├─ 001.png
      ├─ 002.webp
      └─ 003.jpg
```

优先使用标准 Markdown，不使用 Tolaria 或 Obsidian 专属图片语法。

### 8.4 图片下载安全

Helper 开始下载图片后，会增加新的网络攻击面。至少需要：

- 只允许 `http` / `https`
- 禁止 `localhost`
- 禁止 private network
- 限制重定向次数和目标
- 设置连接和读取超时
- 校验 `Content-Type`
- 防止 MIME sniffing
- 校验 `Content-Length`
- 使用 streaming size limit，建议单文件上限约 15 MiB

下载失败时保留原始 URL，不默认把图片永久转为 Base64 嵌入 Markdown。Base64 只适合作为 Extension 到 Helper 的临时传输格式。

## 9. Extension、Helper 与协议

### 9.1 Native Messaging

扩展只申请实际需要的权限：

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "nativeMessaging"
  ]
}
```

V0.1 通过用户点击触发的 `activeTab` 临时权限读取当前页面，配合 `scripting` 动态注入或执行 Article Capture。不要使用宽泛的 `host_permissions` 替代这一最小权限路径。

Native Host Manifest 示例：

```json
{
  "name": "com.capture_for_tolaria",
  "path": "<HelperPath>",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://FIXED_EXTENSION_ID/"
  ]
}
```

Extension ID 必须从开发阶段开始固定：将公开的 Extension public key/manifest `key` 纳入版本控制，对应私钥只放在受保护的发布环境，禁止提交或打入 Release ZIP。CI 必须校验构建产物的 Extension ID 与 Native Host `allowed_origins` 中的 `chrome-extension://<id>/` 完全一致；Chrome Store 和 Edge Store 如果最终 ID 不同，Host Manifest 也只能增加明确允许的 Origin。

### 9.2 Helper 运行模型

开发阶段可以使用 TypeScript + Node.js；正式分发不要求用户安装 Node，应提供单文件可执行程序。

V0.1 的正式分发必须完成单文件打包，并在没有 Node.js 的干净 Windows 用户配置中验证。推荐方向：

```text
开发：TypeScript + Node.js
分发：Single Executable（优先评估并验证 Node SEA）
长期：必要时评估 Rust Helper
```

Native Messaging 本身负责启动短生命周期 Helper：

```text
connectNative()
    ↓
启动 Helper
    ↓
stdin / stdout 通信
    ↓
完成请求
    ↓
退出
```

不需要 V0.1 就引入 Windows Service、launchd daemon 或 systemd daemon。

### 9.3 Extension ↔ Helper 协议

协议从 V0.1 开始版本化，并支持 capability negotiation。

Request：

```json
{
  "protocolVersion": 1,
  "requestId": "uuid",
  "extensionVersion": "0.1.0-beta.2",
  "action": "clip.article",
  "payload": {
    "relativeFolder": "Inbox/Web",
    "title": "Article title",
    "markdown": "# Article title\n\nClean Markdown",
    "sourceUrl": "https://example.com/article",
    "metadata": {
      "site": "Example",
      "author": "Author"
    }
  }
}
```

Response：

```json
{
  "protocolVersion": 1,
  "requestId": "uuid",
  "helperVersion": "0.1.0-beta.2",
  "ok": true,
  "result": {
    "relativePath": "Inbox/Web/article.md"
  }
}
```

`hello` 使用独立的请求类型；`clip.article` 必须携带完整的 `ArticlePayload`。失败响应使用 `ok: false` 和稳定的 `error.code`/`error.message`，不能把成功响应和错误响应混成可选字段随意组合。

连接初始化：

```text
Extension
    ↓ hello
Helper
    ↓ protocolVersion / helperVersion / capabilities
Extension
```

Capabilities 示例：

```json
{
  "protocolVersion": 1,
  "helperVersion": "0.2.0",
  "capabilities": [
    "clip.article",
    "clip.selection",
    "asset.download",
    "mcp.vaultContext"
  ]
}
```

这样可以明确处理“新 Extension + 旧 Helper”的兼容关系，而不是让不兼容表现成笼统的保存失败。

### 9.4 Native Messaging 传输约束

必须遵守：

```text
4-byte length
+
UTF-8 JSON
```

并且：

- `stdout` 只能输出协议数据
- 调试日志统一写入 `stderr`
- 禁止 `console.log("Helper started")` 等内容污染 `stdout`
- Clipper 采用短事务：connect → request → response → disconnect
- `hello` 握手等待 10 秒；完整 `clip.article` 响应等待 60 秒，以覆盖图片顺序处理和文件提交时间
- V0.1 不需要永久连接

## 10. MCP Channel（V0.2+）

### 10.1 接入边界

MCP 9710 放在 V0.2，不阻塞 V0.1 的基础保存。

当前方案按 Tolaria 的实际 Tool Bridge 形态实现轻量适配：

```json
{
  "id": "req-001",
  "tool": "list_vaults",
  "args": {}
}
```

返回：

```json
{
  "id": "req-001",
  "result": {}
}
```

Helper 只需实现：

```text
WebSocket Client
+
Request ID Map
+
Timeout
+
Error Mapping
+
Capability Adapter
```

不因为接入该 Bridge 就把整个 Capture 重新改造成 MCP-only 架构。

### 10.2 MCP 能力定位

优先接入：

- `list_vaults`
- `vault_context`
- `search_notes`
- `get_note`
- `append_to_note`
- `update_note`
- `open_note`

其中 `vault_context` 是核心能力，使 Clipper 能够理解当前 Vault 的目录、类型、模板和约定。

### 10.3 Tolaria 状态模型

MCP Channel 至少区分：

| 状态 | 含义 |
| --- | --- |
| `READY` | Tolaria 运行中、有 active vault、9710 可用 |
| `NO_ACTIVE_VAULT` | Tolaria 打开但没有选中的 Vault |
| `TOLARIA_OFFLINE` | Tolaria 未运行 |
| `BRIDGE_ERROR` | 有 active vault，但 Bridge 连接异常 |

File Channel 尽量不依赖这些状态。

### 10.4 `refresh_vault` 与重试

正常 File Channel：

```text
Atomic Write
    ↓
Tolaria filesystem watcher
```

正常 MCP：

```text
create_note
    ↓
optional open_note
```

`refresh_vault` 只用于 Watcher 异常、批量导入、显式同步和恢复，不作为每次创建后的固定步骤。

File Channel 的失败持久化称为 `Write Retry Store`，而不是 `Offline Queue`。它处理：

- Vault 暂不可访问
- 网络盘断开
- 文件锁
- 权限失败
- 资源下载失败

重试数据放在 Helper 的应用数据目录，不放在 Service Worker 内存中。

`Write Retry Store` 不属于 V0.1。V0.1 写入失败时返回稳定错误并保留用户可重试的信息，不在本地持久化重试任务；持久化重试放入 V0.2。

## 11. 安全与隐私模型

### 11.1 信任边界

```text
Internet DOM
    ↓ 不可信
Content Script
    ↓ 不可信
MV3 Service Worker
    ↓ 必须校验消息
Native Helper
    ↓ 再次校验
Filesystem / Tolaria Vault
```

不能因为消息来自自己的 Extension，就跳过 Service Worker 和 Helper 的验证。

### 11.2 V0.1 默认隐私原则

```text
Local-first
No telemetry
No browsing-history collection
No server upload
No account
No cloud service
```

应提供 `PRIVACY.md`，明确说明：

- 网页正文默认只在本地处理
- URL 默认不上传
- 选中文字默认不上传
- Helper 只操作用户授权的 Tolaria Vault
- 默认不出售、不共享用户数据

AI 功能上线后必须清楚区分：

```text
Local Capture
    ≠
AI Provider Request
```

如果调用第三方 AI Provider，必须在用户触发前明确说明网页内容可能离开本机。

### 11.3 权限最小化

第一版除实际需要外，尽量不要申请：

- `cookies`
- `history`
- `<all_urls>` background network
- `declarativeNetRequest`

扩展应把网页内容、URL 和选择文本视为敏感输入，所有跨边界传递都必须经过显式校验。

## 12. 仓库结构

推荐 Monorepo：

```text
capture-for-tolaria/
│
├─ apps/
│  ├─ extension/
│  └─ helper/
│
├─ packages/
│  ├─ protocol/
│  ├─ extractor/
│  ├─ markdown/
│  └─ shared/
│
├─ installer/
│  ├─ windows/
│  ├─ macos/
│  └─ linux/
│
├─ tests/
│  ├─ fixtures/
│  ├─ integration/
│  └─ e2e/
│
├─ docs/
│  ├─ architecture.md
│  ├─ protocol.md
│  ├─ security.md
│  └─ troubleshooting.md
│
├─ .github/
│  ├─ workflows/
│  ├─ ISSUE_TEMPLATE/
│  └─ pull_request_template.md
│
├─ README.md
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ CODE_OF_CONDUCT.md
├─ SECURITY.md
├─ PRIVACY.md
├─ LICENSE
└─ THIRD_PARTY_NOTICES.md
```

`packages/protocol` 应由 Extension 和 Helper 共同使用，避免两端的协议类型逐渐漂移。

## 13. 测试、CI 与兼容性

### 13.1 网页测试语料库

从第一天开始积累静态 Fixture：

```text
simple-article.html
chinese-article.html
code-blocks.html
table.html
lazy-image.html
relative-links.html
spa-rendered.html
malicious-html.html
huge-page.html
unicode-title.html
paywall.html
```

采用 Golden Test：

```text
fixture.html
    ↓
Extractor
    ↓
Markdown
    ↓
expected.md
```

任何针对具体网站解析问题的修复，都应增加回归 Fixture，避免“修一个网站，坏三个网站”。

### 13.2 CI 门禁

Pull Request 至少执行：

```text
lint
  ↓
typecheck
  ↓
unit tests
  ↓
extractor golden tests
  ↓
helper tests
  ↓
extension build
```

仓库基础设施应启用或规划：

- CodeQL
- Dependabot
- Secret scanning
- 分支保护
- SemVer 与 CHANGELOG
- SHA256 校验和
- SBOM

### 13.3 Tolaria Compatibility Matrix

README 应持续维护兼容性矩阵，而不是笼统写“Works with Tolaria”：

| Capture for Tolaria | Tolaria | File Channel | MCP Channel |
| --- | --- | --- | --- |
| 0.1.x | 0.x | ✅ | — |
| 0.2.x | 0.x | ✅ | ✅ |
| 0.3.x | ≥ 对应兼容版本 | ✅ | ✅ |

每个发布版本应记录实际测试过的 Tolaria 版本、分支或构建版本。

## 14. 安装、发布与升级

### 14.1 Windows 安装

V0.1 优先使用当前用户范围，不写入系统级目录：

```text
当前用户程序目录下的 CaptureForTolaria 安装目录
└─ capture-for-tolaria-helper.exe

当前用户应用数据目录下的 Native Host manifest
└─ com.capture_for_tolaria.helper.json

当前用户注册表中的 Chrome Native Messaging 注册项
```

Native Messaging 注册使用 `HKCU`，尽量避免管理员权限、UAC 和系统级安装。当前 V0.1 不会把 `uninstall.ps1` 安装成 `uninstall.exe`；卸载从 Installer ZIP 中的 `installer/windows/uninstall.ps1` 运行。

`v0.1.0-beta.2` 的 Extension 交付包含在自包含 Installer ZIP 的 `extension` 目录中，并通过 Chrome 开发者模式加载；安装说明明确 Extension ID 与 Native Host Manifest 的对应关系。Chrome Web Store 发布仍放到后续版本。

安装器必须幂等地支持：

```text
Install
Upgrade
Repair
Uninstall
```

卸载绝对不能删除用户的 Vault、Markdown 或 Assets。

### 14.2 Release 产物

GitHub Release 面向普通用户只公开一个自包含 Installer ZIP：

```text
capture-for-tolaria-installer-v0.1.0-beta.2.zip
```

该 ZIP 自包含当前版本的 Extension、Helper、Windows 安装脚本、安装说明、`VERSION` 和许可证文件。CI 可以生成 Extension ZIP、独立 Helper、SBOM 和校验文件作为内部验证中间产物，但这些文件不作为用户下载资产，也不是用户安装前置。

使用 Git tag 和 SemVer：

```text
v0.1.0-alpha.1（历史 Alpha）
v0.1.0-beta.1（历史 Beta）
v0.1.0-beta.2（当前发布目标）
v0.1.1
v0.2.0
```

### 14.3 二进制签名

阶段建议：

| 阶段 | 建议 |
| --- | --- |
| `v0.1.0-beta.1`、`v0.1.0-beta.2` | 可以暂时 unsigned |
| V0.2 Public Beta | 开始 Windows Code Signing |
| V1.0 | 签名发布作为必需条件 |

公开发布未签名的 `helper.exe` 容易触发 SmartScreen 和 Unknown Publisher，必须纳入发布计划。

### 14.4 更新策略

Extension 和 Helper 独立升级，启动时通过 `hello` 检查协议兼容性：

```text
Extension 0.4
    ↓
Helper hello
    ↓
Helper 0.2
    ↓
protocol compatible?
```

不兼容时提示：

```text
Native Helper needs an update
```

V0.x 只提示用户到 GitHub Release 更新，不自动下载并执行新的 Helper，避免过早引入供应链风险。

## 15. 许可证、品牌与治理

### 15.1 代码来源

项目应优先遵循“接口兼容而非代码复制”：

- 参考公开接口和 documented behavior
- 自己实现 Extension、Helper 和适配层
- 不直接复制 Tolaria 的 AGPL 实现后重新标记为 MIT 或其他不兼容许可证
- 如果未来确实复用 Tolaria 源码，则重新评估整个项目的许可证义务

当前 V0.1 按“独立实现、不复制 Tolaria AGPL 源码”的方案推进，默认选择 Apache-2.0；在写入 `LICENSE` 前完成一次源码来源审计。如果发现直接复用受 AGPL 约束的 Tolaria 实现，必须停止发布准备并重新评估许可证义务。

### 15.2 必备治理文件

至少准备：

```text
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
PRIVACY.md
CHANGELOG.md
LICENSE
THIRD_PARTY_NOTICES.md
```

Issue 模板应包含：

- Bug Report
- Website Extraction Failure
- Feature Request
- Tolaria Compatibility Issue

Website Extraction Failure 不应要求用户上传私人页面的完整 HTML；需要提供 URL、浏览器、扩展版本、预期结果、实际结果，以及页面是否需要登录等必要信息。

### 15.3 品牌边界

公开页面使用：

```text
Capture for Tolaria
Unofficial Web Clipper & Knowledge Intake Tool for Tolaria
```

发布 Chrome Web Store 或 Edge Store 前，重新核验 Tolaria 的商标政策和商店对第三方品牌描述的要求。

## 16. 首批需要冻结的 ADR

在进入大规模编码前，先冻结以下 Architecture Decision Records：

```text
ADR-001  Why Native Messaging
ADR-002  Why Dual Channel
ADR-003  Direct File Write Semantics
ADR-004  Extension-Helper Protocol
ADR-005  Vault Path Security
ADR-006  Markdown Output Format
ADR-007  Privacy and Network Policy
ADR-008  Tolaria Compatibility Strategy
```

对应文件放在：

```text
docs/adr/
├─ ADR-001-native-messaging.md
├─ ADR-002-dual-channel.md
├─ ADR-003-file-write-semantics.md
├─ ADR-004-extension-helper-protocol.md
├─ ADR-005-vault-path-security.md
├─ ADR-006-markdown-output-format.md
├─ ADR-007-privacy-network-policy.md
├─ ADR-008-tolaria-compatibility.md
└─ ADR-009-article-image-localization.md
```

优先冻结的四个实现基础是：

1. Repository Structure
2. Protocol Spec
3. Security Model
4. Release Strategy

这样可以避免后续把架构随意改成 localhost 通用服务、MCP-only 或任意文件写入接口。

## 17. Roadmap

| 版本 | 核心能力 |
| --- | --- |
| V0.1 | Windows + Chrome + Article + Direct File Capture |
| V0.1.0-beta.1 | 公众号优先的 Article 图片本地化 MVP |
| V0.1.5 Beta（目标发布版 `v0.1.5-beta.1`） | Selection + Bookmark + Right Click + Deep Link |
| V0.2 | MCP 9710 + `vault_context` + `list_vaults` + Multi Vault + `open_note` + Write Retry Store |
| V0.2.5 Beta（目标发布版 `v0.2.5-beta.1`） | 高级 Assets 管理 + 资源复用 + Templates + Shortcuts |
| V0.3 | Edge + macOS + Linux + 完整 Installer |
| V0.4 | AI Summary + Tags + Type + Related Notes + Knowledge Linking |
| V1.0 | 稳定跨平台版本 + 签名安装 + 完整兼容/升级体系 |

AI 功能的处理链路：

```text
网页
  ↓
Original Capture
  ↓
Vault Context
  ↓
AI Enrichment
  ↓
Knowledge Linking
```

无论后续增加多少 AI 能力，原始网页内容都必须保留为事实层。

## 18. `v0.1.0-beta.2` 验收标准

验收对象不是开发者自己的机器，而是陌生 Windows 用户。

完整验收流程：

```text
从 GitHub 下载
    ↓
安装
    ↓
配置并验证一个用户授权的 Vault
    ↓
无需 Node
    ↓
无需管理员权限
    ↓
通过 Installer ZIP 内的 `extension` 目录和 Chrome 开发者模式加载 Extension
    ↓
打开一篇公开文章
    ↓
点击 Capture
    ↓
Markdown 正确写入 Tolaria Vault
    ↓
写入时逐级创建并校验 Settings 配置的 `defaultRelativeFolder`（默认 `Inbox/Web`）
    ↓
内容和格式正确
    ↓
正文图片成功写入文章目录的 `Assets/<sha256>.<ext>`；失败时保留安全远程引用
    ↓
已有文件不被覆盖
    ↓
Tolaria 正确感知新文件
    ↓
执行卸载
    ↓
Native Host、Helper 和注册信息清理干净
    ↓
用户 Vault、Markdown、Assets 保留
```

只有完整通过这条链路，才算完成：

```text
Capture for Tolaria v0.1.0-beta.2
```

## 19. 最终方案定版

```text
                    ┌→ File Channel
                    │   Capture
                    │   Offline
                    │   Markdown
Browser → Helper ───┤   Assets
                    │
                    └→ MCP Channel
                        Vault Context
                        Search
                        Update
                        UI
                        Intelligence
```

最终原则：

> 基础层追求“永远能保存”，MCP 层负责“理解 Tolaria”，AI 层负责“把资料变成知识”。

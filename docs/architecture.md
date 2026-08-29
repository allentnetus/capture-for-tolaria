# Capture for Tolaria V0.1 架构

> 状态：`v0.1.0-beta.1` 当前方案基线；继承 V0.1 Product Alpha 的 Direct File Channel，并增加公开 Article 图片本地化
>
> 本文与 `docs/final-solution.md` 配套，冻结第一条可验证的 Article Capture 主链路。

## 1. 目标与边界

V0.1 只支持 Windows、Chrome 和 Article Capture。用户在公开文章页面点击 Capture 后，Extension 提取文章并转换为 Markdown，Native Messaging Helper 将结果安全写入用户授权的 Tolaria Vault。

```text
Chrome 页面
    ↓ 用户点击 Capture
MV3 Extension
    ↓ Native Messaging
Helper
    ↓ 受限图片下载 + Direct File Channel
Tolaria Vault / Inbox/Web/*.md + Assets/<sha256>.<ext>
```

V0.1 Alpha 不依赖 Tolaria 进程、MCP 9710 Bridge 或 Node.js 用户环境。Beta.1 的图片本地化仍由用户触发并在 Helper 内完成；MCP Channel、AI、多 Vault 和跨平台支持不属于本版本。

## 2. 组件职责

| 组件 | 职责 | 不负责 |
| --- | --- | --- |
| `apps/extension` | Popup、Service Worker、当前页面 DOM 采集、图片候选传输和 Native Messaging 调用 | 任意本地文件写入、读取 cookies、页面凭据或历史 |
| `apps/helper` | Native Messaging framing、请求处理、Vault 配置、受限图片下载和 Bundle 写入 | 通用 `writeFile(anyPath)`、浏览器权限管理、携带页面凭据下载 |
| `packages/protocol` | 版本化 action、请求/响应类型和运行时校验 | 文件系统操作和 HTML 处理 |
| `packages/extractor` | DOM 克隆、Readability、质量检查、清理和通用图片候选提取 | Vault 路径解析和文件写入 |
| `packages/markdown` | Frontmatter、Turndown/GFM 输出和图片候选传递 | 网络下载资源 |
| `packages/shared` | 跨组件的 V0.1 常量和小型共享类型 | 业务流程编排 |

各层保持单向依赖：协议和共享类型位于边界层，网页管线不调用文件系统，Helper 不接受 Extension 传入的最终绝对路径。

## 3. Article Capture 流程

1. 用户点击 Popup 的 Article Capture。
2. Extension 通过 `activeTab` 和 `scripting` 在当前页面执行采集，不申请宽泛 `host_permissions`。
3. Content Script 克隆当前 `document`，不修改文章正文和业务页面结构；错误反馈时只注入独立的 toast UI。
4. Extractor 在克隆 DOM 上依次执行 Readability、结果质量检查、Sanitization 和 DOM Cleanup。
5. Markdown 管线生成带 `title`、`source_url`、`clipped`、`type` 的 Markdown 文档；来源 URL 只保留在 frontmatter 元数据中，不在正文顶部或底部重复追加；`site`、`author` 和 `published` 为可选元数据，图片同时保留安全远程引用和可选候选清单。
6. Extension 发送 `clip.article` 请求。请求只包含相对目录、标题、Markdown、HTTPS/HTTP 来源、有限元数据和可选 `images` 候选，不携带图片二进制。
7. Helper 校验协议、请求大小、来源 URL、相对目录和标题；对存在于正文且不在 fenced code 中的图片，使用无 cookies/`Authorization` 的受限 HTTP(S) 下载，拒绝私有目标、危险重定向、超限响应和 SVG。
8. Helper 在当前文章目录的 `Assets/` 中以 SHA-256 内容寻址资源，使用 create-only Bundle 语义先提交资源再提交 Markdown；成功资源替换为 `Assets/<sha256>.<ext>`，失败资源保留远程引用。
9. Helper 返回带校验后规范化 `requestId` 的成功或稳定错误响应；图片成功数、回退数和 warning 通过可选结果字段传回 Popup。握手仍使用 10 秒等待，包含图片处理的完整 `clip.article` 响应使用 60 秒等待；单图下载安全超时仍为 10 秒。

## 4. File Channel 与 MCP Channel

V0.1 只实现 File Channel：

- Tolaria 未运行时仍可保存。
- 只创建新 Markdown，不覆盖已有文件。
- 默认目录为 `Inbox/Web`。
- Vault 配置存储在 `%LOCALAPPDATA%\\CaptureForTolaria\\config.json`。
- 首次配置只验证 Vault 根目录，不预创建 `Inbox/Web`。

未来 MCP Channel 负责 `vault_context`、搜索、更新、UI 控制和知识增强；它不能成为 V0.1 基础保存链路的前置依赖。

## 5. 版本与兼容性

Extension 和 Helper 共用 `protocolVersion`、`requestId`、组件版本和 capabilities。连接建立时先发送 `hello`，双方只在协议版本和所需能力兼容时继续。未知 action、未知版本和超出 payload 限制的请求必须稳定失败。

正式分发的 Helper 是单文件可执行程序。开发期可以使用 Node.js 运行 TypeScript 构建产物，但用户流程不得依赖 Node.js。

## 6. 安全不变量

- Helper 只暴露 `hello` 与 `clip.article` 等业务级 action。
- Extension 不传入最终绝对输出路径。
- `relativeFolder` 不能包含绝对路径、盘符、UNC 前缀或 `..`。
- 目录每一级创建或发现后立即检查真实路径和 Windows reparse 状态。
- 目标文件已存在时使用确定性的 `(2)`、`(3)` 等冲突后缀，原文件内容不变；达到后缀上限时返回 `NAME_EXHAUSTED`。
- atomic create-only 使用同一卷 hard link；目标文件系统不支持该语义时返回 `ATOMIC_COMMIT_UNAVAILABLE`。
- Native Messaging 的 stdout 只输出协议帧；日志走 stderr。
- 图片下载只接受无凭据 HTTP/HTTPS URL，解析并检查每次请求的目标地址；默认单图 8 MiB、单次 32 MiB、10 秒超时、最多 3 次重定向。默认拒绝私有/保留目标；只有用户在本机配置中显式启用 `allowSyntheticDns` 时，DNS 名称解析出的当前 fake-IP 映射段 `198.18.0.0/15` 和 `fdfe:dcba:9876::/48` 才可继续请求，直接写入的 IP 和真实私有目标仍被拒绝。
- 默认不收集遥测、浏览历史、cookies、页面凭据或账号信息；图片字节只在本机 Helper 和用户授权 Vault 内处理。

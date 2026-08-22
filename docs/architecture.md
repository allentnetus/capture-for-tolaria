# Capture for Tolaria V0.1 架构

> 状态：V0.1 Product Alpha 基线
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
    ↓ Direct File Channel
Tolaria Vault / Inbox/Web/*.md
```

V0.1 不依赖 Tolaria 进程、MCP 9710 Bridge 或 Node.js 用户环境。MCP Channel、AI、图片本地化、多 Vault 和跨平台支持不属于本版本。

## 2. 组件职责

| 组件 | 职责 | 不负责 |
| --- | --- | --- |
| `apps/extension` | Popup、Service Worker、当前页面 DOM 采集和 Native Messaging 调用 | 任意本地文件写入、读取 cookies 或历史 |
| `apps/helper` | Native Messaging framing、请求处理、Vault 配置和受限文件写入 | 通用 `writeFile(anyPath)`、浏览器权限管理 |
| `packages/protocol` | 版本化 action、请求/响应类型和运行时校验 | 文件系统操作和 HTML 处理 |
| `packages/extractor` | DOM 克隆、Readability、质量检查、清理 | Vault 路径解析和文件写入 |
| `packages/markdown` | Frontmatter 和 Turndown/GFM 输出 | 网络下载资源 |
| `packages/shared` | 跨组件的 V0.1 常量和小型共享类型 | 业务流程编排 |

各层保持单向依赖：协议和共享类型位于边界层，网页管线不调用文件系统，Helper 不接受 Extension 传入的最终绝对路径。

## 3. Article Capture 流程

1. 用户点击 Popup 的 Article Capture。
2. Extension 通过 `activeTab` 和 `scripting` 在当前页面执行采集，不申请宽泛 `host_permissions`。
3. Content Script 克隆当前 `document`，不修改文章正文和业务页面结构；错误反馈时只注入独立的 toast UI。
4. Extractor 在克隆 DOM 上依次执行 Readability、结果质量检查、Sanitization 和 DOM Cleanup。
5. Markdown 管线生成带 `title`、`source_url`、`clipped`、`type` 的 Markdown 文档；`site`、`author` 和 `published` 为可选元数据，图片在 V0.1 保留经过检查的远程 URL。
6. Extension 发送 `clip.article` 请求。请求只包含相对目录、标题、Markdown、HTTPS/HTTP 来源和有限元数据。
7. Helper 校验协议、请求大小、来源 URL、相对目录和标题，读取 per-user Vault 配置，逐级准备目录后执行 atomic create-only 写入。
8. Helper 返回带校验后规范化 `requestId` 的成功或稳定错误响应。

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
- 默认不收集遥测、浏览历史、cookies、页面凭据或账号信息。

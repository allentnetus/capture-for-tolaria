# 变更日志

本文件记录面向用户的可见变化。

## [Unreleased]

## [0.1.0-beta.6] - 2026-09-03

- Beta.6：Extension 在同一运行上下文中复用 `connectNative()` 连接，连续剪藏不再为每次请求重复启动 Helper。
- Beta.6：Native Messaging 连接断开后清除失效状态，下一次用户操作按需重新连接并重新握手；当前不确定是否已提交的文章请求不会自动重放。
- Beta.6：业务请求完成后 30 秒无新请求时主动释放连接，避免空闲时让 Helper 和 MV3 Service Worker 持续驻留；后续请求仍会按需建立新连接。
- Beta.6：Helper 仍由 Chrome 按需启动，普通用户不需要手动运行 Helper，也不引入 Windows 常驻服务或 localhost IPC。

## [0.1.0-beta.5] - 2026-09-01

- Beta.5 修复：Vault 配置成功响应与 Vault root 请求使用同一长度上限，合法的长 Vault root 不再被错误拒绝。
- Beta.5 发布：在 Beta.4 远端发布验收基础上重新执行开发目录到发布目录的单向审计同步、用户包内容门禁和隔离安装验证。

## [0.1.0-beta.4] - 2026-09-01

- Beta.4 修复：真实 Service Worker 运行时依赖接入 `chrome.storage.local`，Settings 保存的默认目录会进入实际 `clip.article` 请求；读取失败或不安全时仍回退为 `Inbox/Web`。
- Beta.4 发布：重新执行开发目录到发布目录的单向审计同步，补充发布资产来源和内容核对门禁。
- Beta.4 发布：GitHub Release 只提供自包含 Installer ZIP，Extension ZIP、独立 Helper、源码和开发依赖不作为普通用户安装前置。

## [0.1.0-beta.3] - 2026-09-01

- Beta.3：面向用户的发布说明移除具体本地文件系统路径，改用当前用户范围、工作区角色和占位符表达。
- Beta.3：保持 Beta.2 已验证的 Article Capture、正文图片受限本地化、Vault root/默认目录可配置和单一自包含 Installer ZIP 能力不变。

## [0.1.0-beta.2] - 2026-09-01

- Beta.2：Extension Settings 支持自定义 Vault 根目录和 Vault 内默认相对目录，保留安全校验及 `Inbox/Web` fallback。
- Beta.2：Installer ZIP 自包含 Extension、Helper 和 Windows 安装脚本，本地用户只需下载一个安装包。
- Beta.2：发布同步固定为开发目录 → 发布目录；GitHub Release 只公开 Installer ZIP，开发依赖和构建中间产物不作为用户包。

## [0.1.0-beta.1] - 2026-08-29

- Beta.1 开发：公开 Article 图片候选提取、受限无凭据下载、`Assets/<sha256>.<ext>` 内容寻址保存和 Markdown 相对引用替换。
- Beta.1 开发：图片下载失败保留远程引用并返回 `localized` / `fallback` 摘要；`images`、`assets`、`summary`、`warnings` 为 `protocolVersion=1` 下的可选字段。
- Beta.1 开发：来源 URL 保留在 Markdown frontmatter 的 `source_url` 元数据中，正文不再重复追加顶部或底部的 Source 区块。
- Beta.1 开发：正文不再自动追加 `## Content` 包装标题；文章原文中自行出现的同名标题保持不变。
- Beta.1 修复：将包含图片处理的 `clip.article` 完整响应等待时间从 10 秒调整为 60 秒，避免 Helper 已继续完成保存时 Popup 先误报响应超时；单图下载安全超时仍为 10 秒。
- Beta.1 开发：拒绝 SVG、危险协议、凭据 URL、私有/保留网络目标、危险重定向和超限图片；不读取或发送 cookies、`Authorization` 或页面凭据。
- Beta.1 开发：针对将公网域名解析到 `198.18.0.0/15` 或 `fdfe:dcba:9876::/48` 的本机 fake-IP 网络，增加默认关闭的 `-AllowSyntheticDns` 显式兼容模式；直接写入的 IP、真实私有目标和其他保留地址仍拒绝。
- Beta.1 安全修复：将通过目标校验的 DNS 地址固定到实际 HTTP(S) 连接，并保留原始主机名用于 Host 和 TLS SNI，降低 DNS rebinding 风险。
- Beta.1 稳定性修复：Extension 在协议校验前限制最多 128 个图片候选；Helper 对整次图片本地化设置 45 秒预算，超出候选安全回退。
- Beta.1 完整性修复：已有同名内容寻址 Asset 复用前校验文件大小和 SHA-256；Markdown 图片解析支持 URL 中的平衡括号。
- 修复 Windows PowerShell 5.1 下四个发布脚本的无参数默认路径。
- 配置文件改为无 BOM UTF-8，并让 Helper 兼容已有 BOM 配置。
- 增加 PowerShell 5.1 配置到真实 SEA Helper 写入测试。
- Release 增加独立安装器 ZIP、资产内容校验和最终 Windows 门禁。
- 增加属性级 Windows reparse point 检查，统一 Markdown frontmatter 字段为 `title`、`source_url`、`clipped`、`type`。

## [0.1.0-alpha.1] - 2026-08-21

本版本作为公开 GitHub Pre-release 分发，Release 身份为 `v0.1.0-alpha.1`。Installer ZIP 自包含同版本 Helper；同时提供 Extension ZIP、独立 Helper、SHA256 校验文件和 SPDX SBOM。

### 新增

- Chrome MV3 Article Capture Extension。
- Native Messaging Helper 和版本化 `hello` / `clip.article` 协议。
- Readability、Sanitization、DOM Cleanup 和 Turndown/GFM Markdown 管线。
- Windows Vault 路径沙箱、reparse point 防护和 atomic create-only File Channel。
- per-user Vault 配置、Native Host Install、Repair、Uninstall 脚本。
- 单文件 Helper SEA 构建、CI 门禁、Golden Test 和安装器测试。

### 范围

V0.1 只支持 Windows + Chrome + Article + Direct File Channel。MCP 9710、AI、Selection、Bookmark、Screenshot、图片本地化、多 Vault 和跨平台支持延后。

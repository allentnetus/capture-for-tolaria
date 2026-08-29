# 变更日志

本文件记录面向用户的可见变化。

## [Unreleased]

## [0.1.0-beta.1] - 2026-08-29

- Beta.1 开发：公开 Article 图片候选提取、受限无凭据下载、`Assets/<sha256>.<ext>` 内容寻址保存和 Markdown 相对引用替换。
- Beta.1 开发：图片下载失败保留远程引用并返回 `localized` / `fallback` 摘要；`images`、`assets`、`summary`、`warnings` 为 `protocolVersion=1` 下的可选字段。
- Beta.1 开发：来源 URL 保留在 Markdown frontmatter 的 `source_url` 元数据中，正文不再重复追加顶部或底部的 Source 区块。
- Beta.1 开发：正文不再自动追加 `## Content` 包装标题；文章原文中自行出现的同名标题保持不变。
- Beta.1 修复：将包含图片处理的 `clip.article` 完整响应等待时间从 10 秒调整为 60 秒，避免 Helper 已继续完成保存时 Popup 先误报响应超时；单图下载安全超时仍为 10 秒。
- Beta.1 开发：拒绝 SVG、危险协议、凭据 URL、私有/保留网络目标、危险重定向和超限图片；不读取或发送 cookies、`Authorization` 或页面凭据。
- Beta.1 开发：针对将公网域名解析到 `198.18.0.0/15` 或 `fdfe:dcba:9876::/48` 的本机 fake-IP 网络，增加默认关闭的 `-AllowSyntheticDns` 显式兼容模式；直接写入的 IP、真实私有目标和其他保留地址仍拒绝。
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

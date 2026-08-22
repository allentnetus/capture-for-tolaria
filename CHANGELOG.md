# Changelog

本文件记录面向用户的可见变化。

## [Unreleased]

- 修复 Windows PowerShell 5.1 下四个发布脚本的无参数默认路径。
- 配置文件改为无 BOM UTF-8，并让 Helper 兼容已有 BOM 配置。
- 增加 PowerShell 5.1 配置到真实 SEA Helper 写入测试。
- Release 增加独立安装器 ZIP、资产内容校验和最终 Windows 门禁。
- 增加属性级 Windows reparse point 检查，统一 Markdown frontmatter 字段为 `title`、`source_url`、`clipped`、`type`。

## [0.1.0-alpha.1] - 2026-08-21

本版本作为 Private GitHub Pre-release 分发，Release 身份为 `v0.1.0-alpha.1`。Installer ZIP 自包含同版本 Helper；同时提供 Extension ZIP、独立 Helper、SHA256 校验文件和 SPDX SBOM。

### Added

- Chrome MV3 Article Capture Extension。
- Native Messaging Helper 和版本化 `hello` / `clip.article` 协议。
- Readability、Sanitization、DOM Cleanup 和 Turndown/GFM Markdown 管线。
- Windows Vault 路径沙箱、reparse point 防护和 atomic create-only File Channel。
- per-user Vault 配置、Native Host Install、Repair、Uninstall 脚本。
- 单文件 Helper SEA 构建、CI 门禁、Golden Test 和安装器测试。

### Scope

V0.1 只支持 Windows + Chrome + Article + Direct File Channel。MCP 9710、AI、Selection、Bookmark、Screenshot、图片本地化、多 Vault 和跨平台支持延后。

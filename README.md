# Capture for Tolaria

`Capture for Tolaria` 是一个非官方的 Tolaria 网页剪藏与知识摄取工具。

> 本项目与 Tolaria 项目无隶属关系，也未获得 Tolaria 项目的背书。

当前交付目标是 `v0.1.0-beta.1`：Windows + Chrome + Article Capture + Direct File Channel。用户在公开文章页面点击 Capture，Extension 提取并清理正文，Native Messaging Helper 将普通 Markdown 和成功本地化的图片原子地写入用户授权的 Tolaria Vault。

当前源码基线：`v0.1.0-beta.1`。`v0.1.0-alpha.1` 是已公开的历史 Alpha 预览版；Beta.1 的本地源码和发布目录可以先完成验证，但不等同于 GitHub Release 已发布，也未提交 Chrome Web Store。

当前 Beta.1 能力：对公开 Article 正文中识别到的图片执行本地化，将成功下载的图片以 `Assets/<sha256>.<ext>` 保存到文章目录；下载失败时保留远程引用并显示回退摘要。

## 当前能力

- Mozilla Readability Article 提取和语义候选 fallback
- Sanitization、DOM Cleanup 和危险 URL 过滤
- Turndown + GFM Markdown 输出
- YAML frontmatter、来源 URL、捕获时间和 `Resource` 类型
- Windows Vault 路径沙箱和逐级目录检查
- atomic、create-only 写入；已有文件不覆盖，冲突使用后缀
- Chrome MV3 Extension 和 Native Messaging Helper
- Article 图片本地化、内容寻址 `Assets/<sha256>.<ext>` 和失败回退
- per-user Vault 配置，无管理员权限
- Native Host 安装、Repair、Upgrade 和 Uninstall 脚本

Beta.1 暂不实现 MCP 9710、AI、多 Vault、Selection、Bookmark、Screenshot、Edge、macOS、Linux、云同步或账号系统。

## 安装 Beta.1

1. 当 GitHub Release 页面提供 `v0.1.0-beta.1` 资产后，从该页面下载以下文件，并先按 `SHA256SUMS.txt` 校验：
   - `capture-for-tolaria-installer-v0.1.0-beta.1.zip`
   - `capture-for-tolaria-extension-v0.1.0-beta.1.zip`
   - `capture-for-tolaria-helper-0.1.0-beta.1-windows-x64.exe`
   - `SHA256SUMS.txt`
   - `SBOM.spdx.json`
2. 解压 Installer ZIP；版本化 Helper 已位于 ZIP 根目录，不需要 Node.js，也不需要仓库中的 `release/` 目录。
3. 在解压后的 Installer ZIP 根目录运行 `installer/windows/configure-vault.ps1 -VaultPath <VaultRoot>`，再运行 `installer/windows/install.ps1`。
4. 解压 Extension ZIP，打开 `chrome://extensions`，启用开发者模式并加载已解压目录。
5. 打开公开文章，点击 Extension Popup 中的 `Save to Tolaria`。

如 Helper 不在 Installer ZIP 根目录，也可以显式传入 `-HelperPath <HelperExe>`。脚本只写当前用户的 `%LOCALAPPDATA%` 和 `HKCU`。

固定 Extension ID：

```text
ncjeeembmcgkfjipkfhganbdnadbhdcl
```

完整 Windows 流程见 [`INSTALL-WINDOWS.md`](INSTALL-WINDOWS.md) 和 [`installer/windows/install-extension.md`](installer/windows/install-extension.md)。

## 本地数据流

```text
公开网页
  ↓ 用户点击
Chrome MV3 Extension
  ↓ Native Messaging
Native Helper
  ↓ Direct File Channel
Vault/Inbox/Web/YYYYMMDD - Title.md
```

默认不上传网页正文，不收集 telemetry、cookies、浏览历史或账号信息。Beta.1 对正文中识别出的图片执行无凭据、受限的本地化；成功资源写入文章目录的 `Assets/`，失败资源保留经过检查的远程 HTTP/HTTPS URL。

Beta.1 图片请求只使用无凭据的 HTTP/HTTPS 方式，不发送 cookies、`Authorization` 或页面凭据；默认单图 8 MiB、单次 32 MiB、单图请求 10 秒超时、最多 3 次重定向，并拒绝 SVG、私有目标和登录后图片。Extension 对包含图片处理的完整 `clip.article` 响应最多等待 60 秒。使用 fake-IP DNS 的本机网络可以通过 `configure-vault.ps1 -AllowSyntheticDns` 显式启用兼容模式；该模式默认关闭，且仍拒绝直接写入的 IP、真实私有目标和其他保留地址。

## 权限

Extension 只申请：

- `activeTab`
- `scripting`
- `nativeMessaging`

不申请宽泛 `host_permissions`、`cookies` 或 `history`。Helper 不暴露任意文件写入 API。

## 开发

环境要求：Node.js 24、pnpm 11.19.0、PowerShell 7。安装依赖并运行完整门禁：

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run check
```

单独运行 Golden Test：

```powershell
pnpm.cmd run test:golden
```

构建单文件 Helper：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/build-helper.ps1
```

如果本机 Chrome 正在加载 `apps/extension/dist`，Windows 可能暂时锁定其中的 `manifest.json`。此时可把 Extension 构建到隔离目录，再将该目录传给打包脚本：

```powershell
$env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST = "$PWD\.beta-extension-dist"
node apps/extension/build.mjs
Remove-Item Env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/assemble-release.ps1 -ExtensionDirectory .\.beta-extension-dist -ReleaseTag v0.1.0-beta.1
```

安装器 Pester 测试：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '& {
  $result = Invoke-Pester -Path "installer/windows/tests" -PassThru
  if ($result.FailedCount -ne 0) { exit 1 }
}'
```

如果当前网络把公共域名解析到 fake-IP 地址，且确认该映射由本机可信网络代理提供，可以在配置 Vault 时显式启用 Beta.1 兼容模式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\configure-vault.ps1 -VaultPath 'C:\Path\To\Vault' -AllowSyntheticDns
```

该开关只影响当前用户配置，普通配置默认保持严格的私有/保留地址拒绝策略。

## 文档

- [`docs/architecture.md`](docs/architecture.md)：组件和数据流
- [`docs/protocol.md`](docs/protocol.md)：版本化 wire contract
- [`docs/security.md`](docs/security.md)：信任边界和文件系统安全
- [`docs/troubleshooting.md`](docs/troubleshooting.md)：排障
- [`docs/compatibility.md`](docs/compatibility.md)：已验证兼容性证据
- [`docs/adr/`](docs/adr/)：首批架构决策

## 隐私、安全与许可证

隐私策略见 [`PRIVACY.md`](PRIVACY.md)，漏洞报告见 [`SECURITY.md`](SECURITY.md)，第三方依赖见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。源码按 Apache-2.0 发布；Tolaria 名称和商标不表示官方授权或背书。

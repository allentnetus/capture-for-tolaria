# Capture for Tolaria

`Capture for Tolaria` 是一个非官方的 Tolaria 网页剪藏与知识摄取工具。

> 本项目与 Tolaria 项目无隶属关系，也未获得 Tolaria 项目的背书。

当前交付版本是 `v0.1.0-beta.7`：Windows/macOS + Google Chrome + Article Capture + Direct File Channel。用户在公开文章页面点击 Capture，Extension 提取并清理正文，Native Messaging Helper 将普通 Markdown 和成功本地化的图片原子地写入用户授权的 Tolaria Vault。

当前源码基线：`v0.1.0-beta.7`。`v0.1.0-alpha.1`、`v0.1.0-beta.1`、`v0.1.0-beta.2`、`v0.1.0-beta.3`、`v0.1.0-beta.4`、`v0.1.0-beta.5` 和 `v0.1.0-beta.6` 是已公开的历史预览版；Beta.7 仍不提交 Chrome Web Store。

当前 Beta.7 能力：对公开 Article 正文中识别到的图片执行本地化，将成功下载的图片以 `Assets/<sha256>.<ext>` 保存到文章目录；下载失败时保留远程引用并显示回退摘要。

当前 Beta.7 还提供 Extension 的 `Settings` 页面，可自定义 Vault 根目录和 Vault 内默认目录。默认目录仍为 `Inbox/Web`；Extension Service Worker 已在真实运行时依赖中读取该设置，真实 Chrome/Tolaria 用户链路仍需单独验收。

Beta.7 保留 Beta.6 的按需连接：第一次 Capture 时 Chrome 自动启动 Helper，同一 Extension 运行上下文中的后续 Capture 复用连接；每次业务请求完成后，若 30 秒内没有新请求，连接会主动释放；连接异常或空闲释放后，下一次 Capture 自动重连。用户不需要手动启动 Helper，也不会因为空闲而保持后台进程。

## 当前能力

- Mozilla Readability Article 提取和语义候选 fallback
- Sanitization、DOM Cleanup 和危险 URL 过滤
- Turndown + GFM Markdown 输出
- YAML frontmatter、来源 URL、捕获时间和 `Resource` 类型
- Windows/macOS Vault 路径沙箱和逐级目录检查
- atomic、create-only 写入；已有文件不覆盖，冲突使用后缀
- Chrome MV3 Extension 和 Native Messaging Helper
- Extension `Settings` 页面：配置 Vault root 和默认相对目录
- Article 图片本地化、内容寻址 `Assets/<sha256>.<ext>` 和失败回退
- per-user Vault 配置，无管理员权限
- Native Host 安装、Repair、Upgrade 和 Uninstall 脚本

Beta.7 暂不实现 MCP 9710、AI、多 Vault、Selection、Bookmark、Screenshot、Edge、Chromium、Linux、云同步或账号系统。

## 安装 Beta.7

1. 从 [GitHub Release `v0.1.0-beta.7`](https://github.com/allentnetus/capture-for-tolaria/releases/tag/v0.1.0-beta.7) 下载与你的系统匹配的唯一用户安装包：Windows 使用 `capture-for-tolaria-installer-v0.1.0-beta.7.zip`；Apple Silicon 使用 `capture-for-tolaria-installer-v0.1.0-beta.7-macos-arm64.dmg`；Intel Mac 使用 `capture-for-tolaria-installer-v0.1.0-beta.7-macos-x64.dmg`。不需要另行下载 Extension、Helper、源码或开发依赖。
2. 打开或解压 Installer 包。Windows ZIP 和 macOS DMG 都自包含 `VERSION`、版本化 Helper、`extension`、对应平台的 Installer 脚本和中文安装说明，不需要 Node.js，也不需要仓库中的 `release/` 目录。
3. Windows 用户在 Installer 包根目录运行：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\install.ps1
   ```

   如果已经进入 `installer\windows` 目录，必须使用 PowerShell 当前目录写法 `.\install.ps1`。不要直接输入 `install.ps1`，也不要使用 `cmd install.ps1`；前者不会按当前目录查找脚本，后者不会以 PowerShell 脚本方式运行。
   或者，macOS 用户在 DMG 中的 Installer 目录运行：

   ```bash
   bash installer/macos/install.sh
   ```

4. 打开 `chrome://extensions`，启用开发者模式。Windows 选择同一个 Installer 包中的 `extension` 文件夹；macOS 选择安装脚本复制到当前用户应用数据范围内的 `CaptureForTolaria/extension` 文件夹。macOS 不要直接加载 DMG 挂载目录中的临时文件夹，以免弹出 DMG 后 Extension 路径失效。
5. 打开 Extension Popup，点击 `Settings`，填写 Vault root 和 Vault 内默认目录并保存。支持 `vault.config` 的 Helper 会在保存 Vault root 时验证目录、权限和链接安全。
6. 打开公开文章，点击 Extension Popup 中的 `Save to Tolaria`。

普通用户不需要单独指定或手动启动 Helper；只有在本地调试或替换经过审核的 Helper 时，Windows 才显式传入 `-HelperPath <HelperExe>`。Chrome 会在 Extension 第一次连接时按需启动 Helper，后续请求复用连接；连接空闲 30 秒后自动释放，下一次请求再按需建立。Installer 只写当前用户的应用数据范围；Windows 另写当前用户的 Native Messaging 注册范围，macOS 使用当前用户的 Chrome Native Host 配置范围。

## 开发目录、发布目录与用户交付

- 开发工作区：本地开发、测试和问题修复的源码基准。
- 发布工作区：独立的 GitHub 发布工作区；只接收审核后的源码和中文文档，不反向覆盖开发工作区。
- 发布前先在开发目录通过质量门禁，再按审核清单从开发目录单向同步到发布目录；发布目录重新安装依赖并复验后，才从发布目录组装当前版本 Installer ZIP/DMG。
- 发布目录根部最多暂存当前版本的 Installer ZIP/DMG 作为用户交付资产。该资产被忽略，不进入源码 commit，也不复制回开发目录；`node_modules/`、`dist/`、`release/` 和 Vault 数据不属于发布目录交付内容。
- GitHub Release 只公开自包含的 Windows Installer ZIP 和对应架构的 macOS Installer DMG。Extension ZIP、独立 Helper、源码压缩包、SBOM、校验文件和开发依赖不是普通用户的安装前置。

### 配置存储路径
- `Vault root` 必须是用户选择的 Windows 或 macOS 绝对路径。设置页通过 Native Messaging 请求 Helper 读取或更新它；Helper 只接受存在、可读写且不是 symbolic link、junction 或其他平台链接/reparse point 的普通目录。
- `Default folder` 是 Vault 内的安全相对目录，例如 `Inbox/Reading`。它保存在 Extension 的 `chrome.storage.local` 键 `defaultRelativeFolder` 中，缺失、读取失败或不安全时回退为 `Inbox/Web`。
- 设置页保存时先保存 Vault root，再保存默认目录。Vault root 验证失败时不会保存默认目录；默认目录保存失败时不会显示两项均已完成。
- 旧 Helper 如果没有 `vault.config` capability，不会接收设置 action；Windows 请使用 `configure-vault.ps1`，macOS 请使用 `configure-vault.sh`，Article Capture 仍可使用原有 `clip.article` 能力。

固定 Extension ID：

```text
ncjeeembmcgkfjipkfhganbdnadbhdcl
```

完整 Windows 流程见 [`INSTALL-WINDOWS.md`](INSTALL-WINDOWS.md) 和 [`installer/windows/install-extension.md`](installer/windows/install-extension.md)；macOS 流程见 [`INSTALL-MACOS.md`](INSTALL-MACOS.md)。

## 本地数据流

```text
公开网页
  ↓ 用户点击
Chrome MV3 Extension
  ↓ 读取 defaultRelativeFolder，并在 clip.article 前注入相对目录
Native Helper
  ↓ Direct File Channel
Vault/<defaultRelativeFolder>/YYYYMMDD - Title.md
```

默认不上传网页正文，不收集 telemetry、cookies、浏览历史或账号信息。Beta.7 对正文中识别出的图片执行无凭据、受限的本地化；成功资源写入文章目录的 `Assets/`，失败资源保留经过检查的远程 HTTP/HTTPS URL。

Beta.7 图片请求只使用无凭据的 HTTP/HTTPS 方式，不发送 cookies、`Authorization` 或页面凭据；默认单图 8 MiB、单次 32 MiB、单图请求 10 秒超时、整次图片本地化预算 45 秒、最多 3 次重定向，并拒绝 SVG、私有目标和登录后图片。Helper 将实际连接固定到已通过检查的 DNS 地址，同时保留原始主机名用于 HTTP Host 和 TLS SNI；Extension 对包含图片处理的完整 `clip.article` 响应最多等待 60 秒。Extension 在协议校验前最多发送 128 个图片候选，超出的图片保留远程引用。使用 fake-IP DNS 的本机网络可以通过对应平台的 `configure-vault` 入口显式启用兼容模式；该模式默认关闭，且仍拒绝直接写入的 IP、真实私有目标和其他保留地址。

## 权限

Extension 只申请：

- `activeTab`
- `scripting`
- `nativeMessaging`
- `storage`

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

macOS Helper 和 Installer 生命周期测试必须在 macOS runner 上执行：

```bash
bash installer/macos/build-helper.sh --arch arm64 --output-dir "$RUNNER_TEMP/capture-for-tolaria-release"
bash installer/macos/tests/run-tests.sh
```

如果本机 Chrome 正在加载 `apps/extension/dist`，Windows 可能暂时锁定其中的 `manifest.json`。此时可把 Extension 构建到隔离目录，再将该目录传给打包脚本：

```powershell
$env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST = "$PWD\.beta-extension-dist"
node apps/extension/build.mjs
Remove-Item Env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/assemble-release.ps1 -ExtensionDirectory .\.beta-extension-dist -ReleaseTag v0.1.0-beta.7
```

安装器 Pester 测试：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '& {
  $result = Invoke-Pester -Path "installer/windows/tests" -PassThru
  if ($result.FailedCount -ne 0) { exit 1 }
}'
```

如果当前网络把公共域名解析到 fake-IP 地址，且确认该映射由本机可信网络代理提供，可以在配置 Vault 时显式启用 Beta.7 兼容模式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\configure-vault.ps1 -VaultPath '<VaultPath>' -AllowSyntheticDns
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

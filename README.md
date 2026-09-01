# Capture for Tolaria

`Capture for Tolaria` 是一个非官方的 Tolaria 网页剪藏与知识摄取工具。

> 本项目与 Tolaria 项目无隶属关系，也未获得 Tolaria 项目的背书。

当前交付目标是 `v0.1.0-beta.2`：Windows + Chrome + Article Capture + Direct File Channel。用户在公开文章页面点击 Capture，Extension 提取并清理正文，Native Messaging Helper 将普通 Markdown 和成功本地化的图片原子地写入用户授权的 Tolaria Vault。

当前源码基线：`v0.1.0-beta.2`。`v0.1.0-alpha.1` 和 `v0.1.0-beta.1` 是已公开的历史预览版；Beta.2 已作为 [GitHub Pre-release](https://github.com/allentnetus/capture-for-tolaria/releases/tag/v0.1.0-beta.2) 发布，尚未提交 Chrome Web Store。

当前 Beta.2 能力：对公开 Article 正文中识别到的图片执行本地化，将成功下载的图片以 `Assets/<sha256>.<ext>` 保存到文章目录；下载失败时保留远程引用并显示回退摘要。

当前 Beta.2 还提供 Extension 的 `Settings` 页面，可自定义 Vault 根目录和 Vault 内默认目录。默认目录仍为 `Inbox/Web`；设置页面的本地实现和代码级门禁已完成，真实 Chrome/Tolaria 用户链路仍需单独验收。

## 当前能力

- Mozilla Readability Article 提取和语义候选 fallback
- Sanitization、DOM Cleanup 和危险 URL 过滤
- Turndown + GFM Markdown 输出
- YAML frontmatter、来源 URL、捕获时间和 `Resource` 类型
- Windows Vault 路径沙箱和逐级目录检查
- atomic、create-only 写入；已有文件不覆盖，冲突使用后缀
- Chrome MV3 Extension 和 Native Messaging Helper
- Extension `Settings` 页面：配置 Vault root 和默认相对目录
- Article 图片本地化、内容寻址 `Assets/<sha256>.<ext>` 和失败回退
- per-user Vault 配置，无管理员权限
- Native Host 安装、Repair、Upgrade 和 Uninstall 脚本

Beta.2 暂不实现 MCP 9710、AI、多 Vault、Selection、Bookmark、Screenshot、Edge、macOS、Linux、云同步或账号系统。

## 安装 Beta.2

1. 从 [GitHub Release `v0.1.0-beta.2`](https://github.com/allentnetus/capture-for-tolaria/releases/tag/v0.1.0-beta.2) 下载唯一的用户安装包：`capture-for-tolaria-installer-v0.1.0-beta.2.zip`。不需要另行下载 Extension ZIP、Helper EXE、源码或开发依赖。
2. 解压 Installer ZIP。ZIP 根目录自包含 `VERSION`、版本化 Helper、`extension` 和 `installer`，不需要 Node.js，也不需要仓库中的 `release/` 目录。
3. 在解压后的 ZIP 根目录运行：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\install.ps1
   ```

   如果已经进入 `installer\windows` 目录，必须使用 PowerShell 当前目录写法 `.\install.ps1`。不要直接输入 `install.ps1`，也不要使用 `cmd install.ps1`；前者不会按当前目录查找脚本，后者不会以 PowerShell 脚本方式运行。
4. 打开 `chrome://extensions`，启用开发者模式，选择同一个 Installer ZIP 解压目录中的 `extension` 文件夹并加载。
5. 打开 Extension Popup，点击 `Settings`，填写 Vault root 和 Vault 内默认目录并保存。支持 `vault.config` 的 Helper 会在保存 Vault root 时验证目录、权限和链接安全。
6. 打开公开文章，点击 Extension Popup 中的 `Save to Tolaria`。

普通用户不需要单独指定 Helper；只有在本地调试或替换经过审核的 Helper 时，才显式传入 `-HelperPath <HelperExe>`。脚本只写当前用户的应用数据范围和用户注册表范围。

## 开发目录、发布目录与用户交付

- 开发工作区：本地开发、测试和问题修复的源码基准。
- 发布工作区：独立的 GitHub 发布工作区；只接收审核后的源码和中文文档，不反向覆盖开发工作区。
- 发布前先在开发目录通过质量门禁，再按审核清单从开发目录单向同步到发布目录；发布目录重新安装依赖并复验后，才从发布目录组装当前版本 Installer ZIP。
- 发布目录根部最多暂存当前版本的 `capture-for-tolaria-installer-v<VERSION>.zip` 作为用户交付资产。该 ZIP 被忽略，不进入源码 commit，也不复制回开发目录；`node_modules/`、`dist/`、`release/` 和 Vault 数据不属于发布目录交付内容。
- GitHub Release 只公开这个自包含 Installer ZIP。Extension ZIP、独立 Helper、源码压缩包、SBOM、校验文件和开发依赖不是普通用户的安装前置。

### 配置存储路径
- `Vault root` 必须是用户选择的 Windows 绝对路径。设置页通过 Native Messaging 请求 Helper 读取或更新它；Helper 只接受存在、可读写且不是 symbolic link、junction 或其他 reparse point 的普通目录。
- `Default folder` 是 Vault 内的安全相对目录，例如 `Inbox/Reading`。它保存在 Extension 的 `chrome.storage.local` 键 `defaultRelativeFolder` 中，缺失、读取失败或不安全时回退为 `Inbox/Web`。
- 设置页保存时先保存 Vault root，再保存默认目录。Vault root 验证失败时不会保存默认目录；默认目录保存失败时不会显示两项均已完成。
- 旧 Helper 如果没有 `vault.config` capability，不会接收设置 action；请使用 `configure-vault.ps1`，Article Capture 仍可使用原有 `clip.article` 能力。

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
  ↓ 读取 defaultRelativeFolder，并在 clip.article 前注入相对目录
Native Helper
  ↓ Direct File Channel
Vault/<defaultRelativeFolder>/YYYYMMDD - Title.md
```

默认不上传网页正文，不收集 telemetry、cookies、浏览历史或账号信息。Beta.2 对正文中识别出的图片执行无凭据、受限的本地化；成功资源写入文章目录的 `Assets/`，失败资源保留经过检查的远程 HTTP/HTTPS URL。

Beta.2 图片请求只使用无凭据的 HTTP/HTTPS 方式，不发送 cookies、`Authorization` 或页面凭据；默认单图 8 MiB、单次 32 MiB、单图请求 10 秒超时、整次图片本地化预算 45 秒、最多 3 次重定向，并拒绝 SVG、私有目标和登录后图片。Helper 将实际连接固定到已通过检查的 DNS 地址，同时保留原始主机名用于 HTTP Host 和 TLS SNI；Extension 对包含图片处理的完整 `clip.article` 响应最多等待 60 秒。Extension 在协议校验前最多发送 128 个图片候选，超出的图片保留远程引用。使用 fake-IP DNS 的本机网络可以通过 `configure-vault.ps1 -AllowSyntheticDns` 显式启用兼容模式；该模式默认关闭，且仍拒绝直接写入的 IP、真实私有目标和其他保留地址。

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

如果本机 Chrome 正在加载 `apps/extension/dist`，Windows 可能暂时锁定其中的 `manifest.json`。此时可把 Extension 构建到隔离目录，再将该目录传给打包脚本：

```powershell
$env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST = "$PWD\.beta-extension-dist"
node apps/extension/build.mjs
Remove-Item Env:CAPTURE_FOR_TOLARIA_EXTENSION_DIST
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/assemble-release.ps1 -ExtensionDirectory .\.beta-extension-dist -ReleaseTag v0.1.0-beta.2
```

安装器 Pester 测试：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '& {
  $result = Invoke-Pester -Path "installer/windows/tests" -PassThru
  if ($result.FailedCount -ne 0) { exit 1 }
}'
```

如果当前网络把公共域名解析到 fake-IP 地址，且确认该映射由本机可信网络代理提供，可以在配置 Vault 时显式启用 Beta.2 兼容模式：

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

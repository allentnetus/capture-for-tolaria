# Windows 安装、修复、升级和卸载

V0.1 Alpha 安装到当前用户目录，不需要管理员权限，不写入 `Program Files`，不注册系统级 Native Host。目标用户不需要安装 Node.js。

## 前置条件

- Windows 10/11 x64
- Chrome MV3
- 一个用户有写权限的 Tolaria Vault
- Vault 所在文件系统支持同一卷 hard link；V0.1 的 atomic create-only 写入不在不支持该能力的文件系统上降级为覆盖写入
- `v0.1.0-alpha.1` 的 Installer ZIP、Extension ZIP、Helper 单文件、`SHA256SUMS.txt` 和 `SBOM.spdx.json`
- 解压后的 Installer ZIP 根目录应同时存在 `VERSION` 和 `capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe`

## 安装

从解压后的 Installer ZIP 根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/configure-vault.ps1 -VaultPath "C:\Path\To\Vault"
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/install.ps1
```

`install.ps1` 默认按以下顺序寻找同版本 Helper：Installer ZIP 根目录、`installer/windows` 目录、开发目录的 `release` 目录。下载包不需要 Node.js，也不需要把 Helper 放进仓库目录。若使用自定义位置，可显式传入：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/install.ps1 -HelperPath "C:\Path\To\capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe"
```

配置脚本只验证并记录 Vault 根目录，不创建 `Inbox/Web`。第一次实际剪藏时，Helper 才逐级创建 `Inbox` 和 `Web` 并检查每一级真实路径和 reparse 状态。

安装位置：

```text
%LOCALAPPDATA%\Programs\CaptureForTolaria\
%LOCALAPPDATA%\CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.capture_for_tolaria.helper
```

## 扩展加载（Extension）

解压 Extension ZIP，打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”。固定 Extension ID 和 `allowed_origins` 见 [`installer/windows/install-extension.md`](installer/windows/install-extension.md)。

## 修复（Repair）

Helper 或 Native Host manifest 缺失时运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/repair.ps1
```

Repair 是幂等的，只替换应用文件和注册信息，不修改 Vault 内容。

## 升级

下载新 Release，先运行 Repair 或 Install。安装脚本只替换 Helper 和 Native Host manifest；Vault、配置、Markdown 和 Assets 保留。Extension 在 `chrome://extensions` 刷新已解压目录。启动时 `hello` 会检查协议版本和 capabilities。

V0.x 不自动下载或执行新 Helper。

## 卸载

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/uninstall.ps1
```

默认移除 Helper、Native Host manifest 和 HKCU 注册，不移除 Vault、Markdown、Assets 或 `config.json`。用户明确希望删除配置时才使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File installer/windows/uninstall.ps1 -ClearConfig
```

卸载后还需要在 `chrome://extensions` 手动移除已加载的 Extension。

## Alpha 限制

`v0.1.0-alpha.1` 构建未签名，Extension ZIP 通过 Chrome 开发者模式加载。当前只支持 Windows + Chrome + MV3 Article Capture + Direct File Channel；不支持 MCP、AI、图片本地化、Selection、Bookmark、Screenshot、Edge、macOS 或 Linux。发布前请核对 `SHA256SUMS.txt`，不要把私钥、用户配置或 Vault 数据放进 ZIP。

验收顺序为：`configure-vault → install → 加载 Extension → 打开公开文章并 Capture → 检查 Markdown/Vault → Repair → Upgrade → Uninstall`。卸载不删除 Vault、Markdown、Assets 或配置文件。

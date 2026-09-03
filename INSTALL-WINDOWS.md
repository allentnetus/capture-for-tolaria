# Windows 安装、修复、升级和卸载

`v0.1.0-beta.6` 安装到当前用户目录，不需要管理员权限，不写入 `Program Files`，不注册系统级 Native Host。目标用户不需要安装 Node.js。

## 前置条件

- Windows 10/11 x64
- Chrome MV3
- 一个用户有写权限的 Tolaria Vault
- Vault 所在文件系统支持同一卷 hard link；V0.1 的 atomic create-only 写入不在不支持该能力的文件系统上降级为覆盖写入
- `v0.1.0-beta.6` 的单个 Installer ZIP：`capture-for-tolaria-installer-v0.1.0-beta.6.zip`
- 解压后的 Installer ZIP 根目录应同时存在 `VERSION`、`extension`、`installer` 和 `capture-for-tolaria-helper-0.1.0-beta.6-windows-x64.exe`

## 安装

从解压后的 Installer ZIP 根目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\install.ps1
```

单个 Installer ZIP 已经包含同版本 Helper，普通用户不需要额外下载或指定它；下载包不需要 Node.js。若使用自定义位置，可显式传入：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\install.ps1 -HelperPath "<HelperExe>"
```

如需在安装前使用兼容配置入口，可运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\configure-vault.ps1 -VaultPath "<VaultPath>"
```

配置脚本只验证并记录 Vault 根目录，不创建 `Inbox/Web`。第一次实际剪藏时，Helper 才逐级创建 `Inbox` 和 `Web` 并检查每一级真实路径和 reparse 状态。

PowerShell 默认不会从当前目录执行未加路径的 `install.ps1`；如果当前目录已经是 `installer\windows`，应输入 `.\install.ps1`。不要使用 `cmd install.ps1`，因为 `.ps1` 不是 `cmd.exe` 的批处理命令。

安装位置由当前用户环境决定，脚本只使用当前用户的应用数据范围和用户注册表范围，不写入系统级目录：

```text
当前用户程序目录下的 CaptureForTolaria 安装目录
当前用户应用数据目录下的 Native Host manifest
当前用户注册表中的 Chrome Native Messaging 注册项
```

安装完成后不需要手动启动 Helper。第一次使用 Extension 时，Chrome 会按需启动 Native Messaging Helper；连续剪藏复用同一连接。若连接异常，下一次 Capture 会自动重新连接并握手；当前不确定是否已写入的文章不会被透明重放。

## 扩展加载（Extension）

在同一个 Installer ZIP 解压目录中找到 `extension`，打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”。不需要单独下载 Extension ZIP。固定 Extension ID 和 `allowed_origins` 见 [`installer/windows/install-extension.md`](installer/windows/install-extension.md)。

## 修复（Repair）

Helper 或 Native Host manifest 缺失时运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\repair.ps1
```

Repair 是幂等的，只替换应用文件和注册信息，不修改 Vault 内容。

## 升级

下载新的 Installer ZIP，先运行其中的 Install 或 Repair。安装脚本只替换 Helper 和 Native Host manifest；Vault、配置、Markdown 和 Assets 保留。Extension 在 `chrome://extensions` 刷新同一解压目录中的 `extension`。启动时 `hello` 会检查协议版本和 capabilities。

V0.x 不自动下载或执行新 Helper。

## 卸载

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\uninstall.ps1
```

默认移除 Helper、Native Host manifest 和 HKCU 注册，不移除 Vault、Markdown、Assets 或 `config.json`。用户明确希望删除配置时才使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\uninstall.ps1 -ClearConfig
```

卸载后还需要在 `chrome://extensions` 手动移除已加载的 Extension。

## Beta.6 限制

`v0.1.0-beta.6` 构建未签名，Installer ZIP 中的 `extension` 通过 Chrome 开发者模式加载。当前支持 Windows + Chrome + MV3 Article Capture + Direct File Channel，以及正文图片的受限本地化；仍不支持 MCP、AI、Selection、Bookmark、Screenshot、Edge、macOS 或 Linux。不要把私钥、用户配置或 Vault 数据放进 ZIP。

验收顺序为：`configure-vault → install → 加载 Extension → 打开公开文章并 Capture → 检查 Markdown/Vault → Repair → Upgrade → Uninstall`。卸载不删除 Vault、Markdown、Assets 或配置文件。

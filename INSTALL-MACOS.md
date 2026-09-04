# macOS 安装、修复、升级和卸载

本文适用于 `v0.1.0-beta.7` 的 macOS + Google Chrome Installer DMG。普通用户只需下载与 Mac 架构匹配的 Installer DMG，不需要安装 Node.js，也不需要另行下载 Extension、Helper 或开发依赖。

## 前置条件

- 支持的 macOS 版本，以当前 Release 说明中的验证矩阵为准。
- Google Chrome 和 MV3 Extension。
- 一个当前用户具有读写权限的 Tolaria Vault。
- 与设备架构匹配的 Installer DMG：
  - Apple Silicon 使用 `macos-arm64` 包。
  - Intel 使用 `macos-x64` 包。
- Vault 所在文件系统支持同一卷 hard link；Direct File Channel 不会降级为覆盖写入。

## 安装

1. 从 GitHub Release 下载对应架构的 `capture-for-tolaria-installer-v<VERSION>-macos-<ARCH>.dmg`。
2. 打开 DMG，在打开的 Installer 目录中执行：

   ```bash
   bash installer/macos/install.sh
   ```

   安装脚本会自动选择当前设备架构对应的包内 Helper，将 Extension 复制到当前用户应用数据范围内的持久 `extension` 目录，创建当前用户级 Google Chrome Native Host manifest，并设置 Helper 的可执行权限。安装不需要管理员权限，不使用 `sudo`，也不要求 Node.js。
3. 打开 `chrome://extensions`，启用开发者模式，选择当前用户应用数据范围内的 `CaptureForTolaria/extension` 文件夹并加载。不要直接加载 DMG 挂载目录中的临时文件夹；弹出 DMG 后，持久目录仍可供 Chrome 使用。
4. 打开 Extension Popup，进入 `Settings`，填写 Vault root 和 Vault 内默认目录并保存。默认目录仍为 `Inbox/Web`，设置页支持自定义安全相对目录。
5. 打开公开文章，点击 `Save to Tolaria`。

首次 Capture 时 Chrome 会按需启动 Helper。连续剪藏复用同一 Native Messaging 连接；连接异常或空闲释放后，下一次 Capture 会自动重新连接和握手。用户不需要手动启动 Helper。

## Vault 配置

设置页是首选入口。若需要使用命令行配置入口，可执行：

```bash
bash installer/macos/configure-vault.sh --vault-root "<Vault root>"
```

配置脚本只验证并保存 Vault 根目录，不创建 `Inbox/Web`。它拒绝相对路径、不存在的目录、不可读写目录和 symlink 路径，并使用原子配置替换。若已有兼容的 `allowSyntheticDns` 配置，重新设置 Vault 时会保留该字段；如需启用该兼容模式，可显式添加：

```bash
bash installer/macos/configure-vault.sh --vault-root "<Vault root>" --allow-synthetic-dns
```

该开关默认关闭，只适用于用户明确确认的本机 fake-IP 网络，不能放宽真实私有地址、凭据 URL 或其他网络安全限制。

## Repair

Extension、Helper 或 Native Host manifest 缺失、损坏或需要升级时，在同一 Installer 目录执行：

```bash
bash installer/macos/repair.sh
```

Repair 是幂等的，只更新当前用户应用数据范围内的 Extension、Helper 和 manifest，不修改 Vault、Markdown、Assets 或 Vault 配置。

## 升级

下载新版本对应架构的 Installer DMG，先执行其中的 `install.sh` 或 `repair.sh`。升级会更新持久 `extension` 目录、Helper 和 Native Host manifest，保留 Vault、Markdown、Assets 和配置。升级后在 `chrome://extensions` 刷新已加载的持久 `extension` 目录。

V0.x 不自动下载或执行新 Helper；请只使用项目 GitHub Release 中的自包含 Installer DMG。

## 卸载

默认卸载：

```bash
bash installer/macos/uninstall.sh
```

默认移除已安装的 Extension、Helper 和 Native Host manifest，保留 Vault、Markdown、Assets 和配置。若用户明确希望同时删除 Vault 配置，再执行：

```bash
bash installer/macos/uninstall.sh --clear-config
```

卸载后还需要在 `chrome://extensions` 手动移除开发者模式加载的 Extension。卸载脚本不会删除用户 Vault。

## Beta.7 限制

- 当前只支持 macOS + Google Chrome + MV3 Article Capture + Direct File Channel。
- macOS Beta.7 使用架构专用 Installer DMG；不支持把一个架构的包复制到另一种架构设备上使用。
- Extension 仍通过 Chrome 开发者模式加载，不使用 Chrome Web Store。
- 当前不支持 Edge、Chromium、Linux、MCP、AI、Selection、Bookmark、Screenshot、云同步或账号系统。
- 真实 Chrome、Tolaria 文件监听、签名、公证和 Gatekeeper 状态必须以对应 Release 的验证记录为准；静态构建通过不等同于真实用户链路通过。
- 不要把用户 Vault、配置、私钥、证书或开发依赖放入 Installer DMG。

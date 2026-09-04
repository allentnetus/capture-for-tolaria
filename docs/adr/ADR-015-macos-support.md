# ADR-015：以用户级 Native Host 和架构专用 DMG 支持 macOS

- 状态：Accepted
- 日期：2026-09-04
- 适用版本：`v0.1.0-beta.7`

## 背景

Beta.6 已完成 Chrome Native Messaging 连接复用、FIFO、断线后的下一请求重连和安全响应校验，但交付路径仍只覆盖 Windows。macOS 需要在不改变既有协议和 Direct File Channel 的前提下，为普通用户提供不依赖 Node.js 的安装、配置、Repair、升级和卸载流程。

Chrome 的 macOS 用户级 Native Host manifest 位于当前用户 Google Chrome 配置目录的 `NativeMessagingHosts` 子目录，manifest 的 Helper `path` 必须是绝对路径。Node.js SEA 在 macOS 上需要在注入后重新签名；直接分发还需要 Developer ID、Hardened Runtime 和 Notarization 证据。

参考：

- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
- [Apple：Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

## 决策

### 1. 使用用户级路径抽象

新增 `getPlatformPaths()`，集中返回配置文件、Native Host manifest、安装根目录和稳定 Helper 文件名：

- macOS 使用当前用户的 `Library/Application Support/CaptureForTolaria` 作为应用数据目录和配置归属；Helper 安装在其独立子目录中，与 `config.json` 分离。
- macOS manifest 使用当前用户 Google Chrome 的 `NativeMessagingHosts` 目录。
- 安装脚本将 manifest 的 `path` 写为已安装 Helper 的最终绝对路径。
- Windows 保持现有 `LOCALAPPDATA` 和注册表行为。
- 其他平台显式返回不支持，不套用 Windows 路径。

平台路径函数接受注入的 platform、用户主目录和环境对象，便于在隔离目录中验证，不依赖测试机真实用户路径。

### 2. 保持 Native Messaging 进程模型

不增加 `launchd` 常驻服务。Helper 仍由 Chrome 按需启动；连续剪藏复用 Beta.6 的连接，空闲释放后下一次请求重新连接并握手。stdin/stdout framing、协议字段、FIFO、安全请求处理和不确定请求不自动重放全部保持不变。

### 3. 保持 Vault 安全边界

macOS 使用 POSIX 路径语义，逐级进行 `lstat`、`realpath`、symlink 和 containment 检查；Windows 的 PowerShell reparse point 检查只在 Windows 执行。配置阶段只保存用户选择的 Vault 根目录，不预创建 `Inbox/Web`。Repair、升级和默认卸载不得删除或覆盖 Vault、Markdown、Assets 和用户配置。

### 4. 使用架构专用自包含 DMG

Beta.7 先分别构建并验证 arm64 与 x64 Helper，交付对应架构的 Installer DMG。DMG 自包含 Extension、对应架构 SEA Helper、安装脚本和中文说明；安装脚本会把 Extension 复制到当前用户应用数据范围内的持久目录，避免用户弹出 DMG 后 Extension 路径失效。DMG 不包含源码、开发依赖、Node.js runtime、用户 Vault、用户配置、私钥、证书或独立开发包。

暂不制作 universal binary。只有在两种架构的 SEA 启动、Native Messaging、签名和 Gatekeeper 验证均有真实证据后，才重新评估 universal DMG。

### 5. 采用幂等生命周期脚本

macOS Installer 提供 `install.sh`、`repair.sh`、`configure-vault.sh` 和 `uninstall.sh`：

- 安装和 Repair 只更新当前用户应用数据范围内的 Extension、Helper 及 Native Host manifest。
- 重复执行安装和 Repair 的结果一致。
- 升级更新持久 Extension、Helper 和 manifest。
- 默认卸载只移除 Extension、独立 Helper 安装子目录和 manifest，保留 Vault、Markdown、Assets 和配置；清除配置必须显式请求。
- 不使用 `sudo`，不写系统级 Native Host 目录，不执行未验证的宽泛删除。

## 后果

### 正面影响

- macOS 用户无需安装 Node.js，且无需管理员权限即可完成用户级安装。
- Beta.6 的连续剪藏体验和协议兼容性不会因平台适配改变。
- 架构专用包可以分别暴露 SEA、签名和启动问题，减少 universal binary 的隐性风险。
- 用户 Vault 和配置具有明确的保留边界，安装器不会把开发包交给普通用户。

### 成本和限制

- Beta.7 需要维护两个 macOS 构建和发布资产。
- macOS 真实启动、Chrome Native Messaging、签名、公证和 Gatekeeper 无法由 Windows 本地测试替代，必须在 macOS runner 和真实设备上分别记录证据。
- Chrome、Chromium、Edge、Linux 和 Mac App Store 不在本 ADR 范围内。

## 验收要求

- `darwin`、`win32` 和不支持平台的路径测试均通过。
- arm64/x64 Helper 均能完成真实 `hello`、`clip.article`、Vault 写入、连接复用和断线恢复验证。
- macOS 安装、Repair、升级、默认卸载和 Vault/config 保留测试通过。
- DMG 内容审计排除开发依赖、源码、用户数据和凭据。
- 签名、公证、ticket stapling 和 Gatekeeper 只在具备对应真实证据时标记为通过。
- Beta.5/Beta.6 的 tag、Release、资产和 Windows 流程保持不变；本 ADR 完成前不进入 Feishu DOCX 任务。

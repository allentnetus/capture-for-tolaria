# Capture for Tolaria V0.1 故障排查

> 当前文档记录 `v0.1.0-beta.7` 的用户可见错误边界。Windows 既有门禁和 macOS 双架构质量链路分别验证；真实 Chrome、Tolaria、Vault 文件监听、公开文章 Capture、签名、公证和 Gatekeeper 用户链路仍需按平台独立验收，不能用代码级或 Installer 门禁替代这些证据。

## 1. Capture 按钮不可用

检查：

1. 当前页面是否为公开文章页面。
2. Chrome 是否允许当前扩展在用户点击后执行脚本。
3. Extension 的 Service Worker 是否仍在运行。
4. Chrome 扩展管理页是否显示 Extension 错误。

受限页面、浏览器内部页面和扩展页面不属于 V0.1 Article Capture 保证范围。不要通过申请宽泛站点权限绕过这个边界。

## 2. 无法连接 Helper

普通用户不需要手动启动 Helper。第一次 Capture 时 Chrome 会按需启动 Native Messaging Helper；连续 Capture 复用同一连接。连接空闲 30 秒后主动释放，或 Helper 异常退出后，下一次 Capture 会自动重新连接并重新执行 `hello`。

检查：

- Native Host 注册是否位于当前用户配置范围；Windows 检查当前用户注册范围，macOS 检查 Google Chrome 用户级 `NativeMessagingHosts` 目录。
- Native Host manifest 的 `allowed_origins` 是否包含当前 Extension ID。
- Helper 可执行文件路径是否存在且可执行。
- Helper 的 stdout 是否被日志或调试输出污染；日志必须写入 stderr。
- Extension 与 Helper 的协议版本是否兼容。

如果出现 `CAPTURE_FAILED: Helper 已断开连接`，先确认本次文章是否已经写入 Vault，再决定是否重试；应用不会自动重放连接断开时状态不确定的 `clip.article` 请求，以避免重复文章。若下一次 Capture 仍然失败，再检查 Native Host 注册、Helper 文件和 Extension ID。

先执行 `hello`，确认 capabilities 包含 `clip.article`，再发送文章请求。打开 Popup 的 `Settings` 还需要 `vault.config` capability；旧 Helper 没有该 capability 时不要手工发送未知配置 action，改用对应平台的 `configure-vault.ps1` 或 `configure-vault.sh`。

## 3. 设置页和 `VAULT_NOT_CONFIGURED`

打开 Extension Popup 的 `Settings`，填写当前平台的绝对路径形式 Vault root 和 Vault 内安全相对目录，然后保存。配置动作只记录并验证 Vault 根目录，不预创建默认目录；默认目录缺失或读取失败时仍回退为 `Inbox/Web`。确认：

- 路径存在或用户有权创建目标 Vault。
- 路径是目录而不是文件。
- 目标目录不位于受限或不可访问位置。
- 目标目录不是 symbolic link、junction 或其他平台链接/reparse point。
- 配置文件位于当前用户应用数据目录中的 `CaptureForTolaria` 配置文件。

如果 Settings 显示 Helper 不可用，依次检查 Native Host 是否安装、`hello.capabilities` 是否包含 `vault.config`、当前 Extension ID 是否在 Native Host 的 `allowed_origins` 中；旧 Helper 使用 Windows 的 `installer/windows/configure-vault.ps1 -VaultPath <VaultRoot>` 或 macOS 的 `installer/macos/configure-vault.sh --vault-root <VaultRoot>` 作为兼容入口。

### 3.1 macOS 安装和 Gatekeeper

macOS 用户必须使用与设备架构匹配的 Installer DMG，并从包内运行 `installer/macos/install.sh`。安装脚本会把 Extension 复制到当前用户应用数据范围内的持久 `CaptureForTolaria/extension` 目录；普通用户不需要 Node.js、管理员权限或手动启动 Helper。若 Extension、Helper 或 manifest 缺失、损坏或版本不一致，使用同一版本包中的 `installer/macos/repair.sh`。

如果 Chrome 无法连接 macOS Helper，检查：

- macOS Extension 是否从安装脚本复制的持久 `CaptureForTolaria/extension` 目录加载；Windows 是否从同一 Installer 包的 `extension` 目录加载，且固定 Extension ID 未改变。
- 用户级 Native Host manifest 是否存在，`path` 是否为最终 Helper 的绝对路径，`allowed_origins` 是否只包含固定 Extension ID。
- Helper 是否具有可执行权限、是否来自同一架构 DMG，且 stdout 没有混入诊断文字。
- 当前 DMG 是否来自项目 Release，并已通过签名、公证和 Gatekeeper 验证；不要用关闭系统安全检查的方式绕过不可信二进制。

macOS Vault 路径中的 symlink 或 containment 不安全时，Helper 会拒绝写入。请选择真实、可读写的普通目录；Repair、Upgrade 和默认卸载不会删除 Vault、Markdown、Assets 或配置。

## 4. Article 仍写入 `Inbox/Web`

`Inbox/Web` 是默认目录，不是强制目录。检查：

1. Settings 是否显示保存成功，且 Default folder 是预期的安全相对目录。
2. `chrome.storage.local` 中的 `defaultRelativeFolder` 是否存在且没有被其他配置覆盖。
3. 当前 Popup、Service Worker 和 Helper 是否来自同一 Extension/Helper 版本。
4. Service Worker 是否在发送 `clip.article` 前读取了最新设置；普通请求只应携带相对目录，不应通过增加绝对 Vault root 绕过错误。

## 5. `INVALID_PATH`

`relativeFolder` 只接受相对目录，例如 `Inbox/Web`。以下输入必须被拒绝：

```text
系统目录
网络共享路径
绝对路径
..
Inbox/../private
```

不要让用户通过修改 Folder 字段写入 Vault 之外的位置。Helper 必须重复校验并检查 Windows reparse point 或 macOS symlink/containment。

## 6. 文件冲突与 `TARGET_EXISTS`

V0.1 是 create-only。目标文件已存在时 Helper 会依次尝试确定性的 `(2)`、`(3)` 等后缀，不覆盖原文件；达到后缀上限时返回 `NAME_EXHAUSTED`。如果底层直接返回 `TARGET_EXISTS`，同样表示原文件未被覆盖。当前版本不提供覆盖、删除或任意重命名接口。

如果连续出现 `ATOMIC_COMMIT_UNAVAILABLE`，检查目标 Vault 文件系统是否支持同一卷 hard link；不要把它改成普通覆盖写入。

## 7. Markdown 内容不完整

检查文章是否使用了受限脚本渲染、登录墙、无限滚动或非标准正文结构。Extractor 应报告 Readability 质量失败，而不是把整页导航和 Footer 静默写入 Markdown。用固定 fixture 复现后再调整提取规则。

## 8. `Images: 0 localized, N fallback`

这表示正文已经保存，但图片下载没有成功；远程 Markdown 引用会被保留，不应把这个结果当作图片已经本地化。先检查 `Inbox/Web/Assets/` 是否存在对应文件，并确认当前 Extension 和 Helper 来自同一版本。

如果当前网络把公网域名解析到本机代理使用的 fake-IP 映射段，可以在确认网络环境后显式开启兼容模式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\windows\configure-vault.ps1 -VaultPath '<VaultPath>' -AllowSyntheticDns
```

该开关只允许 DNS 名称解析出的 `198.18.0.0/15` 和 `fdfe:dcba:9876::/48` 映射继续请求，默认关闭；直接写入 URL 的 IP、真实私有目标、回环地址和其他保留地址仍会被拒绝。macOS 使用 `installer/macos/configure-vault.sh --vault-root <VaultRoot> --allow-synthetic-dns`；重新加载当前版本 Extension 后再截取文章。

## 9. 如何收集诊断信息

提交问题时提供：

- OS 和架构
- Chrome 版本
- Extension 版本
- Helper 版本
- 协议版本
- 错误码和脱敏后的错误消息
- 是否 Tolaria 正在运行
- 是否首次配置 Vault

不要提交 Vault 绝对路径、文章正文、cookies、页面凭据或包含个人信息的日志。

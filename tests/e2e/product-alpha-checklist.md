# V0.1 Product Alpha 验收清单

> 本清单必须由陌生 Windows 用户在没有 Node.js、没有既有 Native Host 注册的配置中执行。未勾选的必选项意味着不能发布 Product Alpha。

## 已完成的本地证据

- [x] workspace lint、typecheck、unit、integration、Golden 和 build 门禁通过。
- [x] 协议版本、request ID、action、路径和 payload 运行时校验通过。
- [x] HTML Sanitization 和危险 URL 测试通过。
- [x] 临时 Windows Vault 的逐级 `Inbox/Web` 创建和 reparse 检查通过。
- [x] create-only 冲突后缀、并发创建和临时文件清理通过。
- [x] Extension manifest 只申请 `activeTab`、`scripting`、`nativeMessaging`。
- [x] Mock Host 完成 Extension → Helper → File Channel 垂直链路。
- [x] SEA 单文件 Helper 在没有调用 Node.js runtime 的 Pester 测试中完成 `hello`。
- [x] per-user Install、Repair 基础路径、Uninstall 和 Vault 数据保留测试通过。
- [x] Windows PowerShell 5.1 `configure-vault.ps1` 无 BOM 写入并驱动真实 SEA Helper `clip.article`。
- [x] 无参数执行 build、install、repair、SBOM 脚本通过。
- [x] 安装器 ZIP 包含用户安装所需脚本、manifest 模板和说明文件。
- [x] 普通目录、目录 junction 和最终目标 reparse point 的属性级检查通过。

## 必须在真实环境补齐

- [ ] 准备没有 Node.js、没有现成 Helper 注册的 Windows 用户配置。
- [ ] 准备初始不存在 `Inbox/Web`、但包含既有 Markdown 的临时 Tolaria Vault。
- [ ] 通过 `configure-vault.ps1` 配置并验证 Vault，确认配置动作不创建 `Inbox/Web`。
- [ ] 不使用管理员权限完成 Install。
- [ ] 在 Chrome 开发者模式加载 Extension，并确认固定 Extension ID 与 `allowed_origins` 一致。
- [ ] 打开公开文章，点击 Capture，确认正文、frontmatter 和远程图片 URL 正确。
- [ ] 确认恶意 HTML 不会进入 Markdown，且不发送 cookies、history 或页面凭据。
- [ ] 确认写入时按 `Inbox` → `Web` 逐级创建并检查真实路径/reparse 状态。
- [ ] 使用同名标题再次剪藏，确认旧文件内容不变且生成冲突后缀。
- [ ] 确认 Tolaria 实际感知新 Markdown 文件。
- [ ] Repair 前后分别剪藏一次。
- [ ] Upgrade 后再次剪藏，确认 Extension/Helper 协议兼容。
- [ ] Uninstall 后确认 Native Host、Helper 和注册清理干净。
- [ ] Uninstall 后确认 Vault、既有 Markdown、新建 Markdown 和 Assets 全部保留。
- [ ] 在 `docs/compatibility.md` 写入实际 Windows、Chrome、Tolaria 版本和构建号。

当前机器检测到 Chrome 和 Tolaria，但本轮未向现有 Chrome profile 或真实 Vault 写入，以避免污染用户数据；因此本清单仍未宣称 Product Alpha 已完成。

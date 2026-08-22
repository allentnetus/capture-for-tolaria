# Capture for Tolaria V0.1 故障排查

> 当前文档记录 V0.1 的用户可见错误边界。开发目录和发布目录的 `pnpm.cmd run check`、Golden Test、Alpha Installer 资产组装和 Windows Pester 均已完成；真实 Chrome、Tolaria、Vault 用户链路仍待验收，不能用代码级门禁替代这些证据。

## 1. Capture 按钮不可用

检查：

1. 当前页面是否为公开文章页面。
2. Chrome 是否允许当前扩展在用户点击后执行脚本。
3. Extension 的 Service Worker 是否仍在运行。
4. Chrome 扩展管理页是否显示 Extension 错误。

受限页面、浏览器内部页面和扩展页面不属于 V0.1 Article Capture 保证范围。不要通过申请宽泛站点权限绕过这个边界。

## 2. 无法连接 Helper

检查：

- Native Host 注册是否位于当前用户配置范围。
- Native Host manifest 的 `allowed_origins` 是否包含当前 Extension ID。
- Helper 可执行文件路径是否存在且可执行。
- Helper 的 stdout 是否被日志或调试输出污染；日志必须写入 stderr。
- Extension 与 Helper 的协议版本是否兼容。

先执行 `hello`，确认 capabilities 包含 `clip.article`，再发送文章请求。

## 3. `VAULT_NOT_CONFIGURED`

需要通过 per-user 配置流程设置 Vault 根目录。配置动作只记录并验证根目录，不应预创建 `Inbox/Web`。确认：

- 路径存在或用户有权创建目标 Vault。
- 路径是目录而不是文件。
- 目标目录不位于受限或不可访问位置。
- 配置文件位于 `%LOCALAPPDATA%\\CaptureForTolaria\\config.json`。

## 4. `INVALID_PATH`

`relativeFolder` 只接受相对目录，例如 `Inbox/Web`。以下输入必须被拒绝：

```text
C:\\Users\\Public
\\\\server\\share
/absolute/path
..
Inbox/../private
```

不要让用户通过修改 Folder 字段写入 Vault 之外的位置。Helper 必须重复校验并检查 Windows reparse point。

## 5. 文件冲突与 `TARGET_EXISTS`

V0.1 是 create-only。目标文件已存在时 Helper 会依次尝试确定性的 `(2)`、`(3)` 等后缀，不覆盖原文件；达到后缀上限时返回 `NAME_EXHAUSTED`。如果底层直接返回 `TARGET_EXISTS`，同样表示原文件未被覆盖。当前版本不提供覆盖、删除或任意重命名接口。

如果连续出现 `ATOMIC_COMMIT_UNAVAILABLE`，检查目标 Vault 文件系统是否支持同一卷 hard link；不要把它改成普通覆盖写入。

## 6. Markdown 内容不完整

检查文章是否使用了受限脚本渲染、登录墙、无限滚动或非标准正文结构。Extractor 应报告 Readability 质量失败，而不是把整页导航和 Footer 静默写入 Markdown。用固定 fixture 复现后再调整提取规则。

## 7. 如何收集诊断信息

提交问题时提供：

- Windows 版本
- Chrome 版本
- Extension 版本
- Helper 版本
- 协议版本
- 错误码和脱敏后的错误消息
- 是否 Tolaria 正在运行
- 是否首次配置 Vault

不要提交 Vault 绝对路径、文章正文、cookies、页面凭据或包含个人信息的日志。

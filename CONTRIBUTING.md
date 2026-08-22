# 贡献指南

## 代码边界

V0.1 只接受 Windows、Chrome、Article Capture 和 Direct File Channel 范围内的变更。协议、网页提取、Markdown、Helper 文件系统和 Extension UI 保持独立边界；不要把它们合并成无法单测的大模块。

新增能力前先更新对应 ADR、协议文档或安全文档。不要添加 MCP、AI、云服务、遥测、图片下载或宽泛浏览器权限作为“顺手改动”。

## 开发流程

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run lint
pnpm.cmd run typecheck
pnpm.cmd run test
pnpm.cmd run test:golden
pnpm.cmd run build
```

文件系统和 Windows 安装器变更必须在 Windows 上运行对应测试。网页提取变更需要增加固定 fixture 和 Golden 输出；恶意 HTML 需要有拒绝或清理断言。

## 提交要求

- 代码、测试、协议和文档保持同一变更边界。
- 不提交 Vault 数据、Release 私钥、Native Host 用户路径或生成的 `dist/`。
- 每个 bug 修复至少包含一个能复现原问题的行为测试。
- 运行过的命令和已知限制写入 Pull Request 描述。
- 变更必须说明是否改变 Extension 权限、Native Messaging action、文件写入语义或隐私边界。

当前目录没有 Git 元数据时，不要自行初始化仓库或创建提交；先由仓库所有者决定 Git 根目录和提交策略。

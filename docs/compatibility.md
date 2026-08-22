# V0.1 兼容性证据

本文只记录实际执行过的环境和路径，不把未验证内容写成“Works with Tolaria”。

## 当前验证环境

| 项目 | 结果 |
| --- | --- |
| OS | Windows 11 Home，内核 `10.0.26200` |
| Arch | x64 |
| Node.js（开发构建） | `v24.15.0` |
| pnpm | `11.19.0` |
| PowerShell | `7.6.5`；Windows PowerShell `5.1.26100.9168` 脚本兼容性已验证 |
| Extension | `0.1.0`，`version_name` 为 `0.1.0 Alpha 1`，MV3，协议 `1` |
| Helper | `0.1.0-alpha.1`，当前开发目录已完成 SEA x64 EXE 构建；no-Node Helper 与完整 Installer/Pester 安装链路已通过 |
| Chrome | 已检测到 Chrome，但本轮未向现有 profile 加载 Extension；具体版本未记录 |
| Tolaria | 已检测到 Tolaria 进程，但本轮未向真实 Vault 写入或验证文件监听 |

## 已验证

上表中的历史环境验证保留为 V0.1 基线。本轮在开发目录完成了 `pnpm.cmd run check`、Golden Test、SEA Helper 构建、Alpha Installer ZIP 组装和 Windows PowerShell/Pester 安装器验收（9 passed、0 failed），随后在发布目录独立重复并通过相同门禁。真实 Chrome、Tolaria、Vault 和陌生用户安装链路仍未验证；这些状态不得互相替代。

- `pnpm run lint`
- `pnpm.cmd run check`
- `pnpm.cmd run test:golden`
- 全 workspace TypeScript typecheck
- 6 个 workspace 的单元测试和集成测试
- Extractor 恶意 HTML、危险 URL、Unicode、代码块和 fallback 测试
- Markdown GFM 转换和 6 个 Golden fixture
- 协议版本、action、路径、URL、payload 大小和 capabilities 校验
- Windows 临时 Vault 的逐级目录创建、路径穿越、symlink/junction、最终目标 reparse point、冲突后缀和并发 create-only 写入
- Windows 属性级 reparse point 检查：普通目录通过、junction 被拒绝
- Native Messaging 4-byte little-endian framing、分段读取、多消息、非法 JSON/UTF-8/长度和截断帧
- Extension manifest 权限集合、固定 key 和 Native Host `allowed_origins` ID 一致性
- Mock Host 的 Extension → Helper → File Channel 垂直链路
- SEA 单文件 Helper 仅通过 `hello` 启动，Pester 测试不调用 Node.js runtime
- SEA Helper 构建和 Alpha Installer ZIP 组装
- Windows PowerShell `5.1.26100.9168` 下的 9 个 Installer/Pester 测试

## 当前阻断的自动化验收

- GitHub 远程 CI 和 CodeQL 需要在远程修复提交后重新核对；CodeQL 还需要仓库设置启用 Code scanning。

## 未验证

以下项目需要真实 Chrome、Tolaria 和干净用户配置，当前不能标记为通过：

- Chrome `activeTab` / `scripting` 注入真实公开文章
- Chrome Native Messaging 注册后的真实 Extension UI 往返
- Tolaria 文件监听对新 Markdown 的实际感知
- 无 Node.js 的陌生用户完整 Install → Capture → Repair → Upgrade → Uninstall 流程
- 真实 Tolaria 版本、构建号和兼容性矩阵

Product Alpha 发布判断必须在具备这些环境后重新执行 `tests/e2e/product-alpha-checklist.md`。

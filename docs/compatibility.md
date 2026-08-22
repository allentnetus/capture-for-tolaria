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
| Helper | `0.1.0-alpha.1`，SEA x64 构建脚本已按 Alpha 版本更新；当前开发机尚未完成本版本 EXE 重建 |
| Chrome | 已检测到 Chrome，但本轮未向现有 profile 加载 Extension；具体版本未记录 |
| Tolaria | 已检测到 Tolaria 进程，但本轮未向真实 Vault 写入或验证文件监听 |

## 已验证

上表中的历史环境验证保留为 V0.1 基线；Alpha 版本合同和打包脚本的当前门禁状态以本次发布验收记录为准。由于当前开发机的 Chrome/注册表权限限制，本次尚未把 Alpha Helper EXE 或真实安装链路标记为通过。

- `pnpm run lint`
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
- Windows PowerShell 5.1 `configure-vault.ps1` → 无 BOM config → 真实 SEA Helper `clip.article` 写入
- Windows per-user Install、Repair、Upgrade、Uninstall、Vault 配置和数据保留测试

## 未验证

以下项目需要真实 Chrome、Tolaria 和干净用户配置，当前不能标记为通过：

- Chrome `activeTab` / `scripting` 注入真实公开文章
- Chrome Native Messaging 注册后的真实 Extension UI 往返
- Tolaria 文件监听对新 Markdown 的实际感知
- 无 Node.js 的陌生用户完整 Install → Capture → Repair → Upgrade → Uninstall 流程
- 真实 Tolaria 版本、构建号和兼容性矩阵

Product Alpha 发布判断必须在具备这些环境后重新执行 `tests/e2e/product-alpha-checklist.md`。

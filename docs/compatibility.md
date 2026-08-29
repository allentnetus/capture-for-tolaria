# V0.1 兼容性证据

本文只记录实际执行过的环境和路径，不把未验证内容写成“Works with Tolaria”。

## 当前验证环境

| 项目 | 结果 |
| --- | --- |
| OS | Windows 11 Home，内核 `10.0.26200` |
| Arch | x64 |
| Node.js（开发构建） | `v24.15.0` |
| pnpm | `11.19.0` |
| PowerShell | 本轮为 `7.6.4`；Windows PowerShell `5.1.26100.9168` 脚本兼容性已验证 |
| Extension | `0.1.0`，`version_name` 为 `0.1.0 Beta 1`，MV3，协议 `1` |
| Helper | `0.1.0-beta.1`，公开 Beta.1 Release 的 SEA x64 EXE 已下载，并与公开 `SHA256SUMS.txt` 匹配 |
| Chrome | 已检测到 Chrome，但本轮未向现有 profile 加载 Extension；具体版本未记录 |
| Tolaria | 已检测到 Tolaria 进程，但本轮未向真实 Vault 写入或验证文件监听 |

## 已验证

上表中的历史环境验证保留为 V0.1 基线。历史基线曾记录一次 Pester 5.7.1 安装器验收（9 passed、0 failed）；本轮在开发目录和发布目录均重新通过完整 `pnpm.cmd run check`、独立 Golden Test、SEA Helper/Installer 构建、10 个 Pester 测试和最终发布内容门禁，包含 root `lint`、`build`、`typecheck`、workspace 测试及 Extension/Markdown 门禁。真实 Chrome、Tolaria 文件监听、公开文章 Capture 和陌生用户完整安装链路仍未验证；这些状态不得互相替代。

- `pnpm run lint`
- `pnpm.cmd run check`
- `pnpm.cmd run test:golden`
- 全 workspace TypeScript typecheck
- 6 个 workspace 的单元测试和集成测试
- Extractor 恶意 HTML、危险 URL、Unicode、代码块和 fallback 测试
- Markdown GFM 转换、7 个 Golden fixture 和 1 个图片本地化内存链路
- 协议版本、action、路径、URL、payload 大小和 capabilities 校验
- Windows 临时 Vault 的逐级目录创建、路径穿越、symlink/junction、最终目标 reparse point、冲突后缀和并发 create-only 写入
- Windows 属性级 reparse point 检查：普通目录通过、junction 被拒绝
- Native Messaging 4-byte little-endian framing、分段读取、多消息、非法 JSON/UTF-8/长度和截断帧
- Extension manifest 权限集合、固定 key 和 Native Host `allowed_origins` ID 一致性
- Mock Host 的 Extension → Helper → File Channel 垂直链路
- SEA 单文件 Helper 仅通过 `hello` 启动，Pester 测试不调用 Node.js runtime
- SEA Helper 构建和 Beta.1 Installer ZIP 组装、发布内容自检
- 当前 Beta.1：Windows PowerShell `5.1.26100.9168` / Pester `5.7.1` 下的 10 个 Installer/Pester 测试 `10 passed、0 failed`

## Beta.1 当前开发验证

以下证据来自开发目录和发布目录的 Beta.1 图片能力实现：

- Extractor 覆盖 `data-src`、`data-srcset`、`srcset`、`picture/source`、相对 URL、重复候选、凭据 URL、`blob:`、危险协议和代码块场景。
- Helper 受限下载器覆盖允许 MIME、SVG/HTML 拒绝、单图/总量/流式超限、单图/整体超时、手动重定向、IPv4/IPv6 私有目标、DNS 地址绑定和无 Cookie/`Authorization` 请求头。
- Bundle Writer 覆盖 `Assets/` create-only、同 hash 复用前的完整性校验、Markdown 冲突、失败清理和 Assets/目标 reparse point。
- Extension 覆盖图片 payload、协议校验前的 128 张候选上限、结果摘要/warning 传递和 Popup 的 `localized` / `fallback` 文案。
- 合成 `wechat-article.html` 内存链路确认图片 Markdown 使用内容哈希相对路径，支持图片 URL 中的平衡括号，普通链接和 fenced code 不被改写。
- Native Messaging 完整 UTF-8 帧测试确认图片元数据计入 `MAX_NATIVE_MESSAGE_BYTES`。

本轮已在隔离临时 `LOCALAPPDATA`、临时 Vault 和临时安装根中从公开 Installer ZIP 执行 `configure-vault → install（使用 ZIP 根目录内置 Helper）→ Repair → 幂等重装 → 默认卸载 → ClearConfig`，并验证 Helper、Native Host manifest、HKCU 注册、Vault/config 保留与清理；该证据不等同于真实 Chrome/Tolaria Capture 验收。

## 远程发布与持续集成证据

### 历史 Alpha.1 快照（2026-08-22）

- 历史 Alpha.1 发布快照中的 `main`、`origin/main` 和 tag `v0.1.0-alpha.1` 指向 `6bd5c499dd724b05d72467cd6476b52bf4b2bce3`，当时发布目录工作区干净；这不代表当前 Beta.1 发布目录状态。
- 该历史提交对应的远程 `CI`（`32576718709`）、`Release`（`32576718735`）和 `CodeQL`（`32576696865`）workflow 均为 `completed / success`。
- GitHub API 当时确认 `v0.1.0-alpha.1` 的公开 Release 对象为 `draft=false`、`prerelease=true`，并已上传 Extension ZIP、Installer ZIP、Helper EXE、`SHA256SUMS.txt` 和 `SBOM.spdx.json` 五项资产。
- 尚未在独立临时目录下载这些历史公开资产并将下载文件与 `SHA256SUMS.txt` 重新比对；“workflow 成功”和“下载后校验通过”仍是两个独立状态。

### 当前 Beta.1 状态（截至 2026-08-29）

- 当前源码和发布目录基线为 `v0.1.0-beta.1`；已完成开发目录到发布目录的单向同步、发布目录清理、本地质量门禁和发布目录复验。
- PR [#11](https://github.com/allentnetus/capture-for-tolaria/pull/11) 已合并到 `main`，合并提交为 `4e206a14e91ce05e6e66614a1667ff7a20864098`；tag `v0.1.0-beta.1` 已指向该提交。
- Release workflow `33237816354` 已成功完成；GitHub Release `v0.1.0-beta.1` 为 `draft=false`、`prerelease=true`，已上传 Extension ZIP、Installer ZIP、Helper EXE、`SHA256SUMS.txt` 和 `SBOM.spdx.json` 五项资产。
- 公开资产下载后与 `SHA256SUMS.txt` 的哈希和大小均匹配：Extension `0905BA2758676BAF3C1FAEB102207612DBA8C6652EE06A134FCE85A641A1BD74`、Helper `3AAB4B8353552A180B5C64C86B9B7DFBFE3385C9E52E525AE6F19B02508D1CD5`、Installer `88DF9160F73BD54396C08E446D7DBE4B8171C67E6E490D04D3C9FFD37A922228`、SBOM `85C43454A371241668F0A0FE081A31573E31C6483FBD02CE699C994CADBDD270`。
- 本轮已完成隔离临时环境的 Installer 安装、Repair、幂等重装和卸载验收；真实 Chrome、Tolaria、Vault 文件监听和公开文章 Capture 仍未验证。

## 未验证

以下项目需要真实 Chrome、Tolaria 和干净用户配置，当前不能标记为通过：

- Chrome `activeTab` / `scripting` 注入真实公开文章
- Chrome Native Messaging 注册后的真实 Extension UI 往返
- Tolaria 文件监听对新 Markdown 的实际感知
- 无 Node.js 的陌生用户完整 Install → 加载 Extension → Capture → 检查 Markdown/Vault → Repair → Upgrade → Uninstall 流程（本轮仅验证隔离 Installer 侧链路）
- 真实 Tolaria 版本、构建号和兼容性矩阵

Product Alpha 发布判断必须在具备这些环境后重新执行 `tests/e2e/product-alpha-checklist.md`。

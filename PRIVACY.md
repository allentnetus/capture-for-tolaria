# 隐私声明

## V0.1 行为

Capture for Tolaria V0.1 是 local-first 工具：用户点击 Capture 后，Extension 读取当前页面并在本机生成 Markdown，Native Helper 将文件写入用户明确授权的 Tolaria Vault。

V0.1 不包含：

- telemetry 或分析 SDK
- 账号、云同步或服务器上传
- 网页正文远程处理
- 浏览历史或 cookies 采集
- 页面凭据或无关 DOM storage 采集
- 后台网络抓取

来源 URL 会作为 Markdown 元数据写入本地文件。Alpha.1 的保存行为不会自动下载图片；Beta.5 仅在用户点击剪藏、且 Extractor 已识别出正文图片时，由 Helper 对公开图片 URL 执行受限本地化。

存储路径设置也只在本机处理：Extension 的 `chrome.storage.local` 只保存 Vault 内默认相对目录 `defaultRelativeFolder`；Vault root 由 Helper 保存到当前用户应用数据目录中的 `CaptureForTolaria` 配置文件。两者都不会上传到网络，普通 `clip.article` 请求也不携带 Vault root 绝对路径。

## Beta.5 图片本地化边界

- 只处理正文中的 `img` / `picture/source` 图片候选；支持 `data-src`、`data-srcset`、`srcset` 和相对 HTTP/HTTPS URL。
- 不读取或转发 cookies、`Authorization`、页面凭据或浏览器登录态。图片请求使用无凭据方式；Helper 在每次请求前检查重定向目标，并将实际连接固定到通过检查的 DNS 地址，保留原始主机名用于 HTTP Host 和 TLS SNI。
- 默认单图上限 8 MiB、单次剪藏总上限 32 MiB、单图请求超时 10 秒、整次图片本地化预算 45 秒、最多 3 次重定向；只接受 JPEG、PNG、GIF、WebP 和 AVIF，拒绝 SVG。
- 成功图片写入用户授权 Vault 当前文章目录下的 `Assets/<sha256>.<ext>`；已有同哈希文件复用前会校验内容，Markdown 只改写成功资源。下载失败不丢失正文，远程图片引用保留并显示回退摘要。
- 图片字节不会进入 Native Messaging payload，也不会上传云端；CSS 背景图、`blob:`、登录后图片和需要防盗链凭据的资源不属于 Beta.5 范围。如果用户显式为当前本机 fake-IP 网络启用 `allowSyntheticDns`，Helper 仍不读取或发送 cookies、`Authorization` 或页面凭据；该开关只允许当前代理映射段继续使用无凭据请求，默认关闭。

## 本地数据

Vault 根目录可在 Extension Popup 的 `Settings` 页面配置，也可使用 `configure-vault.ps1` 作为兼容入口。Helper 只接受经过路径、权限和 reparse point 校验的用户目录，配置文件位于当前用户应用数据目录中的 `CaptureForTolaria` 配置文件：

```text
CaptureForTolaria/config.json
```

Vault 内默认目录保存在 Extension 的 `chrome.storage.local` 键 `defaultRelativeFolder` 中，默认值为 `Inbox/Web`。该值只允许安全的相对目录；缺失、读取失败或不安全时回退默认值。设置页不会把 Vault root 写入 Extension storage，也不会把默认目录写入 Helper 配置。

卸载默认删除 Helper、Native Host manifest 和当前用户注册信息，不删除 Vault、Markdown、Assets 或 Vault 配置。只有用户明确使用 `-ClearConfig` 时才删除配置文件。

## 未来变更

任何网络能力、MCP 连接或 AI 服务都必须在进入版本前独立记录数据类别、目的、授权、域名、保留周期和失败策略；不能隐式加入 V0.x。

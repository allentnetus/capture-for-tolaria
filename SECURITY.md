# 安全策略

Capture for Tolaria 将网页 DOM、标题、来源 URL、metadata 和 Markdown 视为不可信输入。Helper 是本地文件系统安全边界，不能提供任意路径写入、任意删除或任意目录操作。

## 支持版本

| 版本 | 支持 |
| --- | --- |
| 当前公开 `0.1.0-beta.4` | 是，GitHub Pre-release 已发布，唯一公开资产为自包含 Installer ZIP；真实 Chrome/Tolaria 端到端 Capture 仍需独立核验 |
| 历史公开 `0.1.0-alpha.1` | 是，公开 Alpha；图片自动本地化尚未作为 Alpha 发布能力 |
| 其他版本 | 未承诺 |

## 报告漏洞

不要在公开 Issue 中发布可利用的路径穿越、Native Messaging 注入、Extension 权限绕过、reparse point 逃逸或 Vault 数据泄露细节。请通过仓库的私有 Security Advisory 渠道提交，并提供：

- 受影响版本和 Windows/Chrome 版本
- 最小复现步骤或测试样例
- 预期行为与实际行为
- 是否需要管理员权限、Node.js 或 Tolaria 运行
- 已脱敏的日志和错误码

不要附带 Vault 绝对路径、文章正文、cookies、历史记录、账号凭据或 Release 私钥。

## 安全不变量

- Extension 只使用 `activeTab`、`scripting`、`nativeMessaging`。
- 所有协议请求携带版本和 request ID，并由 Extension 与 Helper 分别运行时校验。
- HTML 经过 Readability、Sanitization、DOM Cleanup 后才进入 Markdown；图片候选只允许无凭据 HTTP/HTTPS URL。
- `relativeFolder` 逐级创建和校验 canonical path，拒绝 `..`、symlink、junction 和 reparse point 逃逸。
- 文件写入 create-only、atomic，不覆盖已有文件。
- 图片下载在 Helper 内重复校验目标地址，拒绝 loopback、私有、link-local、multicast、unspecified、保留地址、危险重定向、凭据 URL、超限响应和 `image/svg+xml`；实际 HTTP(S) 连接固定到已检查的 DNS 地址，原始主机名只用于 Host 和 TLS SNI。
- 图片资源使用 `Assets/<sha256>.<ext>` 内容寻址，临时资源通过 create-only 提交；已有同名 Asset 复用前校验文件大小和 SHA-256；Markdown 失败时只清理本次创建且未被已有 Markdown 引用的资源。
- Extension 在协议校验前最多传递 128 个图片候选，超出部分保留原始远程引用；Helper 的整次图片本地化预算为 45 秒。
- V0.1 local-first，无 telemetry、账号、云上传、浏览历史和 cookies 采集；图片请求不携带 cookies 或 `Authorization`。

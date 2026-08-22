# 安全策略

Capture for Tolaria 将网页 DOM、标题、来源 URL、metadata 和 Markdown 视为不可信输入。Helper 是本地文件系统安全边界，不能提供任意路径写入、任意删除或任意目录操作。

## 支持版本

| 版本 | 支持 |
| --- | --- |
| 当前 `0.1.0-alpha.1` | 是，开发中的 Alpha |
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
- HTML 经过 Readability、Sanitization、DOM Cleanup 后才进入 Markdown。
- `relativeFolder` 逐级创建和校验 canonical path，拒绝 `..`、symlink、junction 和 reparse point 逃逸。
- 文件写入 create-only、atomic，不覆盖已有文件。
- V0.1 local-first，无 telemetry、账号、云上传、浏览历史和 cookies 采集。

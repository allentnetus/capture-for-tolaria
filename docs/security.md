# Capture for Tolaria V0.1 安全边界

> 状态：V0.1 安全基线
>
> 本项目默认 local-first、无 telemetry、无账号、无云端上传。安全设计的首要目标是：网页内容不应借助剪藏流程获得任意本地文件写入能力。

## 1. 信任边界

```text
不可信 Internet DOM / URL / metadata
              ↓ 校验、Readability、Sanitization
Chrome Extension
              ↓ 版本化业务协议
Native Messaging Helper
              ↓ 路径沙箱、reparse 检查、atomic create-only
用户明确授权的 Vault
```

网页正文、标题、链接、图片 URL 和 metadata 都是不可信输入。Helper 是文件系统安全边界，不能信任 Extension 已经完成的校验，必须重复执行服务端校验。

## 2. Extension 权限

V0.1 只申请：

- `activeTab`
- `scripting`
- `nativeMessaging`

通过用户点击临时读取当前页面，不申请宽泛 `host_permissions`。Extension 不读取 cookies、浏览历史、页面凭据或无关 DOM storage。

## 3. HTML 与 Markdown

DOM 必须先克隆，再在克隆内容上运行 Readability。结果必须经过：

1. Readability 提取。
2. 空结果和质量检查。
3. Sanitization，移除脚本、事件属性和不安全 URL 协议。
4. DOM Cleanup，移除隐藏导航、Cookie Banner 和无关控件。
5. Turndown + GFM 转换。

Readability 失败时不得静默把整页 `body.innerText` 写入 Vault。Alpha.1 只保留经过协议和 URL 检查的远程图片 URL；Beta.1 对正文中识别出的公开图片执行独立的 Helper 侧受限下载。

## 4. 文件系统安全

Helper 只能处理业务级 `clip.article`，不能提供 `writeFile(anyPath)`、任意删除、任意重命名或目录枚举 API。

写入要求：

- 只接受相对 `relativeFolder`，拒绝盘符、UNC、绝对路径、空段和 `..`。
- 使用配置中的 Vault 根目录，不接受请求传入的绝对 Vault 路径。
- `relativeFolder` 逐级创建；每一级创建或发现后立即检查真实路径和 `FILE_ATTRIBUTE_REPARSE_POINT` 属性。
- Windows 属性级查询失败时安全失败；canonical path containment 作为第二层防护。
- 最终目标目录和已有目标文件也执行 reparse point 检查。
- canonical path 必须仍位于 Vault 根目录内。
- 拒绝 symlink、junction 和其他 Windows reparse point 逃逸。
- 文件名使用确定性 `YYYYMMDD - Title.md` 规则，并清理 Windows 非法字符、保留名称、尾部空格和尾部句点。
- 使用同一卷临时文件和 create-only 提交语义；目标已存在时按确定性规则尝试 `(2)`、`(3)` 等冲突后缀，不覆盖原文件；达到后缀上限时返回 `NAME_EXHAUSTED`。底层明确报告目标冲突时仍可使用 `TARGET_EXISTS`，但它不是当前正常冲突分配路径。
- atomic 提交依赖同一卷 hard link；文件系统不支持该能力时返回 `ATOMIC_COMMIT_UNAVAILABLE`，不得降级为覆盖写入。
- 临时文件提交失败时清理临时文件，并返回稳定错误。

图片 Bundle 还必须满足：

- `img` / `picture/source` 候选只接受无用户名、无密码的 `http:` 或 `https:` URL；Extension 不传图片二进制。
- 每次请求前解析并检查 DNS 目标，默认拒绝 loopback、RFC1918 私有、link-local、multicast、unspecified 和保留地址；`Location` 重定向目标逐次重复校验。仅当用户显式设置 `allowSyntheticDns=true` 时，DNS 名称解析出的当前 fake-IP 映射段 `198.18.0.0/15` 和 `fdfe:dcba:9876::/48` 可作为本机代理兼容例外；直接写入的 IP、真实私有目标和其他保留地址仍拒绝。
- 只允许 `image/jpeg`、`image/png`、`image/gif`、`image/webp` 和 `image/avif`；默认单图 8 MiB、总量 32 MiB、10 秒超时和 3 次重定向上限。
- 资源只写入当前文章目录的 `Assets/<sha256>.<ext>`，使用 create-only 语义；已有同 hash 文件可复用但不得覆盖。Markdown 写入失败时，不删除已有或仍被 Markdown 引用的 Asset。

## 5. 协议安全

所有请求必须携带 `protocolVersion`、`requestId`、`extensionVersion` 和业务 `action`，并进行运行时校验。拒绝未知 action、不支持版本、空标识、非 HTTP/HTTPS 来源、超限 Markdown、越界路径和错误 payload 形状。

Native Messaging stdout 只能输出协议帧。任何日志污染 stdout 都可能破坏 framing，因此诊断信息必须走 stderr。

## 6. 隐私与网络

V0.1 不包含：

- telemetry
- 云端服务器
- 账号系统
- 浏览历史采集
- cookies 上传
- 页面凭据采集
- 后台网络抓取

保存的 Markdown 和图片 Assets 仅写入用户授权的本地 Vault。来源 URL 是用户明确剪藏文章的元数据；它不会单独触发网络请求。Beta.1 的图片请求只处理用户本次剪藏中识别到的公开图片，不携带 cookies、`Authorization` 或页面凭据；单张图片失败时正文仍保存并回退到安全远程引用。

## 7. 发布前检查

发布前必须完成：

- 依赖与源码来源审计。
- Native Messaging framing 测试。
- Windows reparse point、路径穿越、跨卷和冲突写入测试。
- 恶意 HTML、危险 URL 和超大 payload 测试。
- 无 Node.js、无管理员权限的干净用户流程。
- 卸载后确认 Vault、Markdown 和 Assets 不被删除。

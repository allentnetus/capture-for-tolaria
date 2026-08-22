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
- 图片自动下载

来源 URL 会作为 Markdown 元数据写入本地文件。Helper 不根据该 URL 发起网络请求；远程图片 URL 在 V0.1 只作为 Markdown 引用保留。

## 本地数据

Vault 根目录由用户配置，配置文件位于：

```text
%LOCALAPPDATA%\CaptureForTolaria\config.json
```

卸载默认删除 Helper、Native Host manifest 和当前用户注册信息，不删除 Vault、Markdown、Assets 或 Vault 配置。只有用户明确使用 `-ClearConfig` 时才删除配置文件。

## 未来变更

任何网络能力、MCP 连接或 AI 服务都必须在进入版本前独立记录数据类别、目的、授权、域名、保留周期和失败策略；不能隐式加入 V0.x。

# ADR-008：以文件兼容为 V0.1 的 Tolaria 集成边界

- 状态：Accepted
- 日期：2026-08-21

## 背景

V0.1 的目标是可靠创建 Tolaria 可感知的 Markdown 文件，而不是复制 Tolaria 内部实现或依赖尚未稳定的 MCP Bridge。用户需要在 Tolaria 未运行时也能保存。

## 决策

V0.1 只依赖用户授权 Vault 的普通目录和 Markdown 文件，以及 Tolaria 对新文件的正常文件监听。兼容性文档必须记录实际验证过的 Tolaria 版本、构建号和文件感知结果；不能笼统声称“Works with Tolaria”。MCP 9710、Vault Context、搜索、更新和 UI 控制延后到 V0.2。

## 后果

- V0.1 的集成面小、可离线、易于迁移。
- V0.1 不能读取已有 Vault 语义或请求 Tolaria 打开新笔记。
- 后续 MCP 接入必须采用接口兼容而非复制 Tolaria 源码，并重新评估版本协商和许可证义务。

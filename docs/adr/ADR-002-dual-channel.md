# ADR-002：分离 Direct File Channel 与 MCP Channel

- 状态：Accepted
- 日期：2026-08-21

## 背景

基础剪藏需要在 Tolaria 未启动、9710 Bridge 不可用时仍能保存；高级能力又需要 Tolaria 提供 Vault Context、搜索和更新接口。把两者强制串成一条链路会让基础保存依赖高级服务。

## 决策

V0.1 只实现 Direct File Channel，直接创建 Vault Markdown 文件。MCP Channel 延后到 V0.2，负责 Context、Search、Update、UI 和 Intelligence。Native Helper 保留未来接入 MCP 的边界，但 V0.1 不连接 9710。

## 后果

- V0.1 的离线保存路径更可靠、实现更小。
- File Channel 无法提供多 Vault、语义搜索和已有笔记更新。
- 后续 MCP 接入必须保持 File Channel 可独立工作，不得把 MCP 变成基础保存前置条件。

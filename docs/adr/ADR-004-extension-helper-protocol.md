# ADR-004：Extension 与 Helper 使用版本化业务协议

- 状态：Accepted
- 日期：2026-08-21

## 背景

Native Messaging 只提供字节传输，不应直接暴露文件系统原语。Extension 和 Helper 需要独立升级，并在不兼容时安全失败。

## 决策

所有消息使用带 `protocolVersion`、`requestId`、组件版本和 `action` 的 JSON 契约。V0.1 只注册 `hello` 和 `clip.article`。连接先执行 `hello`，再根据协议版本和 capabilities 决定是否发送文章请求。双方都进行运行时校验，Helper 不信任 Extension 已做过的检查。

## 后果

- 可以稳定拒绝未知 action、版本、路径和超限 payload。
- 响应可以通过 `requestId` 与请求关联。
- 协议字段和错误码属于兼容性接口，修改时必须更新 Extension、Helper、测试和文档。
- 不提供通用 `writeFile(anyPath)` 或任意文件系统动作。

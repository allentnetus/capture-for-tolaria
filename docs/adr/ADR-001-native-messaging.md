# ADR-001：使用 Chrome Native Messaging 连接 Extension 与 Helper

- 状态：Accepted
- 日期：2026-08-21

## 背景

Chrome Extension 不能直接安全地操作用户 Vault，也不能把任意本地路径暴露给网页上下文。Tolaria MCP Bridge 不是 V0.1 的可靠前置依赖。

## 决策

使用 Chrome Native Messaging 连接 MV3 Extension 与本机 Helper。Extension 只发送版本化业务请求，Helper 负责协议校验和受限文件操作。开发期可以使用 Node.js 运行 Helper，正式发布必须提供单文件可执行程序。

## 后果

- 需要为每个用户安装 Native Host manifest，并维护 Extension ID 与 `allowed_origins` 的关系。
- stdout 必须严格保留给 Native Messaging framing，日志只能写 stderr。
- Helper 成为必须持续审计的本地安全边界。
- 不依赖宽泛 `host_permissions`，也不把文件系统权限交给 Content Script。

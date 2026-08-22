# 第三方依赖声明

依赖版本以提交的 `pnpm-lock.yaml` 为准。发布前必须重新核对每个实际打包依赖的 LICENSE、NOTICE 和源码来源；此文件不是对上游许可证文本的替代。

| 依赖 | 当前锁定版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| `@mozilla/readability` | 0.5.0 | Article 正文提取 | Apache-2.0 |
| `dompurify` | 3.4.14 | HTML Sanitization | Apache-2.0 / MPL-2.0，按上游发行包核对 |
| `turndown` | 7.2.4 | HTML 到 Markdown | MIT |
| `turndown-plugin-gfm` | 1.0.2 | GFM 表格、任务列表和删除线 | MIT |
| `zod` | 3.25.76 | 协议运行时校验 | MIT |
| `jsdom` | 26.1.0 | Node 测试 DOM | MIT |
| `esbuild` | 0.28.2 | Extension/Helper 构建 | MIT |
| `postject` | 1.0.0-alpha.6 | Node SEA 资源注入 | MIT |
| `vitest` | 3.2.7 | 测试运行器 | MIT |
| `typescript` | 5.8.3 | 类型检查和声明生成 | Apache-2.0 |
| `eslint` | 9.39.5 | 静态检查 | MIT |

## 审计要求

- Release 前执行依赖许可证和源码来源审计。
- 不复制 Tolaria AGPL 实现；只实现独立的协议和文件兼容层。
- 若发现直接复制受限源码，暂停 Apache-2.0 Release 配置并重新评估义务。
- Release ZIP 不包含用户 Vault、配置文件、CI secret 或 Extension 私钥。

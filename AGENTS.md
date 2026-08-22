# Capture for Tolaria 项目规则

## 开发与发布目录边界

- `G:\Capture for Tolaria` 是本地开发、测试和问题修复目录，也是开发阶段的源码基准。
- `G:\发布\Capture for Tolaria-GitHub` 是 GitHub 发布专用目录；GitHub 的 commit、push、tag 和 Release 只能从该目录执行。
- 发布前只允许按“开发目录 → 发布目录”单向同步经过审核的源码；不得把发布目录反向覆盖开发目录，也不得在两个目录之间做无审计的双向镜像。
- 发布目录应使用独立的 Git 历史和远端配置。开发目录不作为 GitHub 发布工作区。
- 同步或提交时不得包含 `.pnpm-store/`、`node_modules/`、`dist/`、`release/`、Vault 数据、`.env` 文件、私钥、证书、Native Host 用户路径、日志或测试临时目录。

## 验证要求

- 在开发目录完成修改后，先运行项目质量门禁并确认通过，再同步到发布目录。
- 在发布目录中重新安装依赖、运行质量门禁并检查待提交文件，确认内容、版本和发布资产符合 Alpha Release 清单后，才能 commit、push 或创建 tag。
- 任何 GitHub 发布状态都必须与本地开发状态、发布目录状态、CI 状态和实际 Release 状态分别核对，不得用其中一个状态替代其他状态。

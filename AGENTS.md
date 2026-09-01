# Capture for Tolaria 项目规则

## 开发与发布目录边界

- 开发工作区是本地开发、测试和问题修复目录，也是开发阶段的源码基准。
- 发布工作区是 GitHub 发布专用目录；GitHub 的 commit、push、tag 和 Release 只能从该目录执行。
- 发布前只允许按“开发目录 → 发布目录”单向同步经过审核的源码；不得把发布目录反向覆盖开发目录，也不得在两个目录之间做无审计的双向镜像。
- 发布目录应使用独立的 Git 历史和远端配置。开发目录不作为 GitHub 发布工作区。
- 同步或提交时不得包含 `.pnpm-store/`、`node_modules/`、`dist/`、`release/`、Vault 数据、`.env` 文件、私钥、证书、Native Host 用户路径、日志或测试临时目录。

## 同步与用户交付

- 本地用户只领取当前 VERSION 对应的 capture-for-tolaria-installer-v<VERSION>.zip；Installer ZIP 必须自包含 Extension、Helper 和安装脚本，不把 Extension ZIP、独立 Helper、源码或开发依赖作为用户安装前置。
- 该 Installer ZIP 可在发布目录根部作为待上传或本地交付资产暂存，必须被 .gitignore 忽略，不进入源码 commit，也不得从发布目录反向复制到开发目录。
- 同步顺序固定为：开发目录修改并验证 → 只同步审核后的源码和文档 → 发布目录重新安装依赖并验证 → 从发布目录组装 Installer ZIP → 上传 GitHub Release → 用干净临时目录验证安装；node_modules/、dist/、release/ 仅可作为临时构建产物，完成后清理。
- GitHub Release 只公开 Installer ZIP；其他组包中间文件即使在 CI 中生成，也不作为用户下载包。

## 验证要求

- 在开发目录完成修改后，先运行项目质量门禁并确认通过，再同步到发布目录。
- 在发布目录中重新安装依赖、运行质量门禁并检查待提交文件，确认内容、版本和发布资产符合当前版本 Release 清单后，才能 commit、push 或创建 tag。
- 任何 GitHub 发布状态都必须与本地开发状态、发布目录状态、CI 状态和实际 Release 状态分别核对，不得用其中一个状态替代其他状态。

## 文档语言

- 后续与项目相关的说明文档统一使用中文，包括 README、docs、实施计划、验收报告、发布说明和规则说明。
- 代码、命令、文件路径、API、package、protocol 等技术标识保留原始写法；必要时仅在中文说明中保留英文原名。

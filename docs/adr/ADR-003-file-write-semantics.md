# ADR-003：采用 atomic、create-only 的文件写入语义

- 状态：Accepted
- 日期：2026-08-21

## 背景

剪藏不能覆盖用户已有笔记。普通 `rename` 或高层 `writeFile` 的默认行为不能单独证明“原子且不覆盖”，Windows 上还需要处理同卷、跨卷、目标冲突和临时文件清理。

## 决策

Helper 先在目标目录创建同卷临时文件并完整写入、flush 和关闭，再使用 Node `fs.link` 执行 create-only hard-link 提交；在 Windows 上该调用对应同卷的 `CreateHardLinkW`，目标已存在时原子失败且不会替换目标，成功后删除临时链接。V0.1 不使用普通 `fs.rename`，因为 Node API 不能表达不带 `MOVEFILE_REPLACE_EXISTING` 的 Windows 提交语义。实现配套 Windows proof test，覆盖临时文件、冲突、提交失败和清理语义；如果当前文件系统不支持同时满足 atomic 和 create-only，必须安全失败并阻断 Release。

## 后果

- 写入操作不能依赖普通可覆盖 rename 的直觉行为。
- 目标目录必须已经完成路径沙箱和逐级 reparse 检查。
- 临时文件始终和目标位于同一目录/卷；失败时必须清理临时文件并返回稳定错误。
- hard-link 提交会增加 Windows 文件系统兼容性测试成本，但最终路径只会在完整内容准备后出现，且不会覆盖用户已有数据。

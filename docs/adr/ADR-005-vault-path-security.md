# ADR-005：以逐级 canonical 校验保护 Vault 路径边界

- 状态：Accepted
- 日期：2026-08-21

## 背景

只做字符串前缀判断无法防御 `..`、symlink、junction、Windows reparse point、UNC 路径和路径规范化差异。Helper 一旦允许路径逃逸，就可能把网页输入变成任意文件写入。

## 决策

Vault 根目录只来自 per-user 配置，不来自请求。`relativeFolder` 只能由非空相对段组成，拒绝盘符、UNC、绝对路径、`.`、`..` 和非法文件名。写入时逐级创建或发现目录；每一级完成后立即检查真实路径、reparse 状态和 Vault 内 containment。最终文件路径必须再次 canonical 校验。

## 后果

- Helper 不能把最终绝对路径交给 Extension，也不能接受用户请求中的绝对输出路径。
- 配置阶段验证 Vault 根目录但不预创建 `Inbox/Web`。
- 路径安全测试必须覆盖 Windows 大小写、尾部点号、junction、symlink、UNC 和跨卷情况。
- 实现复杂度高于字符串拼接，但安全边界清晰且可审计。

# ADR-006：使用普通 Markdown 加 frontmatter 作为 V0.1 资产

- 状态：Accepted（图片本地化部分由 ADR-009 补充）
- 日期：2026-08-21

## 背景

剪藏结果必须能被 Tolaria 和其他工具直接读取，不能因为 Capture 引入私有数据库或不可迁移格式。文章来源、捕获时间和类型需要保留为明确元数据。

## 决策

V0.1 输出普通 `.md` 文件，顶部使用 YAML frontmatter，至少包含 `title`、`source_url`、`clipped` 和 `type`，可选包含 `site`、`author` 和 `published`，正文使用 Turndown + GFM。Folder 表示文件系统目录，`type` 表示知识类型，两者不混用。`v0.1.0-beta.1` 的公开 Article 图片本地化和 `Assets/<sha256>.<ext>` 规则见 ADR-009；下载失败时仍保留安全远程 URL。

## 后果

- 用户可以直接打开、移动和备份 Markdown 文件。
- Golden Test 可以对完整文本输出做确定性比较。
- Alpha.1 不下载图片；Beta.1 对公开 Article 图片执行 ADR-009 规定的受限本地化；两个版本都不生成 AI 摘要和标签。
- 未来增加资源本地化时必须保持已有 Markdown 的可读性和迁移路径。

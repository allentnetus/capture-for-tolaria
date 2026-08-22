# Capture for Tolaria V0.1 本期实施计划

> **给执行代理：** 必须按任务逐项执行本计划。每个步骤使用复选框跟踪；每个任务完成后都要先运行对应的验证命令，再进入下一任务。

**目标：** 交付可验收的 V0.1 Product Alpha，使 Windows Chrome 用户能够剪藏一篇公开文章，并在不要求安装 Node.js、不需要管理员权限、也不依赖 Tolaria MCP Bridge 运行的前提下，将经过安全清理的 Markdown 写入用户授权的 Tolaria Vault。

**架构：** 使用 Chrome Manifest V3 Extension 负责网页 DOM 采集，使用 Native Messaging Helper 负责经过校验的本地文件操作。V0.1 以 Direct File Channel 作为可靠主路径；MCP Channel、AI 增强、图片本地化、其他 Capture 模式和跨平台支持全部明确延后。Extension 与 Helper 共同使用版本化协议包，并在连接时协商 capabilities。

**技术栈：** pnpm workspace、TypeScript、Chrome MV3、Native Messaging、开发期 Node.js Helper、esbuild、Vitest、JSDOM、Mozilla Readability、DOMPurify、Turndown、`turndown-plugin-gfm`、Zod、PowerShell Windows 安装脚本和 GitHub Actions CI。

**方案依据：** `docs/final-solution.md`

## 全局约束

- V0.1 只支持 Windows + Chrome + Article Capture。
- V0.1 通过 Direct File Channel 写入；Tolaria 进程和 9710 Bridge 不可用时仍应尽量能够保存。
- V0.1 使用单 Vault、per-user 配置，配置文件位于 `%LOCALAPPDATA%\CaptureForTolaria\config.json`；首次配置只记录并验证 Vault 根目录，不预创建 `Inbox/Web`。
- 本项目及后续相关说明文档的正文统一使用中文；代码、命令、API、包名、协议字段和外部产品名保留其约定写法，除非用户明确要求其他语言。
- Extension 使用 `activeTab`、`scripting` 和 `nativeMessaging`；通过用户点击临时读取当前页面，不使用 V0.1 的宽泛 `host_permissions`。
- Helper 只能暴露 `clip.article` 等业务级动作，不得提供通用的 `writeFile(anyPath)` 接口。
- 所有请求都必须进行运行时校验，并携带 `protocolVersion`、`requestId` 和组件版本信息。
- HTML 必须经过 Readability、质量检查、Sanitization、DOM Cleanup 和 Turndown/GFM 后才能生成 Markdown。
- 文件写入必须 create-only、atomic、不可覆盖；`relativeFolder` 写入时逐级 `mkdir`，每一级创建或发现后立即检查真实路径和 reparse 状态；路径校验必须防护 `..`、symlink、junction 和 Windows reparse point 逃逸。
- V0.1 只保留远程图片 URL，不下载或本地化图片。
- 默认目录是 `Inbox/Web`；Folder 和 frontmatter 中的 `type` 是两个不同概念。
- 默认隐私策略是 local-first、无 telemetry、无浏览历史采集、无账号、无云服务、无服务器上传。
- V0.1 不实现 MCP 9710、AI、Selection、Bookmark、Screenshot、Edge、macOS、Linux、云同步和 Helper 自动更新。
- V0.1 不实现持久化 `Write Retry Store`；写入失败返回稳定错误，持久化重试任务放到 V0.2。
- V0.1 正式分发必须是单文件 Helper 可执行程序；目标用户不需要安装 Node.js。
- V0.1 Alpha 通过 Release ZIP + Chrome 开发者模式加载 Extension；Chrome Web Store 发布放到后续公开 Beta。
- 当前 V0.1 按独立实现推进，默认采用 Apache-2.0；写入 `LICENSE` 前必须完成源码来源审计。
- 安装器不得要求管理员权限，卸载不得删除用户 Vault、Markdown 或 Assets。
- 每个任务都要有独立的测试和可审查的提交；当前目录没有 Git 元数据时，先确认目录是否为用户指定的 Git 根目录，并在得到确认或完成初始化后再执行提交步骤。

---

## 一、本期实施顺序与阶段门禁

| 阶段 | 交付物 | 进入下一阶段前必须通过 |
| --- | --- | --- |
| P0 | 工作区脚手架和 V0.1 边界 | TypeScript 检查、基础测试 |
| P1 | 版本化协议和运行时校验 | 协议校验测试、类型检查 |
| P2 | 网页提取和 Markdown 管线 | Fixture、Golden Test、恶意 HTML 测试 |
| P3 | Helper File Channel | 路径沙箱、create-only、atomic write、重名测试 |
| P4 | Extension 到 Helper 的垂直链路 | Native Messaging 握手和真实文章剪藏 |
| P5 | Windows 安装器 | 安装、修复、升级、卸载测试 |
| P6 | CI、Release 和项目文档 | 完整 CI、构建产物检查 |
| P7 | Product Alpha 验收 | 干净 Windows 用户流程全部通过 |

本期只追求第一条可工作的垂直链路，不先实现 MCP、AI、图片下载或跨平台安装器。

## 二、计划中的目录结构

当前项目目录除方案文档外为空，因此以下路径按新建文件规划：

```text
capture-for-tolaria/
├─ apps/
│  ├─ extension/
│  │  ├─ public/
│  │  └─ src/
│  │     ├─ background/
│  │     ├─ content/
│  │     └─ popup/
│  └─ helper/
│     └─ src/
│        └─ vault-config.ts
├─ packages/
│  ├─ protocol/
│  ├─ extractor/
│  ├─ markdown/
│  └─ shared/
├─ installer/
│  └─ windows/
│     ├─ build-helper.ps1
│     ├─ configure-vault.ps1
│     ├─ helper-sea-config.json
│     └─ install-extension.md
├─ tests/
│  ├─ fixtures/
│  │  └─ expected/
│  ├─ integration/
│  └─ e2e/
├─ docs/
│  ├─ architecture.md
│  ├─ protocol.md
│  ├─ security.md
│  ├─ troubleshooting.md
│  └─ adr/
│     ├─ ADR-001-native-messaging.md
│     ├─ ADR-002-dual-channel.md
│     ├─ ADR-003-file-write-semantics.md
│     ├─ ADR-004-extension-helper-protocol.md
│     ├─ ADR-005-vault-path-security.md
│     ├─ ADR-006-markdown-output-format.md
│     ├─ ADR-007-privacy-network-policy.md
│     └─ ADR-008-tolaria-compatibility.md
├─ .github/workflows/
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ README.md
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ SECURITY.md
├─ PRIVACY.md
├─ INSTALL-WINDOWS.md
├─ LICENSE
└─ THIRD_PARTY_NOTICES.md
```

协议、提取、文件系统安全和 UI 必须保持边界清晰，不要把它们合并成一个大模块。

## 任务 1：初始化工作区并冻结 V0.1 边界

**文件：**

- 新建：`package.json`
- 新建：`pnpm-workspace.yaml`
- 新建：`tsconfig.base.json`
- 新建：`.gitignore`
- 新建：`packages/protocol/package.json`
- 新建：`packages/extractor/package.json`
- 新建：`packages/markdown/package.json`
- 新建：`packages/shared/package.json`
- 新建：`apps/extension/package.json`
- 新建：`apps/helper/package.json`
- 新建：`docs/architecture.md`
- 新建：`docs/protocol.md`
- 新建：`docs/security.md`
- 新建：`docs/troubleshooting.md`
- 新建：`docs/adr/ADR-001-native-messaging.md`
- 新建：`docs/adr/ADR-002-dual-channel.md`
- 新建：`docs/adr/ADR-003-file-write-semantics.md`
- 新建：`docs/adr/ADR-004-extension-helper-protocol.md`
- 新建：`docs/adr/ADR-005-vault-path-security.md`
- 新建：`docs/adr/ADR-006-markdown-output-format.md`
- 新建：`docs/adr/ADR-007-privacy-network-policy.md`
- 新建：`docs/adr/ADR-008-tolaria-compatibility.md`
- 新建：`LICENSE`（源码审计确认独立实现后使用 Apache-2.0）

**输入与产出：**

- 输入：`docs/final-solution.md`
- 产出：可以独立构建和测试各个 package 的 pnpm workspace

- [ ] **步骤 1：创建根工作区配置**

根目录使用私有 workspace 名称，统一提供以下脚本：

```json
{
  "name": "capture-for-tolaria-workspace",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "test:golden": "pnpm --filter @capture-for-tolaria/extractor test -- --run",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint",
    "check": "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build"
  }
}
```

首次安装依赖后提交 lockfile；不要添加没有对应实施任务的运行时依赖。

- [ ] **步骤 2：配置 workspace 和 TypeScript 基础配置**

`pnpm-workspace.yaml` 覆盖 `apps/*` 和 `packages/*`。`tsconfig.base.json` 开启 strict 检查，统一 ESM 模块解析、声明文件输出，以及 `src`/`dist` 目录约定。

- [ ] **步骤 3：创建各 package 骨架和失败即显的冒烟测试**

每个 package 都要有 `build`、`test`、`typecheck` 和 `lint` 脚本。每个 package 至少添加一个导入公开入口的冒烟测试；不能让空测试套件误报成功。

- [ ] **步骤 4：写入本期边界文档**

在 `docs/` 中明确以下决定：

```text
V0.1 = Windows + Chrome + Article + Direct File Channel
MCP 9710 = V0.2
V0.1 只保留远程图片 URL
禁止任意文件写入 API
```

`docs/protocol.md` 和 `docs/security.md` 必须使用后续任务定义的 action 名称和安全边界。

- [ ] **步骤 5：冻结首批 ADR 和许可证决策**

先创建 ADR-001 至 ADR-008。至少在开始编码前完成 ADR-001、ADR-002、ADR-003、ADR-004 和 ADR-005，分别冻结 Native Messaging、双通道、Windows atomic/create-only 写入、协议契约和 Vault 路径安全。

完成一次源码来源审计后，将独立实现的 V0.1 许可证写为 Apache-2.0；若审计发现直接复制 Tolaria AGPL 实现，则暂停写入许可证和 Release 配置，重新评估许可证义务。

- [ ] **步骤 6：确认 Git 根目录并运行初始化门禁**

先检查当前目录是否是用户指定的 Git 根目录。当前没有 `.git` 时，不要直接执行提交命令；由用户确认后初始化仓库，或在外部完成初始化后继续。

运行：

```powershell
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
```

预期：所有 package 都有真实测试结果，TypeScript 无错误，并为已有入口生成 `dist/` 输出。

- [ ] **步骤 7：提交脚手架**

```powershell
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore apps packages docs
git commit -m "chore: scaffold capture for Tolaria workspace"
```

## 任务 2：实现版本化协议和运行时校验

**文件：**

- 新建：`packages/protocol/src/types.ts`
- 新建：`packages/protocol/src/schema.ts`
- 新建：`packages/protocol/src/index.ts`
- 新建：`packages/protocol/test/schema.test.ts`
- 修改：`packages/protocol/package.json`
- 修改：`docs/protocol.md`

**接口：**

- 输入：任务 1 的 workspace 配置
- 产出：`validateRequest(value: unknown): ClipRequest`、`validateResponse(value: unknown): ClipResponse`、`createHelloResponse(version: string, capabilities: string[]): HelloResponse`

- [ ] **步骤 1：先写协议失败测试**

至少覆盖：

```ts
it("接受带版本的文章请求", () => {
  expect(validateRequest({
    protocolVersion: 1,
    requestId: "req-1",
    extensionVersion: "0.1.0",
    action: "clip.article",
    payload: {
      relativeFolder: "Inbox/Web",
      title: "Article",
      markdown: "# Article",
      sourceUrl: "https://example.com/article",
      metadata: {}
    }
  }).action).toBe("clip.article");
});

it("拒绝未知 action");
it("拒绝缺少 requestId 的请求");
it("拒绝不支持的协议版本");
it("拒绝试图离开相对目录的路径 payload");
it("拒绝缺少 sourceUrl 或 metadata 的文章 payload");
it("拒绝没有 payload 的 clip.article");
it("拒绝携带文章 payload 的 hello 请求");
it("校验成功响应时保留 requestId");
it("能够生成带 capabilities 的 hello 响应");
```

- [ ] **步骤 2：运行聚焦测试，确认测试确实失败**

```powershell
pnpm --filter @capture-for-tolaria/protocol test -- --run
```

预期：因为公开校验器和协议类型尚未实现，测试失败。

- [ ] **步骤 3：定义最小协议类型**

固定以下协议值和类型：

```ts
export const PROTOCOL_VERSION = 1 as const;

export type CaptureAction = "hello" | "clip.article";

export interface ArticlePayload {
  relativeFolder: string;
  title: string;
  markdown: string;
  sourceUrl: string;
  metadata: Record<string, string | undefined>;
}

export interface HelloRequest {
  protocolVersion: 1;
  requestId: string;
  extensionVersion: string;
  action: "hello";
}

export interface ArticleRequest {
  protocolVersion: 1;
  requestId: string;
  extensionVersion: string;
  action: "clip.article";
  payload: ArticlePayload;
}

export type ClipRequest = HelloRequest | ArticleRequest;

export interface ClipSuccessResponse {
  protocolVersion: 1;
  requestId: string;
  helperVersion: string;
  ok: true;
  result: { relativePath: string };
}

export interface ClipErrorResponse {
  protocolVersion: 1;
  requestId: string;
  helperVersion: string;
  ok: false;
  error: { code: string; message: string };
}

export type ClipResponse = ClipSuccessResponse | ClipErrorResponse;

export interface HelloResponse {
  protocolVersion: 1;
  helperVersion: string;
  capabilities: string[];
}
```

另外定义成功响应和错误响应。错误响应必须有 `requestId`、`code` 和安全的用户提示语，不得泄露本地密钥或任意文件内容。

- [ ] **步骤 4：实现 Zod schema 和公开校验器**

运行时校验所有字段：未知 action、不支持的协议版本、空标识、非 HTTP/HTTPS 的 `sourceUrl`、绝对路径、路径穿越和无界 Markdown payload 都必须拒绝。payload 大小限制放在一个导出常量中，让 Extension 和 Helper 使用同一限制。

- [ ] **步骤 5：运行协议测试并确认通过**

```powershell
pnpm --filter @capture-for-tolaria/protocol test -- --run
pnpm --filter @capture-for-tolaria/protocol typecheck
pnpm --filter @capture-for-tolaria/protocol build
```

预期：校验测试全部通过，并生成声明文件。

- [ ] **步骤 6：记录 wire contract**

在 `docs/protocol.md` 写明 request、success response、error response、hello response、版本协商、payload 大小限制，以及 Native Messaging 中 `stdout` 只能承载协议帧的规则。

- [ ] **步骤 7：提交协议契约**

```powershell
git add packages/protocol docs/protocol.md
git commit -m "feat: define versioned extension helper protocol"
```

## 任务 3：实现网页提取和 Markdown 管线

**文件：**

- 新建：`packages/extractor/src/types.ts`
- 新建：`packages/extractor/src/article.ts`
- 新建：`packages/extractor/src/sanitize.ts`
- 新建：`packages/extractor/src/quality.ts`
- 新建：`packages/extractor/src/index.ts`
- 新建：`packages/markdown/src/frontmatter.ts`
- 新建：`packages/markdown/src/convert.ts`
- 新建：`packages/markdown/src/index.ts`
- 新建：`tests/fixtures/simple-article.html`
- 新建：`tests/fixtures/chinese-article.html`
- 新建：`tests/fixtures/code-blocks.html`
- 新建：`tests/fixtures/table.html`
- 新建：`tests/fixtures/lazy-image.html`
- 新建：`tests/fixtures/relative-links.html`
- 新建：`tests/fixtures/malicious-html.html`
- 新建：`tests/fixtures/huge-page.html`
- 新建：`tests/fixtures/unicode-title.html`
- 新建：`tests/fixtures/paywall.html`
- 新建：`tests/fixtures/expected/*.md`
- 新建：`packages/extractor/test/article.test.ts`
- 新建：`packages/markdown/test/convert.test.ts`
- 新建：`packages/markdown/test/golden.test.ts`
- 修改：`packages/extractor/package.json`
- 修改：`packages/markdown/package.json`

**接口：**

- 输入：克隆后的浏览器 `Document` 和来源 URL
- 产出：`extractArticle(document: Document, sourceUrl: string): ExtractionResult`、`renderMarkdown(result: ExtractionResult, clippedAt: string): MarkdownDocument`

```ts
export interface ExtractionResult {
  title: string;
  html: string;
  textContent: string;
  author?: string;
  published?: string;
  sourceUrl: string;
  extractionMethod: "readability" | "semantic-fallback";
}

export interface MarkdownDocument {
  frontmatter: Record<string, string | undefined>;
  markdown: string;
  title: string;
  sourceUrl: string;
}
```

- [ ] **步骤 1：先写提取失败测试**

覆盖：

```ts
it("从简单 HTML 提取标题和正文");
it("保持中文和 Unicode 标点");
it("移除 script、iframe、事件属性和 javascript URL");
it("将相对图片 URL 解析为来源页面下的绝对 HTTP/HTTPS URL");
it("读取 src、data-src 和 srcset 中的可用图片 URL");
it("拒绝 file、javascript、vbscript 和危险 data URL");
it("保留代码块的 language class");
it("不会把 body.innerText 作为无条件 fallback");
it("Readability 质量失败后使用 article/main 语义候选");
it("所有策略失败时返回明确的提取失败");
```

- [ ] **步骤 2：运行提取测试，确认测试失败**

```powershell
pnpm --filter @capture-for-tolaria/extractor test -- --run
```

预期：提取管线尚未实现，测试失败。

- [ ] **步骤 3：实现 DOM 克隆、Readability 和质量检查**

先克隆当前 document，再对克隆内容执行 Readability。拒绝空结果、导航内容占比过高或低于最低质量标准的结果；不能静默转换整页 body。

- [ ] **步骤 4：实现 Sanitization 和 DOM Cleanup**

使用 DOMPurify 或等价方案清理 Readability 结果。移除可执行元素、事件属性、不安全 URL 协议、隐藏导航、Cookie Banner 和无关控件；保留标题、图表、代码、链接、图片、表格和文章元数据。

图片 URL 以来源页面 URL 解析相对路径，按 `src`、`data-src`、`srcset` 顺序选择可用值；只保留 HTTP/HTTPS，拒绝 `file:`、`javascript:`、`vbscript:` 和危险 `data:`。无法安全解析的图片保留原始文本或删除图片引用，不触发网络下载。

- [ ] **步骤 5：实现语义 fallback**

Readability 质量检查失败后，按以下顺序检查语义候选：

```text
article
main
[role="main"]
.post-content
.entry-content
.article-content
```

第一个通过相同质量检查的候选作为正文。全部失败时返回类型化错误，并使用：

```text
Unable to extract this page reliably.
```

- [ ] **步骤 6：运行提取测试并确认通过**

```powershell
pnpm --filter @capture-for-tolaria/extractor test -- --run
pnpm --filter @capture-for-tolaria/extractor typecheck
```

预期：所有提取和恶意输入测试通过。

- [ ] **步骤 7：先写 Markdown 转换测试**

覆盖 Heading、GFM Table、Task List、Strikethrough、带语言的 Fenced Code、Blockquote、Figure、Details/Summary、Link、Image、Relative URL 和 Lazy Image。每个 Fixture 都要在 `tests/fixtures/expected/` 下有对应的期望 Markdown，使用 Golden Test 比较完整输出。

- [ ] **步骤 8：实现 Frontmatter 和 Turndown/GFM 转换**

V0.1 输出格式：

```markdown
---
type: Resource
title: "Article title"
source_url: "https://example.com/article"
site: "Example"
author: "Author"
published: "2026-08-21"
clipped: "2026-08-21T17:05:00+08:00"
---

# Article title

> Source: https://example.com/article

## Content

Article content…

## Source

https://example.com/article
```

`Folder` 不进入 frontmatter 契约，它是 Helper 使用的文件系统目标。

- [ ] **步骤 9：运行 Markdown 和 Golden Test**

```powershell
pnpm --filter @capture-for-tolaria/markdown test -- --run
pnpm run test:golden
pnpm --filter @capture-for-tolaria/markdown typecheck
```

预期：所有 Golden 输出稳定，代码语言标记保留，恶意 HTML 不会进入 Markdown。

- [ ] **步骤 10：提交提取管线**

```powershell
git add packages/extractor packages/markdown tests/fixtures
git commit -m "feat: add sanitized article to Markdown pipeline"
```

## 任务 4：实现 Helper File Channel 和文件系统边界

**文件：**

- 新建：`apps/helper/src/main.ts`
- 新建：`apps/helper/src/native-messaging.ts`
- 新建：`apps/helper/src/request-handler.ts`
- 新建：`apps/helper/src/vault-resolver.ts`
- 新建：`apps/helper/src/vault-config.ts`
- 新建：`apps/helper/src/path-sandbox.ts`
- 新建：`apps/helper/src/filename.ts`
- 新建：`apps/helper/src/atomic-create-writer.ts`
- 新建：`apps/helper/src/errors.ts`
- 新建：`apps/helper/test/path-sandbox.test.ts`
- 新建：`apps/helper/test/vault-config.test.ts`
- 新建：`apps/helper/test/filename.test.ts`
- 新建：`apps/helper/test/atomic-create-writer.test.ts`
- 新建：`apps/helper/test/request-handler.test.ts`
- 修改：`apps/helper/package.json`
- 修改：`packages/protocol/src/types.ts`（仅当需要共享 Helper 结果/错误类型）
- 修改：`docs/security.md`

**接口：**

- 输入：`@capture-for-tolaria/protocol` 的 `ClipRequest`
- 产出：`handleRequest(request: ClipRequest): Promise<ClipResponse>`、`writeMarkdownCreateOnly(input: WriteInput): Promise<WriteResult>`

```ts
export interface WriteInput {
  vaultRoot: string;
  relativeFolder: string;
  title: string;
  markdown: string;
}

export interface WriteResult {
  relativePath: string;
  created: true;
}

export interface VaultConfig {
  vaultRoot: string;
}

export function getConfiguredVault(): Promise<string | null>;
export function setConfiguredVault(path: string): Promise<void>;
export function validateConfiguredVault(path: string): Promise<"ready" | "missing" | "inaccessible">;
```

- [ ] **步骤 1：先写文件名测试**

覆盖 Windows 非法字符、保留名称、Unicode、尾部空格、尾部句点、空标题和过长标题。清理后的标题应保持可识别，并始终以 `.md` 结尾。

- [ ] **步骤 2：实现确定性的文件名规范化**

使用 `YYYYMMDD - Title.md`。日期生成和标题清理分离，以便测试时注入固定时间。绝不能把用户传入的绝对路径当成文件名或目录。

- [ ] **步骤 3：先写路径沙箱测试**

覆盖：

```text
Inbox/Web/article.md                 → 接受
Inbox 不存在                       → 写入时逐级创建并接受
Web 不存在                         → 写入时创建并接受
Inbox 是文件                       → 拒绝
../outside/article.md                → 拒绝
C:\Users\other\article.md          → 拒绝
Vault/Inbox/Web/link-to-outside.md   → 拒绝
Vault/Inbox/Web/junction-target.md   → 拒绝
```

Windows 测试在条件允许时创建临时 symlink 或 junction，解析真实目标，并断言 Helper 在写入前拒绝它。

- [ ] **步骤 4：实现逐级目录创建和 canonical path 校验**

写入前执行：

```text
规范化 Vault 根路径
    ↓
按 `relativeFolder` 拆分路径段
    ↓
从 Vault 根目录开始逐级处理
    ↓
当前段不存在 → 使用非递归 `mkdir` 创建当前一级
    ↓
对当前段执行 `lstat` / `realpath`
    ↓
检查 symlink / junction / reparse 状态
    ↓
确认真实路径仍位于 Vault 根目录内
    ↓
所有目录准备完成后进入 Writer
```

必须使用路径段边界判断，不能只使用字符串前缀。每一级目录创建或发现后立即检查；如果当前段是文件、链接、junction、reparse point、无法访问，或者真实路径逃出 Vault，一律拒绝。

- [ ] **步骤 5：先写 create-only 和 atomic write 测试**

覆盖：

```ts
it("不会覆盖已有 Markdown 文件");
it("create-only 冲突后生成后缀文件");
it("成功写入后用户只会看到完整内容");
it("失败写入后清理临时文件");
it("并发创建不会选择同一个最终路径");
it("临时目录创建后逐级检查真实路径");
it("目录创建失败时不会继续写入最终文件");
```

- [ ] **步骤 6：冻结并实现 `AtomicCreateWriter`**

先在 `docs/adr/ADR-003-file-write-semantics.md` 中通过 Windows proof test 冻结具体原语：V0.1 使用同一卷内临时文件配合 Node `fs.link` create-only hard-link 提交（Windows 对应 `CreateHardLinkW`），目标已存在时必须返回冲突并保留原文件。ADR 同时冻结跨卷、目标冲突、提交失败和临时文件清理语义。不能假定普通 `rename` 自动满足不覆盖；如果 proof test 证明当前文件系统不能同时满足 atomic 和 create-only，V0.1 必须安全失败并阻断 Release。

```text
准备完整内容
    ↓
在目标目录内创建临时文件
    ↓
写入并 flush 完整内容
    ↓
关闭临时文件
    ↓
使用 `fs.link`（Windows `CreateHardLinkW`）以 create-only 方式提交完整临时文件，然后删除临时链接
```

最终路径已经存在时，保留原文件并尝试下一个后缀。任何情况下都不得替换最终文件；如果当前文件系统无法同时满足 atomic 和 create-only，安全失败并清理临时文件。

- [ ] **步骤 7：先写 request-handler 测试**

验证 Handler：

- 接受经过校验的 `clip.article`
- 从 `%LOCALAPPDATA%\CaptureForTolaria\config.json` 读取并校验授权 Vault
- 未配置 Vault 时返回稳定的 `VAULT_NOT_CONFIGURED` 错误
- 解析授权 Vault 和默认 `Inbox/Web`
- 在 Writer 前调用 path sandbox
- 返回创建后的相对路径
- 将非法输入、Vault 错误、路径逃逸、重名耗尽和写入错误映射为稳定错误码
- 成功响应不暴露任意绝对文件路径

- [ ] **步骤 8：实现 Helper request handler**

V0.1 action 只保留 `hello` 和 `clip.article`。Helper 从 per-user 配置读取 Vault，按逐级目录策略准备 `relativeFolder`，再根据规范化目录和规范化标题计算最终路径；Extension 不得传入最终绝对输出路径。

- [ ] **步骤 9：在 Windows 上运行 Helper 测试**

```powershell
pnpm --filter @capture-for-tolaria/helper test -- --run
pnpm --filter @capture-for-tolaria/helper typecheck
```

预期：路径逃逸、reparse point 逃逸、覆盖、并发和清理测试在 Windows runner 上通过。

- [ ] **步骤 10：提交 File Channel**

```powershell
git add apps/helper packages/protocol docs/security.md
git commit -m "feat: add secure atomic File Channel writer"
```

## 任务 5：通过 Native Messaging 连接 Extension 与 Helper

**文件：**

- 新建：`apps/extension/manifest.json`
- 新建：`apps/extension/src/background/native-messaging.ts`
- 新建：`apps/extension/src/background/messages.ts`
- 新建：`apps/extension/src/content/capture-article.ts`
- 新建：`apps/extension/src/popup/App.ts`
- 新建：`apps/extension/src/popup/main.ts`
- 新建：`apps/extension/test/background-messages.test.ts`
- 新建：`apps/extension/test/manifest.test.ts`
- 新建：`apps/extension/test/native-messaging.test.ts`
- 修改：`apps/helper/src/native-messaging.ts`
- 修改：`apps/helper/src/main.ts`
- 修改：`docs/protocol.md`

**接口：**

- 输入：`extractArticle`、`renderMarkdown` 和协议校验器
- 产出：一次由用户触发的 Article Capture，从当前 Chrome Tab 到 Helper 返回成功路径

- [ ] **步骤 1：先写 Native Messaging framing 测试**

覆盖 4-byte little-endian 长度、UTF-8 JSON、分段读取、多消息、非法长度、非法 JSON 和 stdout 污染。framing parser 不能把日志内容当成协议消息。

- [ ] **步骤 2：实现 Native Messaging transport**

采用短事务流程：

```text
connectNative
    ↓
发送 hello
    ↓
校验 Helper 协议版本和 capabilities
    ↓
发送 clip.article
    ↓
校验响应和 requestId
    ↓
disconnect
```

日志全部进入 `stderr`；`stdout` 只允许输出带长度前缀的协议帧。

- [ ] **步骤 3：先写 Extension message 测试**

验证 Service Worker：

- 只接受来自 Extension UI/菜单的 Capture 请求
- 校验当前 Tab URL 和 Content Script 返回值
- 不信任任意 Content Script payload
- 拒绝超大 Markdown
- 在 Helper 往返过程中保持 `requestId`
- 将稳定错误状态展示给 Popup

- [ ] **步骤 4：实现 Content Script Article Capture**

克隆当前页面 DOM，运行提取管线，生成 Markdown 文档，再把类型化结果返回给 Service Worker。不得发送 cookies、history、页面凭据或无关 DOM storage。

- [ ] **步骤 5：实现最小 Popup**

V0.1 Popup 只提供：

```text
页面标题预览
默认目录：Inbox/Web
Capture 模式：Article
Save to Tolaria 按钮
成功路径或安全错误信息
```

在对应能力完成前，不展示 Selection、Bookmark、Screenshot、AI、图片下载或 Vault Context 控件。

- [ ] **步骤 6：添加 MV3 manifest**

manifest 必须只申请以下 V0.1 权限：

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "nativeMessaging"
  ]
}
```

Article Capture 只能由用户点击 Popup/菜单触发：Service Worker 使用 `activeTab` 获得当前 Tab 的临时访问，再用 `scripting` 动态注入或执行 Content Script。不得添加宽泛的 `host_permissions`，也不得申请 `cookies`、`history` 或其他与剪藏无关的权限。配置 Service Worker、Popup、图标和稳定的 Extension ID 策略，供 Native Host `allowed_origins` 使用。

固定 ID 采用提交到仓库的公开 Extension public key/manifest `key`；对应私钥只存放在受保护的发布环境，禁止提交到仓库或打入 Release ZIP。增加 CI 检查，验证构建后的 Extension ID 与 Native Host `allowed_origins` 中的 `chrome-extension://<id>/` 完全一致；未固定或不一致时阻断构建。

`manifest.test.ts` 必须逐项断言权限集合只包含上述三项、没有 `host_permissions`/`cookies`/`history`，存在稳定的公开 `key`，并且构建检查能从该 manifest 计算出与 Host Manifest 相同的 Extension ID。

- [ ] **步骤 7：添加 mock-host 集成测试**

启动固定协议版本的测试 Helper，验证完整链路：

```text
当前文章
    ↓
Content Script 提取
    ↓
Service Worker 校验
    ↓
Native Messaging framing
    ↓
Helper 校验
    ↓
File Channel 结果
```

预期：返回的相对路径对应临时 Vault 中创建的文件；同名时已有文件内容不变。

- [ ] **步骤 8：运行 Extension 和集成测试**

```powershell
pnpm --filter @capture-for-tolaria/extension test -- --run
pnpm --filter @capture-for-tolaria/extension typecheck
pnpm run build
```

预期：Extension 构建包含有效的 MV3 manifest，mock-host 集成测试通过。

- [ ] **步骤 9：提交第一条垂直链路**

```powershell
git add apps/extension apps/helper packages docs/protocol.md
git commit -m "feat: capture Chrome articles into Tolaria Vault"
```

## 任务 6：添加 Windows Native Host 安装器

**文件：**

- 新建：`installer/windows/build-helper.ps1`
- 新建：`installer/windows/configure-vault.ps1`
- 新建：`installer/windows/install-extension.md`
- 新建：`installer/windows/helper-sea-config.json`
- 新建：`installer/windows/install.ps1`
- 新建：`installer/windows/repair.ps1`
- 新建：`installer/windows/uninstall.ps1`
- 新建：`installer/windows/native-host-manifest.json.in`
- 新建：`installer/windows/tests/install.Tests.ps1`
- 新建：`installer/windows/tests/uninstall.Tests.ps1`
- 新建：`installer/windows/tests/no-node-runtime.Tests.ps1`
- 修改：`apps/extension/manifest.json` 中的 Release Extension ID
- 修改：`docs/troubleshooting.md`

**输入与产出：**

- 输入：固定 Extension ID、Helper 单文件构建配置和用户选择的 Vault 根目录
- 产出：无 Node.js 运行时依赖的 Helper、`HKCU` 下的 per-user Native Messaging 注册、Vault 配置和幂等的安装/修复/卸载流程

- [ ] **步骤 1：先写安装器验收测试**

测试必须断言：

```text
干净用户配置安装       → Helper 和 Host Manifest 存在
没有 Node.js 的环境     → Helper 能启动并完成 hello
配置 Vault             → config.json 写入并通过 canonical path 校验
重复安装               → 没有重复或损坏注册
删除 manifest 后修复    → 注册恢复
升级                   → 只替换应用文件
卸载                   → Helper、manifest、注册表清理
卸载                   → Vault、Markdown、Assets 保留
```

- [ ] **步骤 2：构建单文件 Helper**

使用 `installer/windows/helper-sea-config.json` 固定 Node SEA（或经验证的等价单文件方案）入口和产物名：

```powershell
powershell -NoProfile -File installer/windows/build-helper.ps1
```

预期产物为 `capture-for-tolaria-helper-0.1.0-windows-x64.exe`。在没有 Node.js 的干净 Windows 环境中直接启动该文件，运行 `no-node-runtime.Tests.ps1`，验证 Helper 能完成 `hello`，且不从用户环境寻找 Node.js。

- [ ] **步骤 3：实现 per-user 路径、Vault 配置和注册**

安装到：

```text
%LOCALAPPDATA%\Programs\CaptureForTolaria\
```

Native Host 注册到当前用户。V0.1 不写入 `Program Files`，不要求 UAC，也不做系统级 Host 注册。Vault 配置写入 `%LOCALAPPDATA%\CaptureForTolaria\config.json`；`configure-vault.ps1` 只记录并验证用户选择的根目录，不创建 `Inbox` 或 `Web`。

- [ ] **步骤 4：实现幂等 Install、Repair 和 Uninstall**

脚本重复执行也必须安全。卸载只能删除属于 Capture for Tolaria 的应用设置，不得删除配置中的 Vault、Markdown 或 Asset 文件；默认保留 Vault 配置，只有用户明确选择清除配置时才删除 `config.json`。

- [ ] **步骤 5：编写 Extension 安装说明并验证固定 ID**

V0.1 Alpha 使用 Release ZIP 和 Chrome 开发者模式安装：打开 `chrome://extensions`，启用“开发者模式”，选择“加载已解压的扩展程序”，指向 ZIP 解压后的 Extension 目录。说明文档必须写明 Extension ID、Native Host `allowed_origins` 的对应关系，以及升级时如何重新加载或替换 Extension。不得把 Release 私钥提交到仓库。

- [ ] **步骤 6：在干净 Windows 用户配置中运行安装测试**

使用构建产物执行：

```text
Install → 剪藏一篇文章 → Repair → 再次剪藏 → Upgrade → 再次剪藏 → Uninstall
```

预期：三次剪藏都成功，Vault 中的用户文件完整，卸载后没有应用注册信息残留；验证没有 Node.js 仍可启动 Helper，首次写入时才逐级创建并校验 `Inbox/Web`。

- [ ] **步骤 7：提交安装器**

```powershell
git add installer/windows apps/extension/manifest.json docs/troubleshooting.md
git commit -m "feat: add per-user Windows native host installer"
```

## 任务 7：添加 CI、Release、隐私和产品文档

**文件：**

- 新建：`.github/workflows/ci.yml`
- 新建：`.github/workflows/release.yml`
- 新建：`README.md`
- 新建：`CHANGELOG.md`
- 新建：`CONTRIBUTING.md`
- 新建：`SECURITY.md`
- 新建：`PRIVACY.md`
- 新建：`LICENSE`
- 新建：`THIRD_PARTY_NOTICES.md`
- 新建：`INSTALL-WINDOWS.md`
- 修改：`docs/architecture.md`
- 修改：`docs/protocol.md`
- 修改：`docs/security.md`
- 修改：`docs/troubleshooting.md`

**输入与产出：**

- 输入：任务 1–6 的构建、测试、安装器和兼容性结果
- 产出：新贡献者能够构建、测试、安装、排障和审计的仓库

- [ ] **步骤 1：编写 CI 检查**

Pull Request workflow 必须执行：

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:golden
pnpm run build
```

文件系统安全测试和安装器测试在 Windows 上运行。CI 还必须检查 MV3 manifest 只包含 `activeTab`、`scripting`、`nativeMessaging`，不包含宽泛 `host_permissions`、`cookies` 或 `history`，并校验构建产物的 Extension ID 与 Native Host `allowed_origins` 一致。只有 V0.1 Windows 门禁稳定后，才运行额外平台的 package-only 测试；不能借此扩大本期产品范围。

- [ ] **步骤 2：添加 Release 产物检查**

Release workflow 构建：

```text
Extension zip
Helper executable
Windows installer
INSTALL-WINDOWS.md
SHA256SUMS.txt
SBOM.spdx.json
```

发布前校验 Extension manifest、Native Host manifest、协议版本和 Helper 版本一致；Helper 必须是单文件、可在没有 Node.js 的环境运行；Release ZIP 不得包含 Extension 私钥、CI secret 或用户 Vault 数据。

- [ ] **步骤 3：编写产品 README**

`README.md` 的前三屏必须回答：

1. Capture for Tolaria 是什么？
2. 它能做什么？
3. 怎么安装？

之后再写支持平台、本地数据流、权限、隐私、排障、兼容性矩阵、路线图、贡献方式、安全报告、许可证和商标声明。深层架构放到 `docs/architecture.md`，不要把 README 变成几千行设计文档。

- [ ] **步骤 4：添加隐私、安全、依赖和许可证声明**

`PRIVACY.md` 写明 V0.1 local-first 行为；`SECURITY.md` 说明信任边界和漏洞报告方式；`THIRD_PARTY_NOTICES.md` 列出 Readability、Turndown、GFM、DOMPurify、Zod 以及实际打包依赖的许可证和 NOTICE 要求。完成源码来源审计后才能写入 `LICENSE`；确认是独立实现时使用 Apache-2.0，若发现直接复制 Tolaria AGPL 实现则暂停 Release 配置并重新评估许可证义务。`docs/adr/ADR-001` 至 `ADR-008` 必须随文档发布，并在 Release 中包含其变更记录。

- [ ] **步骤 5：添加发布和升级说明**

写明 SemVer、Extension/Helper 兼容性检查、手动更新路径、`INSTALL-WINDOWS.md` 中的 Release ZIP + Chrome 开发者模式安装流程、Alpha 未签名限制、代码签名里程碑，以及 V0.x 不自动下载并执行新 Helper 的规则。

- [ ] **步骤 6：运行完整仓库门禁**

```powershell
pnpm install --frozen-lockfile
pnpm run check
```

另外在 Windows 上运行单文件构建、无 Node.js 运行测试和安装器 Install/Repair/Upgrade/Uninstall 测试。预期：lint、typecheck、单元测试、Golden Test 和构建全部通过；Release 包含规定文件，并且不包含 secret 或用户 Vault 数据。

- [ ] **步骤 7：提交发布基础设施**

```powershell
git add .github README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md PRIVACY.md LICENSE THIRD_PARTY_NOTICES.md docs
git commit -m "chore: add CI release and product documentation"
```

## 任务 8：执行 Product Alpha 验收周期

**文件：**

- 新建：`tests/e2e/product-alpha-checklist.md`
- 新建：`docs/compatibility.md`
- 修改：`README.md`，写入实际测试过的 Alpha 版本和环境
- 修改：`CHANGELOG.md`，加入 V0.1 Alpha 条目

**输入与产出：**

- 输入：任务 1–7 的完整 Release Candidate
- 产出：陌生 Windows 用户能够安装、剪藏、验证、修复、升级和卸载，且 Vault 数据不丢失的证据

- [ ] **步骤 1：准备干净 Windows 测试用户**

使用没有 Node.js、没有现成 Helper 注册的用户配置，以及包含一篇既有 Markdown、但初始不存在 `Inbox/Web` 的临时 Tolaria Vault。通过 `configure-vault.ps1` 配置并验证该 Vault 根目录；既有文件内容必须保持不变，首次配置不得因为配置动作预创建 `Inbox/Web`。

- [ ] **步骤 2：执行首次用户流程**

```text
下载 Release 产物
    ↓
不使用管理员权限安装
    ↓
解压 Extension ZIP，进入 chrome://extensions 并启用开发者模式
    ↓
加载已解压的 Extension，验证 Extension ID 与 allowed_origins 一致
    ↓
打开公开文章
    ↓
点击 Capture
    ↓
验证写入时按 Inbox → Web 逐级创建并检查真实路径/reparse 状态
    ↓
验证 Markdown 和 frontmatter
    ↓
验证没有远程 HTML 脚本残留
    ↓
使用同名标题再次剪藏
    ↓
验证 create-only 后缀行为
    ↓
验证 Tolaria 感知新文件
```

- [ ] **步骤 3：执行 Repair、Upgrade 和 Uninstall 检查**

在 Repair 前、Repair 后和 Upgrade 后各剪藏一次。卸载后确认：

- Native Host 注册信息已移除
- Helper 和应用文件已移除
- Extension 移除说明清晰
- Vault、已有 Markdown、新建 Markdown 和 Assets 全部保留

- [ ] **步骤 4：记录兼容性证据**

在 `docs/compatibility.md` 写入 Windows 版本、Chrome 版本、Tolaria 版本/构建号、Extension 版本、Helper 版本、协议版本、File Channel 结果和已知限制。没有验证过的内容不得写成笼统的“Works with Tolaria”。

- [ ] **步骤 5：运行最终 Release 门禁**

本地和 CI 都运行：

```powershell
pnpm run check
```

Product Alpha checklist 中的必选项全部勾选后，才允许进入发布判断。若必选项失败，先修复最小责任层，再重新执行清单。

- [ ] **步骤 6：提交 Alpha 验收证据**

```powershell
git add tests/e2e/product-alpha-checklist.md docs/compatibility.md README.md CHANGELOG.md
git commit -m "test: complete V0.1 product alpha acceptance"
```

## 三、本期明确延后

以下功能必须另开后续实施计划，不作为本期顺手扩展：

1. `V0.1.5`：Selection、Bookmark、Screenshot、右键命令和 Deep Link。
2. `V0.2`：MCP 9710、`list_vaults`、`vault_context`、多 Vault、`open_note` 和 `Write Retry Store`；V0.1 只返回稳定写入错误，不持久化重试任务。
3. `V0.2.5`：图片本地化、Asset Manager、Templates 和 Shortcuts。
4. `V0.3`：Edge、macOS、Linux 和完整跨平台安装器。
5. `V0.4`：Summary、Key Points、标签/类型建议、Related Notes、重复检测和知识链接。
6. `V1.0`：稳定跨平台版本、签名二进制、完整兼容策略和成熟升级流程。

## 四、计划自审

### 需求覆盖

| 方案要求 | 对应任务 |
| --- | --- |
| V0.1 范围和非目标 | 全局约束、任务 1、任务 8 |
| 单 Vault 配置和首次配置边界 | 任务 4、任务 6、任务 8 |
| Extension + Helper + 双通道 | 任务 2、任务 4、任务 5 |
| MV3 最小权限和固定 Extension ID | 任务 5、任务 6、任务 7 |
| 单文件 Helper 和无 Node.js 运行 | 任务 6、任务 7、任务 8 |
| Readability、Sanitization、fallback | 任务 3 |
| 相对图片 URL 解析和危险协议拒绝 | 任务 3 |
| Markdown 和 Frontmatter | 任务 3 |
| Atomic create-only write | 任务 4 |
| 路径、symlink、junction、reparse 安全 | 任务 4 |
| 写入时逐级 mkdir 与即时真实路径校验 | 任务 4、任务 8 |
| Native Messaging framing 和协议 | 任务 2、任务 5 |
| MCP 边界和延期 | 全局约束、本期明确延后 |
| 隐私和权限最小化 | 任务 1、任务 7 |
| Monorepo 和 package 边界 | 任务 1 |
| Fixture 和 Golden Test | 任务 3 |
| CI、Release、安装、升级、卸载 | 任务 6、任务 7 |
| Release ZIP 和 Chrome 开发者模式安装 | 任务 6、任务 7、任务 8 |
| 许可证、商标、社区治理 | 任务 7 |
| Product Alpha 验收 | 任务 8 |
| ADR 冻结和源码来源审计 | 任务 1、任务 7 |
| Write Retry Store 延后 | 全局约束、本期明确延后 |

### 接口一致性

- `validateRequest`、`validateResponse` 和 `createHelloResponse` 由 `@capture-for-tolaria/protocol` 产出，由 Extension 和 Helper 共同使用。
- `extractArticle` 和 `renderMarkdown` 由 extractor/Markdown package 产出，由 Extension Capture 路径使用。
- `handleRequest` 和 `writeMarkdownCreateOnly` 由 Helper 产出，并使用共享协议类型。
- V0.1 唯一写入用户内容的 action 是 `clip.article`，其他 action 都延后。

### 空泛步骤检查

本计划为每个 V0.1 任务列出了具体文件、接口、测试用例、命令、预期结果、Release 产物和验收证据；没有依赖泛化的验证、未指定的测试或未解决的未来步骤。

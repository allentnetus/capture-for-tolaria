# Capture for Tolaria Alpha Release 实施计划

> **供代理执行：** 按任务逐项执行，并在每项任务后设置明确的验证检查点。开发目录和 GitHub 发布目录是两个独立工作区；不得从开发目录执行 push、tag 或创建 Release。

**目标：** 将 Capture for Tolaria v0.1.0-alpha.1 准备并发布为 Private GitHub 源码仓库，同时生成可复现的 Windows/Chrome Alpha Release，并完成发布资产验证。

**架构：** G:\Capture for Tolaria 继续作为开发和验证源码基准。开发门禁通过后，将经过审计的源码单向复制到 G:\发布\Capture for Tolaria-GitHub；该目录拥有独立的 Git 历史、GitHub remote、main 分支、tags 和 Releases。CI 只从发布副本构建并验证最终资产。

**技术栈：** Windows PowerShell、Node.js 24、pnpm 11.19.0、TypeScript、Vitest、Pester、Chrome MV3 Extension、Native Messaging、Windows SEA Helper、GitHub Actions。

**依据：** 当前会话中用户已确认的 Alpha Release 计划；项目目录边界规则见 AGENTS.md。

## 全局约束

- 开发目录：G:\Capture for Tolaria。
- 发布目录：G:\发布\Capture for Tolaria-GitHub。
- 同步方向为单向：开发目录 → 发布目录；不得进行未经审核的双向镜像。
- GitHub 的 commit、push、tag 和 Release 操作只能从发布目录执行。
- 排除 .pnpm-store/、node_modules/、dist/、release/、Vault 数据、.env、私钥、证书、Native Host 用户路径、日志和测试临时目录。
- 发布身份：Git tag 和 GitHub Release 均为 v0.1.0-alpha.1。
- Chrome Manifest 使用数字版本 version: "0.1.0" 和人类可读版本 version_name: "0.1.0 Alpha 1"。
- 源码仓库和 GitHub Release 在此 Alpha 阶段保持 Private 和 Pre-release。
- Alpha 范围为 Windows + Chrome + MV3 Article Capture + Direct File Channel；MCP、AI、图片本地化、Selection、Bookmark、Screenshot、Edge、macOS、Linux、云同步和账户功能暂不在范围内。
- 每项任务完成后，必须让开发目录或发布目录处于可测试状态，才能开始下一项任务。

---

### 任务 1：冻结 Alpha 版本契约

**文件：**

- 创建：VERSION
- 修改：package.json
- 修改：apps/extension/manifest.json
- 修改：apps/extension/package.json
- 修改：apps/helper/package.json
- 修改：packages/*/package.json
- 修改：版本常量、protocol fixtures、发布脚本，以及版本扫描识别出的当前发布文档
- 测试：apps/extension/test/manifest.test.ts、protocol/helper tests；必要时新增 release-version consistency test

**接口：**

- 生成发布身份 0.1.0-alpha.1 和 tag v0.1.0-alpha.1。
- 生成符合 Chrome 要求的 Manifest 值：数字 version: "0.1.0" 和 version_name: "0.1.0 Alpha 1"。

- [ ] 添加内容严格为 0.1.0-alpha.1 的规范 VERSION 文件。
- [ ] 更新 package 和 protocol/helper 版本值；明确标记为历史内容的示例不重写。
- [ ] 添加或更新 Extension 的 version_name，并保持 manifest.version 为数字版本。
- [ ] 更新测试和当前文档，使其断言新的发布契约。
- [ ] 执行仓库版本扫描，并在继续前审阅其余所有 0.1.0 引用。

验证：

~~~powershell
pnpm.cmd --filter @capture-for-tolaria/extension test
pnpm.cmd --filter @capture-for-tolaria/protocol test
rg -n -i '0\.1\.0|0\.1\.0-alpha\.1|v0\.1\.0' --glob '!node_modules/**' --glob '!.pnpm-store/**' --glob '!dist/**' --glob '!release/**' .
~~~

预期结果：所有受影响测试通过；剩余的普通 0.1.0 值只能是数字形式的 Chrome Manifest 版本，或明确标记的历史示例。

### 任务 2：强化源码卫生和仓库规则

**文件：**

- 修改：.gitignore
- 仅当实现暴露出边界缺失时修改：AGENTS.md
- 仅当现有检查无法表达发布排除项时，创建或修改源码卫生验证脚本/测试

- [ ] 将 .pnpm-store/ 添加到 .gitignore。
- [ ] 扫描开发目录中的 Vault 数据、.env、私钥、证书、用户专属 Native Host 路径、日志和临时测试输出。
- [ ] 确认 AGENTS.md 仍是开发/发布目录边界的权威规则文件。
- [ ] 不要自动删除可疑文件；任何需要用户审阅的候选项都应停止并报告。

验证：

~~~powershell
git check-ignore -v .pnpm-store node_modules dist release
rg -n -i --hidden 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\s*=' --glob '!.git/**' --glob '!node_modules/**' --glob '!.pnpm-store/**' .
~~~

预期结果：生成目录和敏感路径均已忽略或不存在；任何有意保留的示例值都必须在发布前完成审阅和说明。

### 任务 3：使发布打包可复现

**文件：**

- 修改：installer/windows/build-helper.ps1
- 修改：installer/windows/assemble-release.ps1
- 修改：installer/windows/generate-checksums.ps1
- 修改：installer/windows/generate-sbom.ps1
- 修改：.github/workflows/release.yml
- 测试：installer/windows/tests/ 和发布内容验证检查

- [ ] 从规范版本来源读取发布版本，不再在 Helper 和归档文件名中硬编码 0.1.0。
- [ ] 未提供 CI tag 时，将默认发布 tag 设置为 v0.1.0-alpha.1。
- [ ] 验证最终 Extension ZIP 内的 Manifest，而不是验证 release\extension\manifest.json。
- [ ] 保留固定 Extension ID 和精确权限契约检查。
- [ ] 让 workflow 上传文件名从与构建输出相同的发布版本推导。
- [ ] 确保临时解压目录和 staging 目录始终在 finally 块中清理。

验证：

~~~powershell
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
Expand-Archive -LiteralPath .\release\capture-for-tolaria-extension-v0.1.0-alpha.1.zip -DestinationPath .\release\extension-check -Force
Get-Content .\release\extension-check\manifest.json -Raw | ConvertFrom-Json
~~~

预期结果：最终资产文件名统一包含 v0.1.0-alpha.1 或 0.1.0-alpha.1；归档包含有效 Manifest，且不存在 staging 目录残留。

### 任务 4：使 Installer ZIP 自包含

**文件：**

- 修改：installer/windows/assemble-release.ps1
- 修改：installer/windows/install.ps1
- 修改：installer/windows/repair.ps1
- 修改：installer/windows/tests/install.Tests.ps1
- 修改：installer/windows/tests/default-parameters.Tests.ps1
- 修改：installer/windows/tests/configure-vault-helper.Tests.ps1
- 修改：installer/windows/tests/no-node-runtime.Tests.ps1
- 修改：INSTALL-WINDOWS.md、installer/windows/install-extension.md 和 README.md

- [ ] 在 Installer ZIP 根目录包含带版本号的 Helper EXE，同时继续将其作为独立 GitHub Release 资产发布。
- [ ] install.ps1 从打包后的 Installer ZIP 运行时，默认能够找到同级 Helper。
- [ ] 为高级/手动安装保留显式 -HelperPath 支持。
- [ ] 让 repair.ps1 使用相同的 Helper 解析契约。
- [ ] 更新错误信息和文档，说明精确的回退路径及 -HelperPath 行为。
- [ ] 添加一个不传 -HelperPath、直接运行打包默认路径的 Pester 测试。

验证：

~~~powershell
Invoke-Pester -Path installer/windows/tests
~~~

预期结果：install、repair、upgrade、uninstall、no-Node 和 default-parameter tests 全部通过；下载 Installer ZIP 的用户不需要仓库本地的 release 目录。

### 任务 5：对齐当前文档和 Alpha 发布说明

**文件：**

- 修改：README.md
- 修改：CHANGELOG.md
- 修改：SECURITY.md
- 修改：INSTALL-WINDOWS.md
- 修改：docs/compatibility.md
- 修改：docs/protocol.md
- 仅当当前发布行为需要说明时修改：PRIVACY.md 和 THIRD_PARTY_NOTICES.md
- 真实验收完成后创建：docs/release-acceptance-v0.1.0-alpha.1.md，不得包含敏感机器数据

- [ ] 说明 Private Alpha 范围、确切版本、已知限制和安装包布局。
- [ ] 说明 Extension 需要在 Chrome Developer Mode 中以 unpacked 方式加载。
- [ ] 说明三个发布资产、SHA256 文件和 SBOM。
- [ ] 说明本 Alpha 中图片仍然使用远程 URL。
- [ ] 说明 configure-vault → install → load Extension → capture → repair/upgrade/uninstall 验收流程。
- [ ] 将历史实施计划和历史示例明确标记为历史内容；不要把它们批量重写为当前事实。

验证：

~~~powershell
rg -n -i 'v0\.1\.0-alpha\.1|Windows|Chrome|Developer Mode|Helper|SHA256|SBOM|图片本地化|Vault' README.md CHANGELOG.md SECURITY.md INSTALL-WINDOWS.md docs
git diff --check
~~~

预期结果：当前面向用户的文档描述确切的 Alpha 资产和限制，不声称未经验证的真实运行行为已经完成。

### 任务 6：完成开发目录门禁

**目录：** G:\Capture for Tolaria

- [ ] 使用 frozen lockfile 安装依赖。
- [ ] 执行完整 workspace lint、typecheck、test 和 build 门禁。
- [ ] 执行 Golden tests 和全部 Windows Pester tests。
- [ ] 构建 Helper 并组装本地 Alpha Release bundle。
- [ ] 检查 bundle 中的生成文件/敏感文件，并验证 checksums/SBOM。
- [ ] 在创建发布副本前解决所有失败项。

验证：

~~~powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run check
pnpm.cmd run test:golden
Invoke-Pester -Path installer/windows/tests
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
~~~

预期结果：每条命令都成功退出；发布输出只生成在被忽略的 release/ 中，不复制到源码仓库。

### 任务 7：创建并审计发布副本

**目录：**

- 源目录：G:\Capture for Tolaria
- 目标目录：G:\发布\Capture for Tolaria-GitHub

- [ ] 确认目标目录为空；如目标已有内容，必须先获得明确审阅，不得直接替换。
- [ ] 只复制经过审计的源码、测试、文档、workflows、安装脚本和可发布设计资产。
- [ ] 排除 .git、.pnpm-store、node_modules、dist、release、Vault 数据、.env、凭据、用户路径、日志和临时文件。
- [ ] 在排除项生效后比较源目录和目标目录的文件清单及哈希。
- [ ] 初始化 Git 前执行目标目录敏感内容扫描。

验证：

~~~powershell
git -C G:\发布\Capture for Tolaria-GitHub status --short
Test-Path G:\发布\Capture for Tolaria-GitHub\.pnpm-store
Test-Path G:\发布\Capture for Tolaria-GitHub\node_modules
Test-Path G:\发布\Capture for Tolaria-GitHub\dist
Test-Path G:\发布\Capture for Tolaria-GitHub\release
~~~

预期结果：目标目录只包含经过审阅的源码树，不包含任何排除路径。

### 任务 8：初始化 Private GitHub 源码仓库

**目录：** G:\发布\Capture for Tolaria-GitHub

**外部前置条件：** 用户提供或创建一个没有自动生成文件的空 Private GitHub 仓库 URL。

- [ ] 使用独立 Git 仓库，并将默认分支设置为 main。
- [ ] 添加用户提供的 GitHub remote；不得猜测 owner 或 repository URL。
- [ ] 暂存经过审阅的源码树，并执行 git diff --cached --check。
- [ ] 确认暂存文件清单中没有 Helper EXE、dist、release、.pnpm-store、Vault 数据、凭据或用户路径。
- [ ] 仅从发布目录创建初始源码 commit，并 push main。

验证：

~~~powershell
git -C G:\发布\Capture for Tolaria-GitHub status --short
git -C G:\发布\Capture for Tolaria-GitHub branch --show-current
git -C G:\发布\Capture for Tolaria-GitHub remote -v
git -C G:\发布\Capture for Tolaria-GitHub ls-files
~~~

预期结果：Private GitHub 仓库中存在 main，且只包含源码、测试、文档、规则、workflows 和脚本。

### 任务 9：配置 GitHub 治理并执行发布目录门禁

**文件：**

- 创建：.github/dependabot.yml、.github/CODEOWNERS、issue templates、pull request template、CODE_OF_CONDUCT.md，以及适用的 CodeQL workflow
- 修改：.github/workflows/ci.yml；必要时修改 README 状态链接

- [ ] 首次 push 后为 main 启用分支保护。
- [ ] 要求 Windows CI 检查通过后才能合并。
- [ ] 在 Private 仓库可用的情况下启用 Dependabot、CodeQL、Secret Scanning 和 Private Vulnerability Reporting。
- [ ] 在发布目录重新安装依赖，并重新执行全部质量门禁。
- [ ] 从发布目录重新构建最终资产，不要从开发目录复制生成文件。

验证：

~~~powershell
Set-Location G:\发布\Capture for Tolaria-GitHub
pnpm.cmd install --frozen-lockfile
pnpm.cmd run check
pnpm.cmd run test:golden
Invoke-Pester -Path installer/windows/tests
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
~~~

预期结果：发布目录可以独立生成相同且已验证的 Alpha 资产。

### 任务 10：执行干净 Windows/Chrome Alpha 验收

**证据：** 只有在真实验收完成后，才创建 docs/release-acceptance-v0.1.0-alpha.1.md；其中只能包含脱敏且可复现的证据。

- [ ] 从 GitHub 下载确切的 Release 资产并验证 SHA256SUMS.txt。
- [ ] 使用没有 Node.js 的干净 Windows 用户或 VM 配置测试 Vault，并运行 Installer ZIP。
- [ ] 在 Chrome Developer Mode 中以 unpacked 方式加载 Extension ZIP。
- [ ] 捕获公开文章，验证 Markdown、frontmatter、source URL、clipped timestamp 和远程图片行为。
- [ ] 验证不会覆盖已有文件，冲突文件会获得后缀。
- [ ] 验证 Native Host 注册、Extension ID、allowed_origins 和 Helper 往返通信。
- [ ] 执行 Repair、Upgrade 和 Uninstall；确认 Vault 和 Markdown 仍然保留。
- [ ] 将失败项记录为发布阻断条件，不得静默修改验收记录。

预期结果：干净环境中的全部 Windows/Chrome 和 Vault 行为通过；验收证据文件不保存敏感数据。

### 任务 11：创建并验证 Private Alpha Release

**目录：** G:\发布\Capture for Tolaria-GitHub

- [ ] 确认发布 commit 已在 main，且全部必要 CI 检查为绿色。
- [ ] 从已验证的发布 commit 创建带注释的 tag v0.1.0-alpha.1。
- [ ] 仅从发布目录 push tag。
- [ ] 确认 workflow 创建 Private GitHub Pre-release。
- [ ] 验证上传的资产：
  - capture-for-tolaria-extension-v0.1.0-alpha.1.zip
  - capture-for-tolaria-installer-v0.1.0-alpha.1.zip
  - capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe
  - SHA256SUMS.txt
  - SBOM.spdx.json
- [ ] 再次下载每个资产，并与生成的 checksums 比较。
- [ ] 确认 tag、Release commit、README 版本、CHANGELOG 版本、SECURITY 支持版本和安装文档版本完全一致。

预期结果：Private GitHub Pre-release 可以由带 tag 的发布 commit 可复现，且所有资产均可由授权用户下载。

### 任务 12：发布后交接和保留状态

- [ ] 分别报告源码目录、发布目录、分支、commit、tag、CI run、Release URL、资产名称、SHA256 和验收结果。
- [ ] 保留开发目录和发布目录工作区，供复核使用。
- [ ] 在用户审阅报告并明确批准清理前，不删除分支、worktree、临时证据、发布 staging 文件或中间产物。
- [ ] 将所有未验证的公开发布或 Chrome Web Store 工作标记为 deferred，不得暗示 Alpha 验收已经覆盖这些范围。

---

## 发布阻断条件

以下任一项仍未解决时，Alpha 必须停止，不得创建 tag：

- 任一目录中的 pnpm.cmd run check 失败。
- Windows Pester 或 no-Node Helper 验收失败。
- 无法验证最终 Extension ZIP Manifest。
- Installer ZIP 无法找到内置 Helper，或显式 -HelperPath 失败。
- Extension ID 与 Native Host allowed_origins 不一致。
- SHA256 或 SBOM 与最终资产不匹配。
- 源码仓库暂存了敏感文件、Vault 数据、用户路径、私钥或生成的 Helper EXE。
- 未验证干净 Windows/Chrome 捕获流程或 Vault 写入。
- GitHub remote 或仓库归属未知。

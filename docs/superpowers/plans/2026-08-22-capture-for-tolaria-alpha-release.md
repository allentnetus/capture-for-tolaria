# Capture for Tolaria Alpha Release Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with an explicit verification checkpoint after each task. The development directory and the GitHub publication directory are separate workspaces; do not push, tag, or create a Release from the development directory.

**Goal:** Prepare and publish `Capture for Tolaria v0.1.0-alpha.1` as a Private GitHub source repository with a reproducible Windows/Chrome Alpha Release and verified release assets.

**Architecture:** `G:\Capture for Tolaria` remains the development and verification source. After the development gates pass, an audited one-way copy is made to `G:\发布\Capture for Tolaria-GitHub`, which owns the independent Git history, GitHub remote, `main` branch, tags, and Releases. CI builds and validates the final assets from the publication copy only.

**Tech Stack:** Windows PowerShell, Node.js 24, pnpm 11.19.0, TypeScript, Vitest, Pester, Chrome MV3 Extension, Native Messaging, Windows SEA Helper, GitHub Actions.

**Spec:** User-approved Alpha Release plan in the current conversation; project boundary rules in `AGENTS.md`.

## Global Constraints

- Development directory: `G:\Capture for Tolaria`.
- Publication directory: `G:\发布\Capture for Tolaria-GitHub`.
- Synchronization is one-way: development → publication; no unreviewed bidirectional mirror.
- GitHub `commit`, `push`, `tag`, and Release operations run only from the publication directory.
- Exclude `.pnpm-store/`, `node_modules/`, `dist/`, `release/`, Vault data, `.env`, private keys, certificates, Native Host user paths, logs, and test temporary directories.
- Release identity: Git tag and GitHub Release `v0.1.0-alpha.1`.
- Chrome manifest uses numeric `version: "0.1.0"` and human-readable `version_name: "0.1.0 Alpha 1"`.
- The source repository and GitHub Release remain Private and Pre-release for this Alpha.
- The Alpha scope is Windows + Chrome + MV3 Article Capture + Direct File Channel; MCP, AI, image localization, Selection, Bookmark, Screenshot, Edge, macOS, Linux, cloud sync, and account features remain out of scope.
- Every task must leave the development tree or publication tree in a testable state before the next task begins.

---

### Task 1: Freeze the Alpha version contract

**Files:**
- Create: `VERSION`
- Modify: `package.json`
- Modify: `apps/extension/manifest.json`
- Modify: `apps/extension/package.json`
- Modify: `apps/helper/package.json`
- Modify: `packages/*/package.json`
- Modify: version constants, protocol fixtures, release scripts, and current release documentation identified by the version scan
- Test: `apps/extension/test/manifest.test.ts`, protocol/helper tests, and a new release-version consistency test if needed

**Interfaces:**
- Produces release identity `0.1.0-alpha.1` and tag `v0.1.0-alpha.1`.
- Produces Chrome-compatible manifest values: numeric `version: "0.1.0"` and `version_name: "0.1.0 Alpha 1"`.

- [ ] Add the canonical `VERSION` file containing exactly `0.1.0-alpha.1`.
- [ ] Update package and protocol/helper version values without rewriting historical examples that are explicitly marked as historical.
- [ ] Add/update the Extension `version_name` and keep `manifest.version` numeric.
- [ ] Update tests and current docs so they assert the new release contract.
- [ ] Run a repository version scan and review every remaining `0.1.0` reference before proceeding.

Verification:

```powershell
pnpm.cmd --filter @capture-for-tolaria/extension test
pnpm.cmd --filter @capture-for-tolaria/protocol test
rg -n -i '0\.1\.0|0\.1\.0-alpha\.1|v0\.1\.0' --glob '!node_modules/**' --glob '!.pnpm-store/**' --glob '!dist/**' --glob '!release/**' .
```

Expected: all affected tests pass; remaining plain `0.1.0` values are either the numeric Chrome manifest value or explicitly documented historical examples.

### Task 2: Harden source hygiene and repository rules

**Files:**
- Modify: `.gitignore`
- Modify: `AGENTS.md` only if the implementation reveals a missing boundary
- Create or modify: source hygiene validation script/test only if the existing checks cannot express the release exclusions

- [ ] Add `.pnpm-store/` to `.gitignore`.
- [ ] Scan the development tree for Vault data, `.env`, private keys, certificates, user-specific Native Host paths, logs, and temporary test outputs.
- [ ] Confirm `AGENTS.md` remains the authoritative development/publication boundary.
- [ ] Do not delete suspicious files automatically; stop and report any candidate that needs user review.

Verification:

```powershell
git check-ignore -v .pnpm-store node_modules dist release
rg -n -i --hidden 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\s*=' --glob '!.git/**' --glob '!node_modules/**' --glob '!.pnpm-store/**' .
```

Expected: generated and sensitive paths are ignored or absent; any intentional example values are reviewed and documented before publication.

### Task 3: Make release packaging reproducible

**Files:**
- Modify: `installer/windows/build-helper.ps1`
- Modify: `installer/windows/assemble-release.ps1`
- Modify: `installer/windows/generate-checksums.ps1`
- Modify: `installer/windows/generate-sbom.ps1`
- Modify: `.github/workflows/release.yml`
- Test: `installer/windows/tests/` and release-content validation checks

- [ ] Read the canonical release version instead of hardcoding `0.1.0` in Helper and archive names.
- [ ] Make the default release tag `v0.1.0-alpha.1` when no CI tag is present.
- [ ] Validate the manifest inside the final Extension ZIP, not `release\extension\manifest.json`.
- [ ] Keep the fixed Extension ID and exact permissions contract checks.
- [ ] Make the workflow upload filenames derive from the same release version as the build output.
- [ ] Ensure temporary extraction/staging directories are always removed in `finally` blocks.

Verification:

```powershell
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
Expand-Archive -LiteralPath .\release\capture-for-tolaria-extension-v0.1.0-alpha.1.zip -DestinationPath .\release\extension-check -Force
Get-Content .\release\extension-check\manifest.json -Raw | ConvertFrom-Json
```

Expected: final asset names contain `v0.1.0-alpha.1` or `0.1.0-alpha.1` consistently; the archive contains a valid manifest and no staging directory remains.

### Task 4: Make the Installer ZIP self-contained

**Files:**
- Modify: `installer/windows/assemble-release.ps1`
- Modify: `installer/windows/install.ps1`
- Modify: `installer/windows/repair.ps1`
- Modify: `installer/windows/tests/install.Tests.ps1`
- Modify: `installer/windows/tests/default-parameters.Tests.ps1`
- Modify: `installer/windows/tests/configure-vault-helper.Tests.ps1`
- Modify: `installer/windows/tests/no-node-runtime.Tests.ps1`
- Modify: `INSTALL-WINDOWS.md`, `installer/windows/install-extension.md`, and `README.md`

- [ ] Include the versioned Helper EXE at the Installer ZIP root while also publishing it as a separate GitHub Release asset.
- [ ] Make `install.ps1` locate the sibling Helper by default when run from the packaged Installer ZIP.
- [ ] Preserve explicit `-HelperPath` support for advanced/manual installation.
- [ ] Make `repair.ps1` use the same Helper resolution contract.
- [ ] Update errors and documentation to show the exact fallback and `-HelperPath` behavior.
- [ ] Add a Pester test that runs the packaged default path without passing `-HelperPath`.

Verification:

```powershell
Invoke-Pester -Path installer/windows/tests
```

Expected: install, repair, upgrade, uninstall, no-Node, and default-parameter tests pass; a user who downloads the Installer ZIP does not need a repository-local `release` directory.

### Task 5: Align current documentation and Alpha release notes

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `SECURITY.md`
- Modify: `INSTALL-WINDOWS.md`
- Modify: `docs/compatibility.md`
- Modify: `docs/protocol.md`
- Modify: `PRIVACY.md` and `THIRD_PARTY_NOTICES.md` only where current release behavior requires clarification
- Create: `docs/release-acceptance-v0.1.0-alpha.1.md` after real acceptance, without sensitive machine data

- [ ] Document the private Alpha scope, exact version, known limitations, and install package layout.
- [ ] Document that the Extension is loaded unpacked in Chrome Developer Mode.
- [ ] Document the three release assets, SHA256 file, and SBOM.
- [ ] Document that images remain remote URLs in this Alpha.
- [ ] Document the `configure-vault → install → load Extension → capture → repair/upgrade/uninstall` acceptance flow.
- [ ] Keep historical implementation plans and historical examples clearly historical; do not mass-rewrite them as current facts.

Verification:

```powershell
rg -n -i 'v0\.1\.0-alpha\.1|Windows|Chrome|Developer Mode|Helper|SHA256|SBOM|图片本地化|Vault' README.md CHANGELOG.md SECURITY.md INSTALL-WINDOWS.md docs
git diff --check
```

Expected: current user-facing documentation describes the exact Alpha assets and limitations without claiming unverified live behavior.

### Task 6: Complete development-directory gates

**Directory:** `G:\Capture for Tolaria`

- [ ] Install using the frozen lockfile.
- [ ] Run the full workspace lint, typecheck, test, and build gate.
- [ ] Run Golden tests and all Windows Pester tests.
- [ ] Build the Helper and assemble a local Alpha Release bundle.
- [ ] Inspect the bundle for generated/sensitive files and verify checksums/SBOM.
- [ ] Resolve every failure before creating the publication copy.

Verification:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run check
pnpm.cmd run test:golden
Invoke-Pester -Path installer/windows/tests
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
```

Expected: every command exits successfully; release output is generated only under ignored `release/` and is not copied into the source repository.

### Task 7: Create and audit the publication copy

**Directories:**
- Source: `G:\Capture for Tolaria`
- Destination: `G:\发布\Capture for Tolaria-GitHub`

- [ ] Confirm the destination is empty or obtain explicit review before replacing any existing file.
- [ ] Copy only audited source, tests, documentation, workflows, installer scripts, and publishable design assets.
- [ ] Exclude `.git`, `.pnpm-store`, `node_modules`, `dist`, `release`, Vault data, `.env`, credentials, user paths, logs, and temporary files.
- [ ] Compare source and destination file inventories and hashes after exclusions.
- [ ] Run the destination-sensitive-content scan before initializing Git.

Verification:

```powershell
git -C G:\发布\Capture for Tolaria-GitHub status --short
Test-Path G:\发布\Capture for Tolaria-GitHub\.pnpm-store
Test-Path G:\发布\Capture for Tolaria-GitHub\node_modules
Test-Path G:\发布\Capture for Tolaria-GitHub\dist
Test-Path G:\发布\Capture for Tolaria-GitHub\release
```

Expected: the destination contains the reviewed source tree only and none of the excluded paths.

### Task 8: Initialize the Private GitHub source repository

**Directory:** `G:\发布\Capture for Tolaria-GitHub`

**External prerequisite:** the user provides or creates an empty Private GitHub repository URL with no generated files.

- [ ] Initialize an independent Git repository with default branch `main`.
- [ ] Add the user-provided GitHub remote; do not invent an owner or repository URL.
- [ ] Stage the reviewed source tree and run `git diff --cached --check`.
- [ ] Verify the staged file list contains no Helper EXE, `dist`, `release`, `.pnpm-store`, Vault data, credentials, or user paths.
- [ ] Create the initial source commit and push `main` only from the publication directory.

Verification:

```powershell
git -C G:\发布\Capture for Tolaria-GitHub status --short
git -C G:\发布\Capture for Tolaria-GitHub branch --show-current
git -C G:\发布\Capture for Tolaria-GitHub remote -v
git -C G:\发布\Capture for Tolaria-GitHub ls-files
```

Expected: `main` exists on the Private GitHub repository and contains only source, tests, docs, rules, workflows, and scripts.

### Task 9: Configure GitHub governance and run the publication-directory gate

**Files:**
- Create: `.github/dependabot.yml`, `.github/CODEOWNERS`, issue templates, pull request template, `CODE_OF_CONDUCT.md`, and CodeQL workflow as appropriate
- Modify: `.github/workflows/ci.yml` and README status links if needed

- [ ] Enable branch protection on `main` after the first push.
- [ ] Require the Windows CI check before merging.
- [ ] Enable Dependabot, CodeQL, Secret Scanning, and Private Vulnerability Reporting where available for the Private repository.
- [ ] Reinstall dependencies and rerun all quality gates from the publication directory.
- [ ] Rebuild the final assets from the publication directory, not by copying generated files from development.

Verification:

```powershell
Set-Location G:\发布\Capture for Tolaria-GitHub
pnpm.cmd install --frozen-lockfile
pnpm.cmd run check
pnpm.cmd run test:golden
Invoke-Pester -Path installer/windows/tests
powershell -NoProfile -File installer/windows/build-helper.ps1
powershell -NoProfile -File installer/windows/assemble-release.ps1 -OutputDirectory .\release -ReleaseTag v0.1.0-alpha.1
```

Expected: the publication directory independently produces the same verified Alpha assets.

### Task 10: Run clean Windows/Chrome Alpha acceptance

**Evidence:** Create `docs/release-acceptance-v0.1.0-alpha.1.md` only with redacted, reproducible evidence.

- [ ] Download the exact Release assets from GitHub and verify `SHA256SUMS.txt`.
- [ ] Use a clean Windows user or VM without Node.js to configure a test Vault and run the Installer ZIP.
- [ ] Load the Extension ZIP unpacked in Chrome Developer Mode.
- [ ] Capture a public article and verify the Markdown, frontmatter, source URL, clipped timestamp, and remote image behavior.
- [ ] Verify existing files are not overwritten and conflicts receive suffixes.
- [ ] Verify Native Host registration, Extension ID, `allowed_origins`, and Helper round-trip.
- [ ] Run Repair, Upgrade, and Uninstall; confirm Vault and Markdown remain intact.
- [ ] Record failures as release blockers rather than silently changing the acceptance record.

Expected: all required Windows/Chrome and Vault behaviors pass in a clean environment; no sensitive data is stored in the evidence file.

### Task 11: Create and verify the Private Alpha Release

**Directory:** `G:\发布\Capture for Tolaria-GitHub`

- [ ] Confirm the release commit is on `main` and all required CI checks are green.
- [ ] Create annotated tag `v0.1.0-alpha.1` from the verified release commit.
- [ ] Push the tag from the publication directory.
- [ ] Confirm the workflow creates a Private GitHub Pre-release.
- [ ] Verify uploaded assets:
  - `capture-for-tolaria-extension-v0.1.0-alpha.1.zip`
  - `capture-for-tolaria-installer-v0.1.0-alpha.1.zip`
  - `capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe`
  - `SHA256SUMS.txt`
  - `SBOM.spdx.json`
- [ ] Download each asset again and compare it to the generated checksums.
- [ ] Verify the tag, Release commit, README version, CHANGELOG version, SECURITY support version, and installer documentation all agree.

Expected: the Private GitHub Pre-release is reproducible from the tagged publication commit and all assets are downloadable by authorized users.

### Task 12: Post-release handoff and retained state

- [ ] Report source directory, publication directory, branch, commit, tag, CI run, Release URL, asset names, SHA256, and acceptance result separately.
- [ ] Keep both development and publication working trees available for review.
- [ ] Do not delete branches, worktrees, temporary evidence, or release staging files until the user explicitly approves cleanup after reviewing the report.
- [ ] Mark any unverified public-release or Chrome Web Store work as deferred rather than implying Alpha completion covers it.

---

## Release blockers

The Alpha must stop before tagging if any of the following remains unresolved:

- `pnpm.cmd run check` fails in either directory.
- Windows Pester or no-Node Helper acceptance fails.
- The final Extension ZIP manifest cannot be validated.
- Installer ZIP cannot find its bundled Helper or explicit `-HelperPath` fails.
- Extension ID and Native Host `allowed_origins` differ.
- SHA256 or SBOM does not match final assets.
- A sensitive file, Vault data, user path, private key, or generated Helper EXE is staged for the source repository.
- Clean Windows/Chrome capture or Vault write is not verified.
- GitHub remote or repository ownership is unknown.

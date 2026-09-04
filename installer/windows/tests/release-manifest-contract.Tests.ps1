Describe "Release Extension manifest contract" {
    BeforeAll {
        $scriptRoot = Split-Path -Parent $PSScriptRoot
        $repoRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
        $assemblerPath = Join-Path $scriptRoot "assemble-release.ps1"
        $workflowPath = Join-Path $repoRoot ".github\workflows\release.yml"
        $assembler = Get-Content -LiteralPath $assemblerPath -Raw
        $workflow = Get-Content -LiteralPath $workflowPath -Raw
    }

    It "keeps local release assembly aligned with the settings page manifest" {
        $assembler | Should -Match "activeTab,nativeMessaging,scripting,storage"
        $assembler | Should -Match 'options_page -ne "options.html"'
    }

    It "keeps GitHub release validation aligned with the settings page manifest" {
        $workflow | Should -Match "activeTab,nativeMessaging,scripting,storage"
        $workflow | Should -Match 'options_page -ne "options.html"'
    }

    It "publishes only self-contained Installer packages as user assets" {
        $workflow | Should -Match '(?m)^          path: release/capture-for-tolaria-installer-\$\{\{ github\.ref_name \}\}\.zip\s*$'

        $releaseAssetBlock = ([regex]::Match(
            $workflow,
            '(?ms)^          files: \|\r?\n(?<assets>.*?)(?=^          generate_release_notes:)'
        ).Groups['assets'].Value -replace '(?m)^\s+', '').Trim()
        $releaseAssetBlock | Should -Be @'
release/capture-for-tolaria-installer-${{ github.ref_name }}.zip
release/capture-for-tolaria-installer-${{ github.ref_name }}-macos-arm64.dmg
release/capture-for-tolaria-installer-${{ github.ref_name }}-macos-x64.dmg
'@

        $workflow | Should -Match '(?ms)uses: actions/download-artifact@v4.*?path: release\s+.*?merge-multiple: true'
    }

    It "requires the runnable Extension files inside the self-contained Installer ZIP" {
        foreach ($file in @(
            'extension\manifest.json',
            'extension\background.js',
            'extension\options.html',
            'extension\popup.html'
        )) {
            $escapedFile = [regex]::Escape($file)
            $assembler | Should -Match ('"{0}"' -f $escapedFile)
            $workflow | Should -Match ('"{0}"' -f $escapedFile)
        }
    }

    It "stages only runnable Extension files and excludes compiler metadata" {
        $assembler | Should -Match '\$extensionRuntimePaths\s*=\s*@\('
        $assembler | Should -Not -Match 'Copy-Item -Path \(Join-Path \$extensionDist "\*"\)'
    }

    It "stages only user-facing Installer files" {
        $assembler | Should -Match '\$installerRuntimeFiles\s*=\s*@\('
        $assembler | Should -Not -Match 'Copy-Item -Path \(Join-Path \$scriptDirectory "\*\.ps1"\)'
        $assembler | Should -Not -Match 'Copy-Item -Path \(Join-Path \$scriptDirectory "\*\.json"\)'
        $assembler | Should -Not -Match 'Copy-Item -Path \(Join-Path \$scriptDirectory "\*\.in"\)'
        $assembler | Should -Not -Match 'Copy-Item -Path \(Join-Path \$scriptDirectory "\*\.md"\)'
        foreach ($file in @(
            'install.ps1',
            'repair.ps1',
            'configure-vault.ps1',
            'uninstall.ps1',
            'native-host-manifest.json.in',
            'install-extension.md'
        )) {
            $escapedFile = [regex]::Escape($file)
            $assembler | Should -Match ('"{0}"' -f $escapedFile)
        }
    }
}

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

    It "publishes only the self-contained Installer ZIP as a user asset" {
        $workflow | Should -Match '(?m)^          path: release/capture-for-tolaria-installer-\$\{\{ github\.ref_name \}\}\.zip\s*$'
        $workflow | Should -Not -Match '(?m)^          path: release\s*$'

        $releaseAssetBlock = [regex]::Match(
            $workflow,
            '(?ms)^          files: \|\r?\n(?<assets>.*?)(?=^          generate_release_notes:)'
        ).Groups['assets'].Value.Trim()
        $releaseAssetBlock | Should -Be 'release/capture-for-tolaria-installer-${{ github.ref_name }}.zip'
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
}

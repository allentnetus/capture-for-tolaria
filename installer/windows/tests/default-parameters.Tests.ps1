Describe "PowerShell script defaults" {
    BeforeAll {
        $scriptRoot = Split-Path -Parent $PSScriptRoot
        $repoRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
        $testRoot = Join-Path $env:TEMP "capture-for-tolaria-defaults-$PID"
        $previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $testRoot
        New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
        $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    }

    It "supports documented no-argument build, install, repair, and SBOM commands" {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"

            & $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptRoot "build-helper.ps1") 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "build-helper.ps1 failed without arguments"
            }

            & $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptRoot "install.ps1") 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "install.ps1 failed without arguments"
            }

            & $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptRoot "repair.ps1") 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "repair.ps1 failed without arguments"
            }

            & $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptRoot "generate-sbom.ps1") 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "generate-sbom.ps1 failed without arguments"
            }
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria\capture-for-tolaria-helper.exe") | Should -Be $true
        Test-Path -LiteralPath (Join-Path $repoRoot "release\SBOM.spdx.json") | Should -Be $true
    }

    AfterAll {
        & (Join-Path $scriptRoot "uninstall.ps1") `
            -InstallRoot (Join-Path $testRoot "Programs\CaptureForTolaria") `
            -ConfigPath (Join-Path $testRoot "CaptureForTolaria\config.json") `
            -ClearConfig | Out-Null
        $env:LOCALAPPDATA = $previousLocalAppData
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

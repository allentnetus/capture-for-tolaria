$script:scriptRoot = Split-Path -Parent $PSScriptRoot
$script:repoRoot = (Resolve-Path (Join-Path $script:scriptRoot "..\..")).Path

Describe "PowerShell script defaults" {
    BeforeAll {
        $script:testRoot = Join-Path $env:TEMP "capture-for-tolaria-defaults-$PID"
        $script:previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $script:testRoot
        New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null
        $script:powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    }

    It "supports documented no-argument build, install, repair, and SBOM commands" {
        & $script:powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:scriptRoot "build-helper.ps1") 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "build-helper.ps1 failed without arguments"
        }

        & $script:powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:scriptRoot "install.ps1") 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "install.ps1 failed without arguments"
        }

        & $script:powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:scriptRoot "repair.ps1") 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "repair.ps1 failed without arguments"
        }

        & $script:powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:scriptRoot "generate-sbom.ps1") 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "generate-sbom.ps1 failed without arguments"
        }

        Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria\capture-for-tolaria-helper.exe") | Should Be $true
        Test-Path -LiteralPath (Join-Path $script:repoRoot "release\SBOM.spdx.json") | Should Be $true
    }

    AfterAll {
        & (Join-Path $script:scriptRoot "uninstall.ps1") `
            -InstallRoot (Join-Path $script:testRoot "Programs\CaptureForTolaria") `
            -ConfigPath (Join-Path $script:testRoot "CaptureForTolaria\config.json") `
            -ClearConfig | Out-Null
        $env:LOCALAPPDATA = $script:previousLocalAppData
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

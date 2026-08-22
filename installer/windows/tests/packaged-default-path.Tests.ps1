$script:scriptRoot = Split-Path -Parent $PSScriptRoot
$script:repoRoot = (Resolve-Path (Join-Path $script:scriptRoot "..\..")).Path

Describe "Packaged Installer default Helper path" {
    BeforeAll {
        $script:version = (Get-Content -LiteralPath (Join-Path $script:repoRoot "VERSION") -Raw).Trim()
        $script:installerZip = Join-Path $script:repoRoot "release\capture-for-tolaria-installer-v$script:version.zip"
        if (-not (Test-Path -LiteralPath $script:installerZip -PathType Leaf)) {
            throw "Assemble the Alpha Installer ZIP before running this test: $script:installerZip"
        }

        $script:testRoot = Join-Path $env:TEMP "capture-for-tolaria-packaged-default-$PID"
        $script:previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $script:testRoot
        Expand-Archive -LiteralPath $script:installerZip -DestinationPath $script:testRoot -Force
        $script:installerScript = Join-Path $script:testRoot "installer\windows\install.ps1"
        $script:repairScript = Join-Path $script:testRoot "installer\windows\repair.ps1"
        $script:uninstallScript = Join-Path $script:testRoot "installer\windows\uninstall.ps1"
        $script:installRoot = Join-Path $script:testRoot "Programs\CaptureForTolaria"
    }

    It "installs and repairs using the bundled Helper without -HelperPath" {
        & $script:installerScript -InstallRoot $script:installRoot | Out-Null
        Test-Path -LiteralPath (Join-Path $script:installRoot "capture-for-tolaria-helper.exe") | Should Be $true

        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Remove-Item -LiteralPath $manifestPath -Force
        & $script:repairScript -InstallRoot $script:installRoot | Out-Null
        Test-Path -LiteralPath $manifestPath | Should Be $true
    }

    AfterAll {
        if (Test-Path -LiteralPath $script:uninstallScript) {
            & $script:uninstallScript -InstallRoot $script:installRoot -ClearConfig | Out-Null
        }
        $env:LOCALAPPDATA = $script:previousLocalAppData
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

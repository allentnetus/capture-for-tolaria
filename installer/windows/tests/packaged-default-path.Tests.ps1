Describe "Packaged Installer default Helper path" {
    BeforeAll {
        $scriptRoot = Split-Path -Parent $PSScriptRoot
        $repoRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
        $version = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
        $installerZip = Join-Path $repoRoot "release\capture-for-tolaria-installer-v$version.zip"
        if (-not (Test-Path -LiteralPath $installerZip -PathType Leaf)) {
            throw "Assemble the packaged Installer ZIP before running this test: $installerZip"
        }

        $testRoot = Join-Path $env:TEMP "capture-for-tolaria-packaged-default-$PID"
        $previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $testRoot
        Expand-Archive -LiteralPath $installerZip -DestinationPath $testRoot -Force
        $installerScript = Join-Path $testRoot "installer\windows\install.ps1"
        $repairScript = Join-Path $testRoot "installer\windows\repair.ps1"
        $uninstallScript = Join-Path $testRoot "installer\windows\uninstall.ps1"
        $installRoot = Join-Path $testRoot "Programs\CaptureForTolaria"
    }

    It "installs and repairs using the bundled Helper without -HelperPath" {
        & $installerScript -InstallRoot $installRoot | Out-Null
        Test-Path -LiteralPath (Join-Path $installRoot "capture-for-tolaria-helper.exe") | Should -Be $true

        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Remove-Item -LiteralPath $manifestPath -Force
        & $repairScript -InstallRoot $installRoot | Out-Null
        Test-Path -LiteralPath $manifestPath | Should -Be $true
    }

    AfterAll {
        if (Test-Path -LiteralPath $uninstallScript) {
            & $uninstallScript -InstallRoot $installRoot -ClearConfig | Out-Null
        }
        $env:LOCALAPPDATA = $previousLocalAppData
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

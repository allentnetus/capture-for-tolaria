Describe "Capture for Tolaria per-user install" {
    BeforeAll {
        $scriptRoot = Split-Path -Parent $PSScriptRoot
        $testRoot = Join-Path $env:TEMP "capture-for-tolaria-install-$PID"
        $helper = Join-Path $testRoot "helper.exe"
        $previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $testRoot
        New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
        Set-Content -LiteralPath $helper -Value "helper" -Encoding ascii
        $installRoot = Join-Path $testRoot "Programs\CaptureForTolaria"
    }

    It "installs Helper, Host manifest, and HKCU registration without UAC" {
        & (Join-Path $scriptRoot "install.ps1") `
            -HelperPath $helper `
            -InstallRoot $installRoot | Out-Null

        Test-Path -LiteralPath (Join-Path $installRoot "capture-for-tolaria-helper.exe") | Should -Be $true
        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Test-Path -LiteralPath $manifestPath | Should -Be $true
        ([IO.File]::ReadAllBytes($manifestPath))[0] | Should -Be ([byte][char]'{')
        (Get-ItemProperty -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.capture_for_tolaria.helper").'(default)' | Should -Be $manifestPath
    }

    It "repairs a missing manifest and keeps install idempotent" {
        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Remove-Item -LiteralPath $manifestPath -Force
        & (Join-Path $scriptRoot "repair.ps1") `
            -HelperPath $helper `
            -InstallRoot $installRoot | Out-Null
        Test-Path -LiteralPath $manifestPath | Should -Be $true

        Set-Content -LiteralPath $helper -Value "helper-upgraded" -Encoding ascii
        & (Join-Path $scriptRoot "install.ps1") `
            -HelperPath $helper `
            -InstallRoot $installRoot | Out-Null
        (Get-Content -LiteralPath (Join-Path $installRoot "capture-for-tolaria-helper.exe") -Raw).Trim() | Should -Be "helper-upgraded"
    }

    AfterAll {
        & (Join-Path $scriptRoot "uninstall.ps1") -InstallRoot $installRoot | Out-Null
        $env:LOCALAPPDATA = $previousLocalAppData
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

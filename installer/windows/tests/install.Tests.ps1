$script:scriptRoot = Split-Path -Parent $PSScriptRoot

Describe "Capture for Tolaria per-user install" {
    BeforeAll {
        $script:testRoot = Join-Path $env:TEMP "capture-for-tolaria-install-$PID"
        $script:helper = Join-Path $script:testRoot "helper.exe"
        $script:previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $script:testRoot
        New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null
        Set-Content -LiteralPath $script:helper -Value "helper" -Encoding ascii
        $script:installRoot = Join-Path $script:testRoot "Programs\CaptureForTolaria"
    }

    It "installs Helper, Host manifest, and HKCU registration without UAC" {
        & (Join-Path $script:scriptRoot "install.ps1") `
            -HelperPath $script:helper `
            -InstallRoot $script:installRoot | Out-Null

        Test-Path -LiteralPath (Join-Path $script:installRoot "capture-for-tolaria-helper.exe") | Should Be $true
        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Test-Path -LiteralPath $manifestPath | Should Be $true
        ([IO.File]::ReadAllBytes($manifestPath))[0] | Should Be ([byte][char]'{')
        (Get-ItemProperty -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.capture_for_tolaria.helper").'(default)' | Should Be $manifestPath
    }

    It "repairs a missing manifest and keeps install idempotent" {
        $manifestPath = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host\com.capture_for_tolaria.helper.json"
        Remove-Item -LiteralPath $manifestPath -Force
        & (Join-Path $script:scriptRoot "repair.ps1") `
            -HelperPath $script:helper `
            -InstallRoot $script:installRoot | Out-Null
        Test-Path -LiteralPath $manifestPath | Should Be $true

        Set-Content -LiteralPath $script:helper -Value "helper-upgraded" -Encoding ascii
        & (Join-Path $script:scriptRoot "install.ps1") `
            -HelperPath $script:helper `
            -InstallRoot $script:installRoot | Out-Null
        (Get-Content -LiteralPath (Join-Path $script:installRoot "capture-for-tolaria-helper.exe") -Raw).Trim() | Should Be "helper-upgraded"
    }

    AfterAll {
        & (Join-Path $script:scriptRoot "uninstall.ps1") -InstallRoot $script:installRoot | Out-Null
        $env:LOCALAPPDATA = $script:previousLocalAppData
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

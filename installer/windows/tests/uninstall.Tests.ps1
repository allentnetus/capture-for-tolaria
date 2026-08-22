$scriptRoot = Split-Path -Parent $PSScriptRoot

Describe "Capture for Tolaria uninstall" {
    BeforeAll {
        $testRoot = Join-Path $env:TEMP "capture-for-tolaria-uninstall-$PID"
        $vault = Join-Path $testRoot "Vault"
        $helper = Join-Path $testRoot "helper.exe"
        $previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $testRoot
        New-Item -ItemType Directory -Path $vault -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $vault "existing.md") -Value "keep" -Encoding utf8
        Set-Content -LiteralPath $helper -Value "helper" -Encoding ascii
        $configPath = Join-Path $testRoot "config.json"
        & (Join-Path $scriptRoot "configure-vault.ps1") -VaultPath $vault -ConfigPath $configPath | Out-Null
        $installRoot = Join-Path $testRoot "Programs\CaptureForTolaria"
        & (Join-Path $scriptRoot "install.ps1") -HelperPath $helper -InstallRoot $installRoot | Out-Null
    }

    It "removes app registration but keeps Vault and config by default" {
        & (Join-Path $scriptRoot "uninstall.ps1") -InstallRoot $installRoot -ConfigPath $configPath | Out-Null
        Test-Path -LiteralPath $installRoot | Should Be $false
        Test-Path -LiteralPath (Join-Path $vault "existing.md") | Should Be $true
        Test-Path -LiteralPath $configPath | Should Be $true
        Test-Path -LiteralPath "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.capture_for_tolaria.helper" | Should Be $false
    }

    AfterAll {
        & (Join-Path $scriptRoot "uninstall.ps1") -InstallRoot $installRoot -ConfigPath $configPath -ClearConfig | Out-Null
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
        $env:LOCALAPPDATA = $previousLocalAppData
    }
}

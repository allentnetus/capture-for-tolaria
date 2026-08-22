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
        $configPath = Join-Path $testRoot "CaptureForTolaria\config.json"
        & (Join-Path $scriptRoot "configure-vault.ps1") -VaultPath $vault -ConfigPath $configPath | Out-Null
        $installRoot = Join-Path $testRoot "Programs\CaptureForTolaria"
        & (Join-Path $scriptRoot "install.ps1") -HelperPath $helper -InstallRoot $installRoot | Out-Null
    }

    It "拒绝删除不受保护的安装目录" {
        $unsafeRoot = Join-Path $testRoot "Programs\Other"
        $sentinel = Join-Path $unsafeRoot "keep.txt"
        New-Item -ItemType Directory -Path $unsafeRoot -Force | Out-Null
        Set-Content -LiteralPath $sentinel -Value "keep" -Encoding utf8

        $threw = $false
        try {
            & (Join-Path $scriptRoot "uninstall.ps1") -InstallRoot $unsafeRoot -ConfigPath $configPath
        }
        catch {
            $threw = $true
        }
        $threw | Should Be $true

        Test-Path -LiteralPath $sentinel | Should Be $true
        Remove-Item -LiteralPath $unsafeRoot -Recurse -Force
    }

    It "拒绝清理默认目录之外的配置路径" {
        $unsafeConfigPath = Join-Path $testRoot "outside-config.json"
        Set-Content -LiteralPath $unsafeConfigPath -Value "keep" -Encoding utf8

        $threw = $false
        try {
            $uninstallParameters = @{
                InstallRoot = $installRoot
                ConfigPath = $unsafeConfigPath
                ClearConfig = $true
            }
            & (Join-Path $scriptRoot "uninstall.ps1") @uninstallParameters
        }
        catch {
            $threw = $true
        }
        $threw | Should Be $true

        Test-Path -LiteralPath $unsafeConfigPath | Should Be $true
        Test-Path -LiteralPath $installRoot | Should Be $true
        Remove-Item -LiteralPath $unsafeConfigPath -Force
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

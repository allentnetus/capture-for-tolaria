$script:scriptRoot = Split-Path -Parent $PSScriptRoot

Describe "Capture for Tolaria uninstall" {
    BeforeAll {
        $script:testRoot = Join-Path $env:TEMP "capture-for-tolaria-uninstall-$PID"
        $script:vault = Join-Path $script:testRoot "Vault"
        $script:helper = Join-Path $script:testRoot "helper.exe"
        $script:previousLocalAppData = $env:LOCALAPPDATA
        $env:LOCALAPPDATA = $script:testRoot
        New-Item -ItemType Directory -Path $script:vault -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $script:vault "existing.md") -Value "keep" -Encoding utf8
        Set-Content -LiteralPath $script:helper -Value "helper" -Encoding ascii
        $script:configPath = Join-Path $script:testRoot "CaptureForTolaria\config.json"
        & (Join-Path $script:scriptRoot "configure-vault.ps1") -VaultPath $script:vault -ConfigPath $script:configPath | Out-Null
        $script:installRoot = Join-Path $script:testRoot "Programs\CaptureForTolaria"
        & (Join-Path $script:scriptRoot "install.ps1") -HelperPath $script:helper -InstallRoot $script:installRoot | Out-Null
    }

    It "拒绝删除不受保护的安装目录" {
        $unsafeRoot = Join-Path $script:testRoot "Programs\Other"
        $sentinel = Join-Path $unsafeRoot "keep.txt"
        New-Item -ItemType Directory -Path $unsafeRoot -Force | Out-Null
        Set-Content -LiteralPath $sentinel -Value "keep" -Encoding utf8

        $threw = $false
        try {
            & (Join-Path $script:scriptRoot "uninstall.ps1") -InstallRoot $unsafeRoot -ConfigPath $script:configPath
        }
        catch {
            $threw = $true
        }
        $threw | Should Be $true

        Test-Path -LiteralPath $sentinel | Should Be $true
        Remove-Item -LiteralPath $unsafeRoot -Recurse -Force
    }

    It "拒绝清理默认目录之外的配置路径" {
        $unsafeConfigPath = Join-Path $script:testRoot "outside-config.json"
        Set-Content -LiteralPath $unsafeConfigPath -Value "keep" -Encoding utf8

        $threw = $false
        try {
            $uninstallParameters = @{
                InstallRoot = $script:installRoot
                ConfigPath = $unsafeConfigPath
                ClearConfig = $true
            }
            & (Join-Path $script:scriptRoot "uninstall.ps1") @uninstallParameters
        }
        catch {
            $threw = $true
        }
        $threw | Should Be $true

        Test-Path -LiteralPath $unsafeConfigPath | Should Be $true
        Test-Path -LiteralPath $script:installRoot | Should Be $true
        Remove-Item -LiteralPath $unsafeConfigPath -Force
    }

    It "removes app registration but keeps Vault and config by default" {
        & (Join-Path $script:scriptRoot "uninstall.ps1") -InstallRoot $script:installRoot -ConfigPath $script:configPath | Out-Null
        Test-Path -LiteralPath $script:installRoot | Should Be $false
        Test-Path -LiteralPath (Join-Path $script:vault "existing.md") | Should Be $true
        Test-Path -LiteralPath $script:configPath | Should Be $true
        Test-Path -LiteralPath "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.capture_for_tolaria.helper" | Should Be $false
    }

    AfterAll {
        & (Join-Path $script:scriptRoot "uninstall.ps1") -InstallRoot $script:installRoot -ConfigPath $script:configPath -ClearConfig | Out-Null
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
        $env:LOCALAPPDATA = $script:previousLocalAppData
    }
}

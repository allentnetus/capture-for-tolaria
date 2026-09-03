# Chrome Extension 安装

`v0.1.0-beta.6` 使用自包含 Installer ZIP 和 Chrome 开发者模式，不使用 Chrome Web Store。

1. 解压 `capture-for-tolaria-installer-v0.1.0-beta.6.zip`。
2. 打开 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选择 Installer ZIP 解压目录中的 `extension` 文件夹；不需要单独下载 Extension ZIP。
6. 确认 Extension ID 为：

```text
ncjeeembmcgkfjipkfhganbdnadbhdcl
```

Native Host manifest 的 `allowed_origins` 必须严格包含：

```text
chrome-extension://ncjeeembmcgkfjipkfhganbdnadbhdcl/
```

Extension manifest 中的公开 `key` 只用于固定 ID。Release 私钥不提交仓库、不放入 ZIP，也不写入安装脚本。

## 升级

关闭正在进行的剪藏，替换解压后的 Extension 目录，在 `chrome://extensions` 点击 Extension 的刷新按钮。Helper 通过 `hello` 检查协议版本和 capabilities；协议不兼容时不会写入 Vault。

V0.1.x 不自动下载或执行新 Helper。Beta.6 构建未签名，用户应只从项目 Release 页面获取当前版本的自包含 Installer ZIP。Helper 由 Chrome 在第一次 Native Messaging 连接时按需启动，用户不需要手动运行。

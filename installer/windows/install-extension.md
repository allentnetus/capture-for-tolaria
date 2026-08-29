# Chrome Extension 安装

`v0.1.0-beta.1` 使用 Release ZIP 和 Chrome 开发者模式，不使用 Chrome Web Store。

1. 解压 Release ZIP。
2. 打开 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选择解压后的 Extension 目录。
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

V0.1.x 不自动下载或执行新 Helper。Beta.1 构建未签名，用户应只从项目 Release 页面获取校验过的 ZIP，并核对 `SHA256SUMS.txt`。

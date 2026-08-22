import { getConfiguredVault, validateConfiguredVault } from "./vault-config.js";
import { FileChannelError } from "./errors.js";

export async function resolveConfiguredVault(): Promise<string> {
  const configuredVault = await getConfiguredVault();
  if (!configuredVault) {
    throw new FileChannelError("VAULT_NOT_CONFIGURED", "尚未配置 Tolaria Vault");
  }

  const validation = await validateConfiguredVault(configuredVault);
  if (validation !== "ready") {
    throw new FileChannelError("VAULT_ACCESS_DENIED", "授权 Vault 当前不可访问");
  }
  return configuredVault;
}

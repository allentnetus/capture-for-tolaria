import {
  getConfiguredVaultConfig,
  validateConfiguredVault,
  type VaultConfig
} from "./vault-config.js";
import { FileChannelError } from "./errors.js";

export async function resolveConfiguredVaultConfig(): Promise<VaultConfig> {
  const configured = await getConfiguredVaultConfig();
  if (!configured) {
    throw new FileChannelError("VAULT_NOT_CONFIGURED", "尚未配置 Tolaria Vault");
  }

  const validation = await validateConfiguredVault(configured.vaultRoot);
  if (validation !== "ready") {
    throw new FileChannelError("VAULT_ACCESS_DENIED", "授权 Vault 当前不可访问");
  }
  return configured;
}

export async function resolveConfiguredVault(): Promise<string> {
  return (await resolveConfiguredVaultConfig()).vaultRoot;
}

#!/usr/bin/env bash

set -euo pipefail
umask 077

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

usage() {
  printf '%s\n' "Usage: configure-vault.sh --vault-root <absolute-path> [--allow-synthetic-dns]" >&2
  exit 2
}

if [ "$(uname -s)" != "Darwin" ]; then
  die "this Installer supports macOS only"
fi
if [ -z "${HOME:-}" ] || [ "${HOME#/}" = "$HOME" ] || [ "$HOME" = "/" ]; then
  die "HOME must be an absolute current-user directory"
fi

readonly APPLICATION_DATA="$HOME/Library/Application Support/CaptureForTolaria"
readonly CONFIG_PATH="$APPLICATION_DATA/config.json"
config_temp="$APPLICATION_DATA/.config.json.tmp.$$"

vault_root=""
allow_synthetic_dns="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --vault-root)
      [ "$#" -ge 2 ] || usage
      vault_root="$2"
      shift 2
      ;;
    --allow-synthetic-dns)
      allow_synthetic_dns="true"
      shift
      ;;
    *)
      usage
      ;;
  esac
done

[ -n "$vault_root" ] || usage
case "$vault_root" in
  /*)
    ;;
  *)
    die "Vault root must be an absolute path"
    ;;
esac
case "$vault_root" in
  *'/../'*|*'/./'|*/.|*/..|*'//'*)
    die "Vault root contains a non-canonical path component"
    ;;
esac

assert_no_symlink_components() {
  path_to_check="$1"
  current="/"
  remaining="${path_to_check#/}"
  while [ -n "$remaining" ]; do
    case "$remaining" in
      */*)
        segment="${remaining%%/*}"
        remaining="${remaining#*/}"
        ;;
      *)
        segment="$remaining"
        remaining=""
        ;;
    esac
    [ -n "$segment" ] || die "path contains an empty component"
    if [ -L "$current$segment" ]; then
      die "path contains a symlink"
    fi
    if [ "$current" = "/" ]; then
      current="/$segment/"
    else
      current="$current$segment/"
    fi
  done
}

assert_no_symlink_components "$HOME"
assert_no_symlink_components "$vault_root"
[ -d "$vault_root" ] || die "Vault root must be an existing directory"
[ ! -L "$vault_root" ] || die "Vault root must not be a symlink"
[ -r "$vault_root" ] || die "Vault root is not readable"
[ -w "$vault_root" ] || die "Vault root is not writable"

assert_no_symlink_components "$APPLICATION_DATA"
assert_no_symlink_components "$CONFIG_PATH"
mkdir -p "$APPLICATION_DATA"
[ ! -L "$APPLICATION_DATA" ] || die "application data directory must not be a symlink"
[ ! -L "$CONFIG_PATH" ] || die "config file must not be a symlink"
if [ -e "$config_temp" ] || [ -L "$config_temp" ]; then
  die "temporary config path already exists"
fi

if [ "$allow_synthetic_dns" != "true" ] && [ -f "$CONFIG_PATH" ]; then
  if grep -Eq '"allowSyntheticDns"[[:space:]]*:[[:space:]]*true' "$CONFIG_PATH"; then
    allow_synthetic_dns="true"
  fi
fi

json_vault_root="$(printf '%s' "$vault_root" | sed 's/\\/\\\\/g; s/"/\\\"/g')"
if [ "$allow_synthetic_dns" = "true" ]; then
  printf '%s\n' '{' "  \"vaultRoot\": \"$json_vault_root\"," '  \"allowSyntheticDns\": true' '}' > "$config_temp"
else
  printf '%s\n' '{' "  \"vaultRoot\": \"$json_vault_root\"" '}' > "$config_temp"
fi
chmod 600 "$config_temp"
mv -f "$config_temp" "$CONFIG_PATH"

printf '%s\n' "Capture for Tolaria Vault configuration saved."

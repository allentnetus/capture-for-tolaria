#!/usr/bin/env bash

set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  printf '%s\n' "macOS installer tests require Darwin" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
macos_installer_dir="$(cd "$script_dir/.." && pwd -P)"
temp_base="${TMPDIR:-/tmp}"
temp_base="${temp_base%/}"
test_root="$(mktemp -d "$temp_base/capture-for-tolaria-macos-tests.XXXXXX")"
test_root="$(cd "$test_root" && pwd -P)"

for required_script in build-helper.sh assemble-release.sh sign-and-notarize.sh; do
  [ -f "$macos_installer_dir/$required_script" ] || {
    printf '%s\n' "required macOS build script is missing" >&2
    exit 1
  }
done

version_path="$macos_installer_dir/../../VERSION"
[ -f "$version_path" ] || {
  printf '%s\n' "VERSION is missing from the repository" >&2
  exit 1
}
version="$(tr -d '\r\n' < "$version_path")"
printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-(alpha|beta)\.[0-9]+$' || {
  printf '%s\n' "VERSION is invalid" >&2
  exit 1
}

cleanup() {
  rm -rf "$test_root"
}
trap cleanup EXIT

home_dir="$test_root/home"
vault_dir="$test_root/vault"
package_root="$test_root/package"
package_installer_dir="$package_root/installer/macos"
mkdir -p "$home_dir" "$vault_dir" "$package_installer_dir"

arch="$(uname -m)"
case "$arch" in
  arm64)
    arch_label="arm64"
    ;;
  x86_64)
    arch_label="x64"
    ;;
  *)
    printf '%s\n' "unsupported test architecture" >&2
    exit 1
    ;;
esac

for installer_file in install.sh repair.sh configure-vault.sh uninstall.sh native-host-manifest.json.in; do
  cp "$macos_installer_dir/$installer_file" "$package_installer_dir/"
done
chmod 755 "$package_installer_dir"/*.sh
printf '%s\n' "$version" > "$package_root/VERSION"

helper_asset="$package_root/capture-for-tolaria-helper-$version-macos-$arch_label"
if [ -n "${CAPTURE_FOR_TOLARIA_MACOS_TEST_HELPER:-}" ]; then
  [ -f "$CAPTURE_FOR_TOLARIA_MACOS_TEST_HELPER" ] || {
    printf '%s\n' "configured macOS test Helper is missing" >&2
    exit 1
  }
  [ -x "$CAPTURE_FOR_TOLARIA_MACOS_TEST_HELPER" ] || {
    printf '%s\n' "configured macOS test Helper is not executable" >&2
    exit 1
  }
  [ ! -L "$CAPTURE_FOR_TOLARIA_MACOS_TEST_HELPER" ] || {
    printf '%s\n' "configured macOS test Helper must not be a symlink" >&2
    exit 1
  }
  cp "$CAPTURE_FOR_TOLARIA_MACOS_TEST_HELPER" "$helper_asset"
else
  printf '%s\n' '#!/bin/sh' 'exit 0' > "$helper_asset"
fi
chmod 755 "$helper_asset"

extension_source="$package_root/extension"
mkdir -p "$extension_source/icons"
printf '%s\n' '{"manifest_version":3}' > "$extension_source/manifest.json"
printf '%s\n' 'console.log("capture-for-tolaria");' > "$extension_source/background.js"
printf '%s\n' '<!doctype html><title>Options</title>' > "$extension_source/options.html"
printf '%s\n' '<!doctype html><title>Popup</title>' > "$extension_source/popup.html"

export HOME="$home_dir"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH}"

expect_failure() {
  if "$@" >/dev/null 2>&1; then
    printf '%s\n' "expected command to fail: $*" >&2
    exit 1
  fi
}

app_data="$HOME/Library/Application Support/CaptureForTolaria"
config_path="$app_data/config.json"
install_root="$app_data/Helper"
helper_target="$install_root/capture-for-tolaria-helper"
extension_target="$app_data/extension"
manifest_path="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.capture_for_tolaria.helper.json"

printf '%s\n' "macOS installer lifecycle tests"

"$package_installer_dir/configure-vault.sh" --vault-root "$vault_dir"
[ -f "$config_path" ]
[ ! -e "$vault_dir/Inbox/Web" ]

"$package_installer_dir/install.sh"
[ -x "$helper_target" ]
[ -f "$extension_target/manifest.json" ]
[ -f "$extension_target/background.js" ]
[ -f "$manifest_path" ]
node -e '
  const fs = require("node:fs");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const expected = {
    name: "com.capture_for_tolaria.helper",
    type: "stdio",
    allowed_origins: ["chrome-extension://ncjeeembmcgkfjipkfhganbdnadbhdcl/"],
    path: process.argv[2]
  };
  if (
    manifest.name !== expected.name ||
    manifest.type !== expected.type ||
    JSON.stringify(manifest.allowed_origins) !== JSON.stringify(expected.allowed_origins) ||
    manifest.path !== expected.path
  ) {
    process.exit(1);
  }
' "$manifest_path" "$helper_target"

extension_source_backup="$test_root/ejected-extension-source"
mv "$extension_source" "$extension_source_backup"
[ -f "$extension_target/manifest.json" ]
[ -f "$extension_target/background.js" ]
mv "$extension_source_backup" "$extension_source"

rm -f "$helper_target"
mkdir "$helper_target"
expect_failure "$package_installer_dir/install.sh"
rmdir "$helper_target"

rm -f "$manifest_path"
mkdir "$manifest_path"
expect_failure "$package_installer_dir/install.sh"
rmdir "$manifest_path"

dangling_target="$test_root/dangling-target"
expect_failure bash -c '
  script_path="$1"
  install_root="$2"
  dangling_target="$3"
  temp_path="$install_root/.capture-for-tolaria-helper.tmp.$$"
  ln -s "$dangling_target" "$temp_path"
  exec "$script_path"
' _ "$package_installer_dir/install.sh" "$install_root" "$dangling_target"
find "$install_root" -maxdepth 1 -type l -name '.capture-for-tolaria-helper.tmp.*' -delete

expect_failure bash -c '
  script_path="$1"
  host_directory="$2"
  dangling_target="$3"
  temp_path="$host_directory/.com.capture_for_tolaria.helper.json.tmp.$$"
  ln -s "$dangling_target" "$temp_path"
  exec "$script_path"
' _ "$package_installer_dir/install.sh" "$(dirname "$manifest_path")" "$dangling_target"
find "$(dirname "$manifest_path")" -maxdepth 1 -type l -name '.com.capture_for_tolaria.helper.json.tmp.*' -delete

expect_failure bash -c '
  script_path="$1"
  application_data="$2"
  dangling_target="$3"
  vault_root="$4"
  temp_path="$application_data/.config.json.tmp.$$"
  ln -s "$dangling_target" "$temp_path"
  exec "$script_path" --vault-root "$vault_root"
' _ "$package_installer_dir/configure-vault.sh" "$app_data" "$dangling_target" "$vault_dir"
find "$app_data" -maxdepth 1 -type l -name '.config.json.tmp.*' -delete

first_hash="$(shasum -a 256 "$helper_target" | awk '{print $1}')"
"$package_installer_dir/install.sh"
second_hash="$(shasum -a 256 "$helper_target" | awk '{print $1}')"
[ "$first_hash" = "$second_hash" ]

printf '%s\n' "preserved Markdown" > "$vault_dir/preserved.md"
printf '%s\n' '#!/bin/sh' 'exit 7' > "$helper_asset"
chmod 755 "$helper_asset"
"$package_installer_dir/repair.sh"
[ "$(shasum -a 256 "$helper_target" | awk '{print $1}')" != "$first_hash" ]
[ -f "$extension_target/manifest.json" ]
[ -f "$vault_dir/preserved.md" ]
[ -f "$config_path" ]

symlink_vault="$test_root/vault-link"
ln -s "$vault_dir" "$symlink_vault"
expect_failure "$package_installer_dir/configure-vault.sh" --vault-root "$symlink_vault"

install_root_backup="$test_root/real-install-root"
mv "$install_root" "$install_root_backup"
ln -s "$install_root_backup" "$install_root"
expect_failure "$package_installer_dir/repair.sh"
rm "$install_root"
mv "$install_root_backup" "$install_root"

"$package_installer_dir/uninstall.sh"
[ ! -e "$helper_target" ]
[ ! -e "$extension_target" ]
[ ! -e "$manifest_path" ]
[ -f "$config_path" ]
[ -f "$vault_dir/preserved.md" ]

"$package_installer_dir/install.sh"
"$package_installer_dir/uninstall.sh" --clear-config
[ ! -e "$helper_target" ]
[ ! -e "$extension_target" ]
[ ! -e "$manifest_path" ]
[ ! -e "$config_path" ]
[ -f "$vault_dir/preserved.md" ]

printf '%s\n' "macOS installer lifecycle tests passed"

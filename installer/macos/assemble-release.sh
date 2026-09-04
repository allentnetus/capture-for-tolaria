#!/usr/bin/env bash

set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
output_dir="$repo_root/release"
extension_dir="$repo_root/apps/extension/dist"
helper_path=""
requested_arch=""

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --arch)
      [ "$#" -ge 2 ] || die "--arch requires a value"
      requested_arch="$2"
      shift 2
      ;;
    --output-dir)
      [ "$#" -ge 2 ] || die "--output-dir requires a value"
      output_dir="$2"
      shift 2
      ;;
    --extension-dir)
      [ "$#" -ge 2 ] || die "--extension-dir requires a value"
      extension_dir="$2"
      shift 2
      ;;
    --helper-path)
      [ "$#" -ge 2 ] || die "--helper-path requires a value"
      helper_path="$2"
      shift 2
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || die "macOS DMG assembly requires macOS"
machine_arch="$(uname -m)"
case "$machine_arch" in
  arm64)
    machine_label="arm64"
    ;;
  x86_64)
    machine_label="x64"
    ;;
  *)
    die "unsupported macOS architecture: $machine_arch"
    ;;
esac
[ -z "$requested_arch" ] || [ "$requested_arch" = "$machine_label" ] || die "requested architecture does not match this runner"
arch_label="${requested_arch:-$machine_label}"

version_path="$repo_root/VERSION"
[ -f "$version_path" ] || die "VERSION is missing"
version="$(tr -d '\r\n' < "$version_path")"
printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-(alpha|beta)\.[0-9]+$' || die "VERSION is invalid"

if [ -z "$helper_path" ]; then
  helper_path="$repo_root/release/capture-for-tolaria-helper-$version-macos-$arch_label"
fi
[ -f "$helper_path" ] || die "matching architecture SEA Helper is missing"
[ -x "$helper_path" ] || die "SEA Helper is not executable"
[ -L "$helper_path" ] && die "SEA Helper must not be a symlink"
[ -d "$extension_dir" ] || die "Extension build output is missing"
[ -f "$repo_root/INSTALL-MACOS.md" ] || die "INSTALL-MACOS.md is missing"
[ -f "$repo_root/LICENSE" ] || die "LICENSE is missing"
[ -f "$repo_root/THIRD_PARTY_NOTICES.md" ] || die "THIRD_PARTY_NOTICES.md is missing"

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd -P)"
stage_root="$(mktemp -d "$output_dir/.capture-for-tolaria-dmg-$arch_label.XXXXXX")"
stage="$stage_root/Capture for Tolaria Installer"
dmg_path="$output_dir/capture-for-tolaria-installer-v$version-macos-$arch_label.dmg"

cleanup() {
  rm -rf "$stage_root"
}
trap cleanup EXIT

mkdir -p "$stage/extension" "$stage/installer/macos"
runtime_paths=(
  background.js
  content.js
  manifest.json
  options.html
  options.js
  popup.html
  popup.js
  icons
)
for runtime_path in "${runtime_paths[@]}"; do
  source_path="$extension_dir/$runtime_path"
  [ -e "$source_path" ] || die "Extension runtime file is missing: $runtime_path"
  [ ! -L "$source_path" ] || die "Extension runtime path must not be a symlink: $runtime_path"
  cp -R "$source_path" "$stage/extension/"
done

for installer_file in install.sh repair.sh configure-vault.sh uninstall.sh native-host-manifest.json.in; do
  source_path="$script_dir/$installer_file"
  [ -f "$source_path" ] || die "macOS Installer file is missing: $installer_file"
  cp "$source_path" "$stage/installer/macos/"
done
chmod 755 "$stage/installer/macos/"*.sh

cp "$helper_path" "$stage/capture-for-tolaria-helper-$version-macos-$arch_label"
chmod 755 "$stage/capture-for-tolaria-helper-$version-macos-$arch_label"
cp "$version_path" "$stage/VERSION"
cp "$repo_root/INSTALL-MACOS.md" "$stage/INSTALL-MACOS.md"
cp "$repo_root/README.md" "$stage/README.md"
cp "$repo_root/LICENSE" "$stage/LICENSE"
cp "$repo_root/THIRD_PARTY_NOTICES.md" "$stage/THIRD_PARTY_NOTICES.md"

if find "$stage" \( -name node_modules -o -name dist -o -name release -o -name '*.ts' -o -name '*.map' -o -name '*.env' \) -print -quit | grep -q .; then
  die "DMG staging contains a development artifact"
fi

rm -f "$dmg_path"
hdiutil create -quiet -volname "Capture for Tolaria" -srcfolder "$stage" -ov -format UDZO "$dmg_path"
[ -f "$dmg_path" ] || die "DMG was not produced"

printf '%s\n' "macOS Installer DMG assembled."
printf '%s\n' "$dmg_path"

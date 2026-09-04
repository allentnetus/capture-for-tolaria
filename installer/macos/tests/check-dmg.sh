#!/usr/bin/env bash

set -euo pipefail

dmg_path=""
expected_arch=""
expected_version=""

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dmg)
      [ "$#" -ge 2 ] || die "--dmg requires a path"
      dmg_path="$2"
      shift 2
      ;;
    --arch)
      [ "$#" -ge 2 ] || die "--arch requires a value"
      expected_arch="$2"
      shift 2
      ;;
    --version)
      [ "$#" -ge 2 ] || die "--version requires a value"
      expected_version="$2"
      shift 2
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || die "DMG content tests require macOS"
[ -f "$dmg_path" ] || die "DMG does not exist"
[ "$expected_arch" = "arm64" ] || [ "$expected_arch" = "x64" ] || die "unsupported expected architecture"
printf '%s' "$expected_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-(alpha|beta)\.[0-9]+$' || die "invalid expected version"

mount_root="$(mktemp -d "${TMPDIR:-/tmp}/capture-for-tolaria-dmg-content.XXXXXX")"
attached="false"
cleanup() {
  if [ "$attached" = "true" ]; then
    hdiutil detach "$mount_root" -quiet || true
  fi
  rm -rf "$mount_root"
}
trap cleanup EXIT

hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_root" -quiet
attached="true"

[ -d "$mount_root/extension" ] || die "DMG is missing extension"
[ -d "$mount_root/installer/macos" ] || die "DMG is missing macOS installer"
[ -f "$mount_root/VERSION" ] || die "DMG is missing VERSION"
[ "$(tr -d '\r\n' < "$mount_root/VERSION")" = "$expected_version" ] || die "DMG version is invalid"
[ -f "$mount_root/capture-for-tolaria-helper-$expected_version-macos-$expected_arch" ] || die "DMG is missing matching Helper"
[ -x "$mount_root/capture-for-tolaria-helper-$expected_version-macos-$expected_arch" ] || die "DMG Helper is not executable"

for extension_file in manifest.json background.js options.html popup.html; do
  [ -f "$mount_root/extension/$extension_file" ] || die "DMG is missing extension/$extension_file"
done

for required_file in install.sh repair.sh configure-vault.sh uninstall.sh native-host-manifest.json.in; do
  [ -f "$mount_root/installer/macos/$required_file" ] || die "DMG is missing $required_file"
done
for forbidden_file in build-helper.sh assemble-release.sh sign-and-notarize.sh run-tests.sh; do
  [ ! -e "$mount_root/installer/macos/$forbidden_file" ] || die "DMG contains a development script"
done

plutil -lint "$mount_root/extension/manifest.json" >/dev/null
for forbidden_name in node_modules dist release; do
  if find "$mount_root" -name "$forbidden_name" -print -quit | grep -q .; then
    die "DMG contains forbidden directory"
  fi
done
if find "$mount_root" \( -name '*.ts' -o -name '*.map' -o -name '*.jsonl' -o -name '*.env' \) -print -quit | grep -q .; then
  die "DMG contains a development or local-data file"
fi

hdiutil detach "$mount_root" -quiet
attached="false"
printf '%s\n' "macOS DMG content checks passed."

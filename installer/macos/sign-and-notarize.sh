#!/usr/bin/env bash

set -euo pipefail
umask 077

target=""
mode=""
identity=""
keychain_profile=""

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --helper)
      [ "$#" -ge 2 ] || die "--helper requires a path"
      target="$2"
      mode="helper"
      shift 2
      ;;
    --dmg)
      [ "$#" -ge 2 ] || die "--dmg requires a path"
      target="$2"
      mode="dmg"
      shift 2
      ;;
    --identity)
      [ "$#" -ge 2 ] || die "--identity requires a value"
      identity="$2"
      shift 2
      ;;
    --keychain-profile)
      [ "$#" -ge 2 ] || die "--keychain-profile requires a value"
      keychain_profile="$2"
      shift 2
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || die "macOS signing requires macOS"
[ -n "$target" ] || die "one of --helper or --dmg is required"
[ -n "$mode" ] || die "signing mode is missing"
[ -f "$target" ] || die "target does not exist"
[ ! -L "$target" ] || die "target must not be a symlink"

if [ "$mode" = "helper" ]; then
  [ -n "$identity" ] || die "--identity is required for Helper signing"
  codesign --force --sign "$identity" --options runtime --timestamp "$target"
  codesign --verify --strict --verbose=2 "$target"
  codesign --display --verbose=4 "$target" 2>&1 | grep -F 'flags=0x10000(runtime)' >/dev/null || die "Hardened Runtime flag is missing"
  printf '%s\n' "macOS Helper signature verification passed."
  exit 0
fi

[ "$mode" = "dmg" ] || die "unknown signing mode"
[ -n "$keychain_profile" ] || die "--keychain-profile is required for notarization"

mount_root="$(mktemp -d "${TMPDIR:-/tmp}/capture-for-tolaria-dmg-verify.XXXXXX")"
attached="false"
cleanup() {
  if [ "$attached" = "true" ]; then
    hdiutil detach "$mount_root" -quiet || true
  fi
  rm -rf "$mount_root"
}
trap cleanup EXIT

hdiutil attach "$target" -readonly -nobrowse -mountpoint "$mount_root" -quiet
attached="true"
embedded_helper="$(find "$mount_root" -type f -name 'capture-for-tolaria-helper-*' -print -quit)"
[ -n "$embedded_helper" ] || die "DMG does not contain a Helper"
codesign --verify --strict --verbose=2 "$embedded_helper"
hdiutil detach "$mount_root" -quiet
attached="false"

xcrun notarytool submit "$target" --keychain-profile "$keychain_profile" --wait
xcrun stapler staple "$target"
xcrun stapler validate "$target"
spctl --assess --type open --verbose "$target"

printf '%s\n' "macOS DMG Notarization, stapling and Gatekeeper verification passed."

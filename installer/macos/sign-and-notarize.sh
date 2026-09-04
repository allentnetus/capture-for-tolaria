#!/usr/bin/env bash

set -euo pipefail
umask 077

target=""
mode=""
identity=""
entitlements=""
helper_version=""
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
    --entitlements)
      [ "$#" -ge 2 ] || die "--entitlements requires a path"
      entitlements="$2"
      shift 2
      ;;
    --version)
      [ "$#" -ge 2 ] || die "--version requires a value"
      helper_version="$2"
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
  [ -n "$entitlements" ] || die "--entitlements is required for Helper signing"
  [ -n "$helper_version" ] || die "--version is required for Helper signing"
  [ -f "$entitlements" ] || die "Helper entitlements file does not exist"
  [ ! -L "$entitlements" ] || die "Helper entitlements file must not be a symlink"
  /usr/bin/plutil -lint "$entitlements" >/dev/null || die "Helper entitlements file is invalid"
  for required_entitlement in \
    com.apple.security.cs.allow-jit \
    com.apple.security.cs.allow-unsigned-executable-memory; do
    /usr/bin/plutil -p "$entitlements" | grep -F "\"$required_entitlement\" => true" >/dev/null || \
      die "Helper entitlements are missing $required_entitlement"
  done

  codesign --force --sign "$identity" --options runtime --entitlements "$entitlements" --timestamp "$target"
  codesign --verify --strict --verbose=2 "$target"
  codesign --display --verbose=4 "$target" 2>&1 | grep -F 'flags=0x10000(runtime)' >/dev/null || die "Hardened Runtime flag is missing"
  signed_entitlements="$(codesign --display --entitlements :- "$target" 2>&1)" || die "Signed Helper entitlements could not be read"
  for required_entitlement in \
    com.apple.security.cs.allow-jit \
    com.apple.security.cs.allow-unsigned-executable-memory; do
    printf '%s\n' "$signed_entitlements" | grep -F -A1 "<key>$required_entitlement</key>" | grep -F '<true/>' >/dev/null || \
      die "Signed Helper is missing $required_entitlement"
  done

  command -v node >/dev/null 2>&1 || die "Node.js is required for signed Helper smoke test"
  CAPTURE_HELPER_VERSION="$helper_version" node - "$target" <<'NODE'
const { spawn } = require("node:child_process");

const helperPath = process.argv[2];
const expectedVersion = process.env.CAPTURE_HELPER_VERSION;
const request = {
  protocolVersion: 1,
  requestId: "signed-helper-hello",
  extensionVersion: expectedVersion,
  action: "hello"
};
const payload = Buffer.from(JSON.stringify(request), "utf8");
const frame = Buffer.allocUnsafe(4 + payload.length);
frame.writeUInt32LE(payload.length, 0);
payload.copy(frame, 4);

const child = spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
let output = Buffer.alloc(0);
let diagnostics = "";
let settled = false;
let timeout;

function fail(message) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  child.kill();
  const detail = diagnostics.trim();
  console.error(detail ? `${message}; ${detail}` : message);
  process.exitCode = 1;
}

function succeed() {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  child.kill();
  process.exit(0);
}

child.stderr.on("data", (chunk) => {
  diagnostics += chunk.toString("utf8");
});
child.stdout.on("data", (chunk) => {
  if (settled) return;
  output = Buffer.concat([output, chunk]);
  if (output.length < 4) return;
  const length = output.readUInt32LE(0);
  if (length > 2_000_000) {
    fail("Signed Helper hello response is oversized");
    return;
  }
  if (output.length < length + 4) return;
  let response;
  try {
    response = JSON.parse(output.subarray(4, length + 4).toString("utf8"));
  } catch {
    fail("Signed Helper hello response is invalid JSON");
    return;
  }
  if (
    !response ||
    typeof response !== "object" ||
    response.protocolVersion !== 1 ||
    response.helperVersion !== expectedVersion ||
    !Array.isArray(response.capabilities) ||
    !response.capabilities.includes("clip.article") ||
    !response.capabilities.includes("direct-file")
  ) {
    fail("Signed Helper hello response is invalid");
    return;
  }
  succeed();
});
child.on("error", (error) => fail(`Signed Helper could not start: ${error.message}`));
child.on("exit", (code, signal) => {
  if (!settled) fail(`Signed Helper exited before hello: ${code ?? "null"}/${signal ?? "none"}`);
});
timeout = setTimeout(() => fail("Signed Helper hello timed out"), 10_000);
timeout.unref();
child.stdin.end(frame);
NODE
  printf '%s\n' "macOS Helper signature verification passed."
  exit 0
fi

[ "$mode" = "dmg" ] || die "unknown signing mode"
[ -n "$keychain_profile" ] || die "--keychain-profile is required for notarization"

temp_base="${TMPDIR:-/tmp}"
temp_base="${temp_base%/}"
mount_root="$(mktemp -d "$temp_base/capture-for-tolaria-dmg-verify.XXXXXX")"
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

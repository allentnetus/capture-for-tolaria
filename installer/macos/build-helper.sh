#!/usr/bin/env bash

set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
output_dir="$repo_root/release"
requested_arch=""
node_binary="${NODE_BINARY:-}"

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
    *)
      die "unknown option: $1"
      ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || die "SEA Helper build requires macOS"
machine_arch="$(uname -m)"
case "$machine_arch" in
  arm64)
    arch_label="arm64"
    ;;
  x86_64)
    arch_label="x64"
    ;;
  *)
    die "unsupported macOS architecture: $machine_arch"
    ;;
esac
[ -z "$requested_arch" ] || [ "$requested_arch" = "$arch_label" ] || die "requested architecture does not match this runner"

version_path="$repo_root/VERSION"
[ -f "$version_path" ] || die "VERSION is missing"
version="$(tr -d '\r\n' < "$version_path")"
printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-(alpha|beta)\.[0-9]+$' || die "VERSION is invalid"

if [ -z "$node_binary" ]; then
  node_binary="$(command -v node || true)"
fi
[ -n "$node_binary" ] || die "Node.js is required on the build runner"
[ -x "$node_binary" ] || die "Node.js binary is not executable"

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd -P)"
build_root="$(mktemp -d "$output_dir/.capture-for-tolaria-sea-$arch_label.XXXXXX")"
blob_path="$build_root/sea-prep.blob"
sea_config_path="$build_root/sea-config.json"
output_name="capture-for-tolaria-helper-$version-macos-$arch_label"
output_path="$output_dir/$output_name"
helper_entry="$repo_root/apps/helper/dist/sea-entry.cjs"
sentinel="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

cleanup() {
  rm -rf "$build_root"
}
trap cleanup EXIT

(
  cd "$repo_root"
  pnpm --filter @capture-for-tolaria/helper build
)

[ -f "$helper_entry" ] || die "Helper SEA entry was not built"
"$node_binary" -e '
  const fs = require("node:fs");
  const [main, output, target] = process.argv.slice(1);
  fs.writeFileSync(target, JSON.stringify({
    main,
    output,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false
  }));
' "$helper_entry" "$blob_path" "$sea_config_path"

"$node_binary" --experimental-sea-config "$sea_config_path"
[ -f "$blob_path" ] || die "SEA preparation blob was not produced"

rm -f "$output_path"
cp "$node_binary" "$output_path"
codesign --remove-signature "$output_path" >/dev/null 2>&1 || true
(
  cd "$repo_root"
  pnpm exec postject "$output_path" NODE_SEA_BLOB "$blob_path" \
    --sentinel-fuse "$sentinel" \
    --macho-segment-name NODE_SEA
)
chmod 755 "$output_path"

[ -x "$output_path" ] || die "SEA Helper is not executable"
CAPTURE_HELPER_VERSION="$version" "$node_binary" - "$output_path" <<'NODE'
const { spawn } = require("node:child_process");

const helperPath = process.argv.at(-1);
const request = {
  protocolVersion: 1,
  requestId: "sea-build-hello",
  extensionVersion: process.env.CAPTURE_HELPER_VERSION || "0.1.0-beta.7",
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

function fail(message) {
  if (settled) return;
  settled = true;
  child.kill();
  throw new Error(message);
}

child.stderr.on("data", (chunk) => {
  diagnostics += chunk.toString("utf8");
});
child.stdout.on("data", (chunk) => {
  output = Buffer.concat([output, chunk]);
  if (output.length < 4) return;
  const length = output.readUInt32LE(0);
  if (output.length < length + 4) return;
  const response = JSON.parse(output.subarray(4, length + 4).toString("utf8"));
  if (response.protocolVersion !== 1 || response.requestId !== "sea-build-hello") {
    fail("SEA Helper hello response is invalid");
  }
  settled = true;
  child.kill();
});
child.on("error", (error) => {
  if (!settled) {
    throw error;
  }
});
child.on("exit", (code) => {
  if (!settled && code !== 0) {
    throw new Error(`SEA Helper exited before hello: ${code}; ${diagnostics}`);
  }
});
const timeout = setTimeout(() => {
  if (!settled) fail("SEA Helper hello timed out");
}, 10_000);
timeout.unref();
child.stdin.end(frame);
NODE

printf '%s\n' "macOS SEA Helper built and hello verification passed."
printf '%s\n' "$output_path"

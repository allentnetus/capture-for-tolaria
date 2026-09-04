#!/usr/bin/env bash

set -euo pipefail
umask 077

readonly HOST_NAME="com.capture_for_tolaria.helper"
readonly EXTENSION_ID="ncjeeembmcgkfjipkfhganbdnadbhdcl"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
readonly PACKAGE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
readonly TEMPLATE_PATH="$SCRIPT_DIR/native-host-manifest.json.in"
readonly VERSION_PATH="$PACKAGE_ROOT/VERSION"

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

if [ ! -f "$VERSION_PATH" ]; then
  die "VERSION is missing from the Installer package"
fi
version="$(tr -d '\r\n' < "$VERSION_PATH")"
if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-(alpha|beta)\.[0-9]+$'; then
  die "VERSION is invalid"
fi

if [ -z "${HOME:-}" ] || [ "${HOME#/}" = "$HOME" ] || [ "$HOME" = "/" ]; then
  die "HOME must be an absolute current-user directory"
fi
if [ "$(uname -s)" != "Darwin" ]; then
  die "this Installer supports macOS only"
fi

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

application_data="$HOME/Library/Application Support/CaptureForTolaria"
config_path="$application_data/config.json"
install_root="$application_data/Helper"
helper_target="$install_root/capture-for-tolaria-helper"
extension_source="$PACKAGE_ROOT/extension"
extension_target="$application_data/extension"
host_directory="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
manifest_target="$host_directory/$HOST_NAME.json"
helper_source="$PACKAGE_ROOT/capture-for-tolaria-helper-$version-macos-$arch_label"
helper_temp="$install_root/.capture-for-tolaria-helper.tmp.$$"
manifest_temp="$host_directory/.$HOST_NAME.json.tmp.$$"

assert_no_symlink_components() {
  path_to_check="$1"
  case "$path_to_check" in
    /*)
      ;;
    *)
      die "path must be absolute"
      ;;
  esac

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
    case "$segment" in
      .|..)
        die "path contains a traversal component"
        ;;
    esac
    if [ "$current" = "/" ]; then
      current="/$segment"
    else
      current="$current/$segment"
    fi
    if [ -L "$current" ]; then
      die "path contains a symlink"
    fi
  done
}

cleanup() {
  [ -z "${helper_temp:-}" ] || rm -f "$helper_temp"
  [ -z "${manifest_temp:-}" ] || rm -f "$manifest_temp"
}
trap cleanup EXIT

[ -f "$helper_source" ] || die "matching architecture Helper is missing from the Installer package"
[ -L "$helper_source" ] && die "Helper source must not be a symlink"
[ -d "$extension_source" ] || die "Extension is missing from the Installer package"
[ -L "$extension_source" ] && die "Extension source must not be a symlink"
[ -f "$TEMPLATE_PATH" ] || die "Native Host manifest template is missing"
grep -F '"name": "__HOST_NAME__"' "$TEMPLATE_PATH" >/dev/null || die "Native Host template contract is invalid"
grep -F '"path": "__HELPER_PATH__"' "$TEMPLATE_PATH" >/dev/null || die "Native Host template contract is invalid"
grep -F '"allowed_origins": ["chrome-extension://__EXTENSION_ID__/"]' "$TEMPLATE_PATH" >/dev/null || die "Native Host template contract is invalid"

assert_no_symlink_components "$HOME"
assert_no_symlink_components "$application_data"
assert_no_symlink_components "$install_root"
assert_no_symlink_components "$extension_source"
assert_no_symlink_components "$extension_target"
assert_no_symlink_components "$host_directory"
assert_no_symlink_components "$config_path"
assert_no_symlink_components "$manifest_target"

if find "$extension_source" -type l -print -quit | grep -q .; then
  die "Extension source must not contain symlinks"
fi
if [ -e "$extension_target" ] || [ -L "$extension_target" ]; then
  [ ! -L "$extension_target" ] || die "installed Extension directory must not be a symlink"
  [ -d "$extension_target" ] || die "installed Extension path is not a directory"
  if find "$extension_target" -type l -print -quit | grep -q .; then
    die "installed Extension directory must not contain symlinks"
  fi
fi

if [ -e "$helper_target" ] || [ -L "$helper_target" ]; then
  [ ! -L "$helper_target" ] || die "installed Helper must not be a symlink"
  [ -f "$helper_target" ] || die "installed Helper path is not a regular file"
fi
if [ -e "$manifest_target" ] || [ -L "$manifest_target" ]; then
  [ ! -L "$manifest_target" ] || die "Native Host manifest must not be a symlink"
  [ -f "$manifest_target" ] || die "Native Host manifest path is not a regular file"
fi

mkdir -p "$install_root" "$extension_target" "$host_directory"
[ ! -L "$install_root" ] || die "install root must not be a symlink"
[ ! -L "$extension_target" ] || die "installed Extension directory must not be a symlink"
[ ! -L "$host_directory" ] || die "Native Host directory must not be a symlink"
if [ -e "$extension_target" ] || [ -L "$extension_target" ]; then
  if find "$extension_target" -type l -print -quit | grep -q .; then
    die "installed Extension directory must not contain symlinks"
  fi
fi
if [ -e "$helper_temp" ] || [ -L "$helper_temp" ]; then
  die "temporary Helper path already exists"
fi
if [ -e "$manifest_temp" ] || [ -L "$manifest_temp" ]; then
  die "temporary manifest path already exists"
fi

cp -R "$extension_source"/. "$extension_target"/
[ ! -L "$extension_target" ] || die "installed Extension directory must not be a symlink"
if find "$extension_target" -type l -print -quit | grep -q .; then
  die "installed Extension directory must not contain symlinks"
fi

cp "$helper_source" "$helper_temp"
chmod 755 "$helper_temp"
mv -f "$helper_temp" "$helper_target"

json_helper_path="$(printf '%s' "$helper_target" | sed 's/\\/\\\\/g; s/"/\\\"/g')"
cat > "$manifest_temp" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Capture for Tolaria Native Messaging Helper",
  "path": "$json_helper_path",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF
chmod 600 "$manifest_temp"
mv -f "$manifest_temp" "$manifest_target"

printf '%s\n' "Capture for Tolaria macOS installation completed."

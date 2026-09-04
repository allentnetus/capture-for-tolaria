#!/usr/bin/env bash

set -euo pipefail
umask 077

die() {
  printf 'Capture for Tolaria: %s\n' "$1" >&2
  exit 1
}

if [ "$(uname -s)" != "Darwin" ]; then
  die "this Installer supports macOS only"
fi
if [ -z "${HOME:-}" ] || [ "${HOME#/}" = "$HOME" ] || [ "$HOME" = "/" ]; then
  die "HOME must be an absolute current-user directory"
fi

clear_config="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --clear-config)
      clear_config="true"
      shift
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

application_data="$HOME/Library/Application Support/CaptureForTolaria"
config_path="$application_data/config.json"
install_root="$application_data/Helper"
extension_target="$application_data/extension"
helper_target="$install_root/capture-for-tolaria-helper"
host_directory="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
manifest_target="$host_directory/com.capture_for_tolaria.helper.json"

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

assert_no_symlink_components "$HOME"
assert_no_symlink_components "$application_data"
assert_no_symlink_components "$config_path"
assert_no_symlink_components "$install_root"
assert_no_symlink_components "$helper_target"
assert_no_symlink_components "$extension_target"
assert_no_symlink_components "$host_directory"
assert_no_symlink_components "$manifest_target"

if [ -L "$install_root" ]; then
  die "install root must not be a symlink"
fi
if [ -e "$install_root" ] && [ ! -d "$install_root" ]; then
  die "install root is not a directory"
fi

if [ -d "$install_root" ]; then
  if [ -L "$helper_target" ]; then
    die "installed Helper must not be a symlink"
  fi
  if [ -e "$helper_target" ]; then
    [ -f "$helper_target" ] || die "installed Helper is not a regular file"
    rm -f "$helper_target"
  fi

  for remaining_entry in "$install_root"/* "$install_root"/.[!.]* "$install_root"/..?*; do
    [ -e "$remaining_entry" ] || [ -L "$remaining_entry" ] || continue
    die "refusing to remove unexpected installation file"
  done
  rmdir "$install_root"
fi

if [ -L "$extension_target" ]; then
  die "installed Extension directory must not be a symlink"
fi
if [ -e "$extension_target" ]; then
  [ -d "$extension_target" ] || die "installed Extension path is not a directory"
  if find "$extension_target" -type l -print -quit | grep -q .; then
    die "installed Extension directory must not contain symlinks"
  fi
  rm -rf "$extension_target"
fi

if [ -L "$manifest_target" ]; then
  die "Native Host manifest must not be a symlink"
fi
if [ -e "$manifest_target" ]; then
  [ -f "$manifest_target" ] || die "Native Host manifest is not a regular file"
  rm -f "$manifest_target"
fi

if [ "$clear_config" = "true" ] && [ -e "$config_path" ]; then
  [ ! -L "$config_path" ] || die "config file must not be a symlink"
  [ -f "$config_path" ] || die "config path is not a regular file"
  rm -f "$config_path"
fi

printf '%s\n' "Capture for Tolaria macOS installation removal completed."

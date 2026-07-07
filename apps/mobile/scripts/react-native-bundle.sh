#!/bin/sh

set -eu

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(dirname "$script_dir")"

case "${RABBY_MOBILE_METRO_USE_CACHE:-false}" in
  true|1|yes|on)
    echo "[metro-bundle] reuse Metro cache"
    exec "$project_dir/node_modules/.bin/react-native" bundle "$@"
    ;;
  *)
    echo "[metro-bundle] reset Metro cache"
    exec "$project_dir/node_modules/.bin/react-native" bundle --reset-cache "$@"
    ;;
esac

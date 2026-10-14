#!/usr/bin/env bash
# Build and publish the web app to the nginx server.
#
# On the server itself (repo cloned there):
#   npm run deploy -- --local                 build here, switch to the new release
#   npm run deploy -- --local --rollback      switch back to the previous release
#
# From another machine (over SSH):
#   DEPLOY_HOST=ubuntu@<server> npm run deploy
#   DEPLOY_HOST=ubuntu@<server> npm run deploy -- --rollback
#
# Optional: DEPLOY_PATH (default /var/www/junction-app), DEPLOY_SSH_KEY (path to a private key),
# KEEP_RELEASES (default 5).
#
# Each deploy goes to <DEPLOY_PATH>/releases/<timestamp>; nginx serves <DEPLOY_PATH>/current, a
# symlink this script switches, so a deploy or rollback is instant and needs no nginx reload.
set -euo pipefail

LOCAL=0
ROLLBACK=0
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL=1 ;;
    --rollback) ROLLBACK=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

DEPLOY_PATH="${DEPLOY_PATH:-/var/www/junction-app}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SSH_OPTS=()
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then SSH_OPTS=(-i "$DEPLOY_SSH_KEY"); fi
if [[ "$LOCAL" == 0 ]]; then
  : "${DEPLOY_HOST:?Set DEPLOY_HOST (e.g. DEPLOY_HOST=ubuntu@1.2.3.4), or run on the server with --local}"
fi

# Runs a command on the server: directly with --local, over SSH otherwise.
remote() {
  if [[ "$LOCAL" == 1 ]]; then bash -c "$*"; else ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" "$@"; fi
}

if [[ "$ROLLBACK" == 1 ]]; then
  remote "set -e
    cd '$DEPLOY_PATH'
    current=\$(readlink current | xargs basename)
    previous=\$(ls -1 releases | sort | grep -B1 -x \"\$current\" | head -n1)
    if [[ -z \"\$previous\" || \"\$previous\" == \"\$current\" ]]; then echo 'No earlier release to roll back to.'; exit 1; fi
    ln -sfn \"releases/\$previous\" current
    echo \"Rolled back: \$current -> \$previous\""
  exit 0
fi

cd "$(dirname "$0")/.."
release="$(date -u +%Y%m%d%H%M%S)"
archive="$(mktemp -t junction-app-XXXXXX).tgz"

echo "Building..."
npm run build
tar -C dist -czf "$archive" .

if [[ "$LOCAL" == 1 ]]; then
  echo "Publishing release $release to $DEPLOY_PATH..."
  cp "$archive" "/tmp/junction-app-$release.tgz"
else
  echo "Uploading release $release to $DEPLOY_HOST:$DEPLOY_PATH..."
  scp "${SSH_OPTS[@]}" "$archive" "$DEPLOY_HOST:/tmp/junction-app-$release.tgz"
fi
remote "set -e
  mkdir -p '$DEPLOY_PATH/releases/$release'
  tar -xzf '/tmp/junction-app-$release.tgz' -C '$DEPLOY_PATH/releases/$release'
  rm -f '/tmp/junction-app-$release.tgz'
  test -f '$DEPLOY_PATH/releases/$release/index.html'
  ln -sfn 'releases/$release' '$DEPLOY_PATH/current'
  cd '$DEPLOY_PATH/releases' && ls -1 | sort | head -n -$KEEP_RELEASES | xargs -r rm -rf"
rm -f "$archive"

if [[ "$LOCAL" == 1 ]]; then
  echo "Live: release $release. Roll back with: npm run deploy -- --local --rollback"
else
  echo "Live: release $release. Roll back with: DEPLOY_HOST=$DEPLOY_HOST npm run deploy -- --rollback"
fi

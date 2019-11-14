#!/usr/bin/env bash
set -o errexit -o nounset -o pipefail
repo="$( cd "$( dirname "$0" )" && pwd )"

function main {
  pushd "$repo/client"
  npm install
  DOMAIN_NAME="prod.discord.rce.fi" \
  npx webpack-dev-server --env local
  popd
}

main "$@"

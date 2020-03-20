#!/usr/bin/env bash
set -o nounset -o errexit -o pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function fail {
  echo "$@" >&2
  exit 1
}

function command_exists {
  command -v "$@" >/dev/null 2>&1
}

[ -z "${DOMAIN_NAME:-}" ] && fail "DOMAIN_NAME should be set"
if [ -z "${AWS_PROFILE:-}" ]; then
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    fail "AWS_PROFILE (or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) should be set"
  fi
fi
[ -z "${AWS_REGION:-}" ] && fail "AWS_REGION should be set"
export AWS_DEFAULT_REGION=$AWS_REGION

command_exists npm || fail "npm is not installed"
command_exists aws || fail "aws is not installed"

aws sts get-caller-identity &>/dev/null || {
  fail "Failed to get AWS caller identity. Is AWS profile $AWS_PROFILE valid?"
}

export ENV="prod"
cd "$repo/deploy"
npm ci
npx cdk bootstrap
npx cdk deploy

cd "$repo/client"
npm ci
npx webpack --env production
cd "$repo/client/dist"
aws s3 sync . s3://radiator.$ENV.discord.rce.fi/

# Invalidate caches
cd "$repo/deploy"
npx ts-node bin/cloudfront-invalidation.ts

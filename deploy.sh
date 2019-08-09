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
[ -z "${AWS_PROFILE:-}" ] && fail "AWS_PROFILE should be set"
[ -z "${AWS_REGION:-}" ] && fail "AWS_REGION should be set"
export AWS_DEFAULT_REGION=$AWS_REGION

command_exists npm || fail "npm is not installed"
command_exists aws || fail "aws is not installed"

aws sts get-caller-identity &>/dev/null || {
  fail "Failed to get AWS caller identity. Is AWS profile $AWS_PROFILE valid?"
}

cd "$repo/deploy"
npm install

# Create and validate certificate "manually"
npx ts-node bin/certificate.ts

# Build rest of the infra with CDK
npm run build
npm run cdk bootstrap
npm run cdk deploy

cd "$repo/client"
npm install
npm run build
cd "$repo/client/dist"
aws s3 sync . s3://radiator.prod.discord.rce.fi/

# Invalidate caches
cd "$repo/deploy"
npx ts-node bin/cloudfront-invalidation.ts

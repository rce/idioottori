#!/usr/bin/env bash
set -o nounset -o errexit -o pipefail -o xtrace
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export AWS_PROFILE="discord-prod"
export AWS_REGION="eu-west-1"

cd "$repo/deploy"
npm install
npm run build
npm run cdk bootstrap
npm run cdk deploy

cd "$repo/client"
npm install
npm run build
cd "$repo/client/dist"
aws s3 sync . s3://radiator.prod.discord.rce.fi/

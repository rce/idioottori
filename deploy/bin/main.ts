#!/usr/bin/env node
import 'source-map-support/register';
import { ACM, Route53 } from "aws-sdk"
import { findCertificate } from "../lib/aws"
import cdk = require('@aws-cdk/core');
import { RadiatorStack } from '../lib/radiator-stack';

async function main() {
  if (!process.env.ENV) throw Error("FATAL !process.env.ENV")

  const app = new cdk.App();
  new RadiatorStack(app, 'Radiator', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  });
}

main()

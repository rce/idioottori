#!/usr/bin/env node
import 'source-map-support/register';
import { ACM, Route53 } from "aws-sdk"
import { findCertificate } from "../lib/aws"
import cdk = require('@aws-cdk/core');
import { RadiatorStack } from '../lib/radiator-stack';

const route53 = new Route53({
  apiVersion: "2013-04-01",
})

const acm = new ACM({
  apiVersion: "2015-12-08",
  region: "us-east-1",
})

async function main() {
  if (!process.env.DOMAIN_NAME) throw Error("FATAL !process.env.DOMAIN_NAME")
  const domainName = process.env.DOMAIN_NAME

  const cert = await findCertificate(`radiator.${domainName}`)
  if (!cert) throw Error("FATAL !cert")
  if (!cert.CertificateArn) throw Error("FATAL !cert.CertificateArn")

  const app = new cdk.App();
  new RadiatorStack(app, 'Radiator', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    domainName,
    certificateArn: cert.CertificateArn,
  });
}

main()

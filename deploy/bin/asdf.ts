#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AsdfStack } from '../lib/asdf-stack';

const app = new cdk.App();
new AsdfStack(app, 'AsdfStack');

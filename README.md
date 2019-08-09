# idioottori

Demo: https://radiator.prod.discord.rce.fi/

## Deployment

The following command will deploy the radiator to AWS region `eu-west-1` using
AWS profile/account `some-aws-profile`. The radiator will be accessible at
`radiator.example.com`. The AWS account must have Route 53 hosted zone for
`example.com`.

```sh
AWS_PROFILE=some-aws-profile \
AWS_REGION=eu-west-1 \
DOMAIN_NAME=example.com \
./deploy.sh
```

The deployment script will notify you on missing dependencies

## Dependencies

- AWS account with enough permissions
- Route 53 hosted zone for `DOMAIN_NAME`
- npm
- awscli

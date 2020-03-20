# idioottori

Demo: https://radiator.prod.discord.rce.fi/

## Deployment

The demo is deployed with the following command

```sh
ENV=prod \
AWS_PROFILE=discord-prod \
AWS_REGION=eu-west-1 \
bash ./deploy.sh
```

The deployment script will notify you on missing dependencies

## Dependencies

- AWS account with enough permissions
- npm
- awscli

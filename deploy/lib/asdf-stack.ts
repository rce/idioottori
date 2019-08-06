import cdk = require("@aws-cdk/core")
import lambda = require("@aws-cdk/aws-lambda")
import iam = require("@aws-cdk/aws-iam")
import apigateway = require("@aws-cdk/aws-apigateway")
import certificatemanager = require("@aws-cdk/aws-certificatemanager")
import s3 = require("@aws-cdk/aws-s3")
import cloudfront = require("@aws-cdk/aws-cloudfront")
import route53 = require("@aws-cdk/aws-route53")

export class AsdfStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const DOMAIN_NAME = "radiator.prod.discord.rce.fi"

    const originAccessIdentity = new cloudfront.CfnCloudFrontOriginAccessIdentity(this, "OriginAccessIdentity", {
      cloudFrontOriginAccessIdentityConfig: {
        comment: "CloudFront Origin Access Identity for S3",
      },
    })

    const bucket = new s3.Bucket(this, "ClientBucket", {
      bucketName: DOMAIN_NAME,
    })

    // Allow CloudFront origin access identity to read from bucket
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.CanonicalUserPrincipal(originAccessIdentity.attrS3CanonicalUserId)],
      actions: ["s3:GetObject"],
      resources: [bucket.arnForObjects("*")],
    }))

    const serverLambda = new lambda.Function(this, "ServerFunction", {
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "server.handler",
      code: lambda.Code.asset("../server"),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "cloudwatch:DescribeAlarms",
            "cloudwatch:GetMetricWidgetImage",
            "cloudwatch:ListMetrics",
          ],
          resources: ["*"],
        }),
      ],
    })

    // Lambda integration: https://github.com/aws/aws-cdk/blob/v1.3.0/packages/@aws-cdk/aws-apigateway/lib/lambda-api.ts#L44
    // Binary content handling: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-workflow.html
    const api = new apigateway.RestApi(this, "widget-api", {
      deployOptions: {
        stageName: "api",
      },
      binaryMediaTypes: ["*/*"],
      defaultIntegration: new apigateway.LambdaIntegration(serverLambda, {
        // contentHandling: apigateway.ContentHandling.CONVERT_TO_BINARY,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      }),
    })

    // /alarms
    const alarms = api.root.addResource("alarms")
    alarms.addMethod("GET")
    alarms.addMethod("OPTIONS")

    // /metrics
    const metrics = api.root.addResource("metrics")
    metrics.addMethod("GET")
    metrics.addMethod("OPTIONS")

    // /widgets?metric=foobar
    const widget = metrics.addResource("widget")
    widget.addMethod("GET")
    widget.addMethod("OPTIONS")

    new cloudfront.CloudFrontWebDistribution(this, "CloudFront", {
      // TODO: domain
      //aliasConfiguration: {
      //  names: [DOMAIN_NAME],
      //  acmCertRef: cert.certificateArn,
      //},
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentityId: originAccessIdentity.ref,
          },
          behaviors: [{
            isDefaultBehavior: true,
            allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
            minTtl: cdk.Duration.minutes(0),
            maxTtl: cdk.Duration.minutes(15),
          }],
        },
        {
          customOriginSource: {
            domainName: "qx9hbpcjfh.execute-api.eu-west-1.amazonaws.com",
            //domainName: api.url,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          },
          behaviors: [{
            pathPattern: "/api/*",
            minTtl: cdk.Duration.minutes(0),
            maxTtl: cdk.Duration.minutes(0),
            allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
            forwardedValues: {
              queryString: true,
            },
          }],
        },
      ],
    })
  }
}

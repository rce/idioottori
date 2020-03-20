import cdk = require("@aws-cdk/core")
import lambda = require("@aws-cdk/aws-lambda")
import iam = require("@aws-cdk/aws-iam")
import apigateway = require("@aws-cdk/aws-apigateway")
import certificatemanager = require("@aws-cdk/aws-certificatemanager")
import s3 = require("@aws-cdk/aws-s3")
import cloudfront = require("@aws-cdk/aws-cloudfront")
import route53 = require("@aws-cdk/aws-route53")
import route53targets = require("@aws-cdk/aws-route53-targets")

export class RadiatorStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const env = process.env.ENV!
    const zoneName = `${env}.discord.rce.fi`
    const radiatorDomain = `radiator.${zoneName}`

    const hostedZone = new route53.HostedZone(this, "HostedZone", { zoneName })
    const certificate = new certificatemanager.DnsValidatedCertificate(this, "Certificate", {
      hostedZone,
      domainName: radiatorDomain,
      region: "us-east-1", // CloudFront requires certificate in us-east-1 region
    })

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, "OriginAccessIdentity")

    const bucket = new s3.Bucket(this, `ClientBucket`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      bucketName: radiatorDomain,
    })

    // Allow CloudFront origin access identity to read from bucket
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [originAccessIdentity.grantPrincipal],
      actions: ["s3:GetObject"],
      resources: [bucket.arnForObjects("*")],
    }))

    const serverLambda = new lambda.Function(this, "BackendFunction", {
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "server.handler",
      code: lambda.Code.fromAsset("../server"),
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
    const api = new apigateway.RestApi(this, "BackendAPI", {
      deployOptions: {
        stageName: "api",
      },
      binaryMediaTypes: ["*/*"],
      defaultIntegration: new apigateway.LambdaIntegration(serverLambda, {
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

    const distribution = new cloudfront.CloudFrontWebDistribution(this, "CloudFrontDistribution", {
      aliasConfiguration: {
        names: [radiatorDomain],
        acmCertRef: certificate.certificateArn,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentity,
          },
          behaviors: [{
            isDefaultBehavior: true,
            allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
          }],
        },
        {
          customOriginSource: {
            domainName: apiDomain(api),
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          },
          behaviors: [{
            pathPattern: "/api/*",
            minTtl: cdk.Duration.minutes(0),
            defaultTtl: cdk.Duration.minutes(0),
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


    new route53.ARecord(this, "CloudFrontDnsARecord", {
      zone: hostedZone,
      recordName: radiatorDomain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution)
      ),
    })
  }
}

function apiDomain(api: apigateway.RestApi): string {
  return `${api.restApiId}.execute-api.${cdk.Stack.of(api).region}.${cdk.Stack.of(api).urlSuffix}`
}

import cdk = require("@aws-cdk/core")
import lambda = require("@aws-cdk/aws-lambda")
import iam = require("@aws-cdk/aws-iam")
import apigateway = require("@aws-cdk/aws-apigateway")
import certificatemanager = require("@aws-cdk/aws-certificatemanager")
import s3 = require("@aws-cdk/aws-s3")
import cloudfront = require("@aws-cdk/aws-cloudfront")
import route53 = require("@aws-cdk/aws-route53")
import route53targets = require("@aws-cdk/aws-route53-targets")

export interface RadiatorStackProps extends cdk.StackProps {
  certificateArn: string
  domainName: string
}

export class RadiatorStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RadiatorStackProps) {
    super(scope, id, props);

    const {domainName, certificateArn} = props
    const radiatorDomain = `radiator.${domainName}`

    // Hosted zone and certificate have been created outside CloudFormation
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", { domainName })
    const certificate = certificatemanager.Certificate.fromCertificateArn(this, "Certificate", certificateArn)

    const originAccessIdentity = new cloudfront.CfnCloudFrontOriginAccessIdentity(this, "CloudFrontS3OriginAccessIdentity", {
      cloudFrontOriginAccessIdentityConfig: {
        comment: "CloudFront Origin Access Identity for S3",
      },
    })

    const bucket = new s3.Bucket(this, `ClientBucket`, {
      bucketName: radiatorDomain,
    })

    // Allow CloudFront origin access identity to read from bucket
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.CanonicalUserPrincipal(originAccessIdentity.attrS3CanonicalUserId)],
      actions: ["s3:GetObject"],
      resources: [bucket.arnForObjects("*")],
    }))

    const serverLambda = new lambda.Function(this, "BackendFunction", {
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
            originAccessIdentityId: originAccessIdentity.ref,
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
      target: route53.AddressRecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution)
      ),
    })
  }
}

function apiDomain(api: apigateway.RestApi): string {
  return `${api.restApiId}.execute-api.${cdk.Stack.of(api).region}.${cdk.Stack.of(api).urlSuffix}`
}

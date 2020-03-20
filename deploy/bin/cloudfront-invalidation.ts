import { CloudFront } from "aws-sdk"

const cloudfront = new CloudFront({
  apiVersion: "2019-03-26",
})

const pathsToInvalidate = ["/", "/index.html"]

async function main() {
  const domainName = process.env.DOMAIN_NAME
  if (!domainName) throw new Error("Environment variable 'DOMAIN_NAME' is missing")

  const subdomain = `radiator.${domainName}`

  const response = await cloudfront.listDistributions().promise()
  if (!response.DistributionList) throw new Error("FATAL !response.DistributionList")
  if (!response.DistributionList.Items) throw new Error("FATAL !response.DistributionList.Items")

  const distribution = response.DistributionList.Items.find(hasAlias(subdomain))
  if (!distribution) throw new Error("FATAL !distribution")

  console.log("Invalidating CloudFront cache to update static assets")
  const invalidation = await cloudfront.createInvalidation({
    DistributionId: distribution.Id,
    InvalidationBatch: {
      CallerReference: "deployment" + Date.now(),
      Paths: {
        Quantity: pathsToInvalidate.length,
        Items: pathsToInvalidate,
      },
    },
  }).promise()
  if (!invalidation.Invalidation) throw new Error("FATAL !invalidation.Invalidation")

  await cloudfront.waitFor("invalidationCompleted", {
    DistributionId: distribution.Id,
    Id: invalidation.Invalidation.Id,
  }).promise()
  console.log("CloudFront cache invalidated")
}

const hasAlias = (alias: string) => (distribution: CloudFront.DistributionSummary): boolean => {
  const aliases = distribution.Aliases.Items || []
  return aliases.includes(alias)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

import { Route53, ACM } from "aws-sdk"

export const route53 = new Route53({
  apiVersion: "2013-04-01",
})

export const acm = new ACM({
  apiVersion: "2015-12-08",
  region: "us-east-1",
})


export async function findCertificate(domainName: string): Promise<ACM.CertificateSummary | undefined> {
  const response = await acm.listCertificates().promise()
  if (!response.CertificateSummaryList) {
    return undefined
  }
  return response.CertificateSummaryList.find(_ => _.DomainName === domainName)
}

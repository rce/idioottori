import { Route53, ACM } from "aws-sdk"
import { acm, route53, findCertificate } from "../lib/aws"

async function main() {
  const domainName = process.env.DOMAIN_NAME
  if (!domainName) throw new Error("Environment variable 'DOMAIN_NAME' is missing")

  const subdomain = `radiator.${domainName}`

  const hostedZone = await findHostedZone(domainName)

  console.log(`Checking exisitng certificate for subdomain '${subdomain}'`)
  const certOpt = await findCertificate(subdomain)

  if (certOpt) {
    await validateCert(hostedZone, certOpt)
  } else {
    console.log(`Requesting a certificate for subdomain '${subdomain}'`)
    const cert = await requestCertificate(subdomain)
    await validateCert(hostedZone, cert)
  }
}

async function requestCertificate(domainName: string): Promise<ACM.CertificateSummary> {
  const mkToken = (n: number) => domainName.replace(/[^\w]/g, "") + "_token_" + n
  await acm.requestCertificate({
    DomainName: domainName,
    ValidationMethod: "DNS",
    IdempotencyToken: mkToken(1)
  }).promise()

  // FIXME: First run fails because it takes a moment for cert to become available
  const cert = await findCertificate(domainName)
  if (!cert) throw new Error("Certificate not found even though it was just requested")
  return cert
}

async function validateCert(hostedZone: Route53.HostedZone, certificate: ACM.CertificateSummary): Promise<void> {
  console.log(`Validating certificate for domain ${certificate.DomainName}`)
  if (!certificate.CertificateArn) throw new Error("FATAL Certificate does not have ARN")

  const response = await acm.describeCertificate({ CertificateArn: certificate.CertificateArn }).promise()
  if (!response.Certificate) throw new Error("FATAL Certificate not returned from API")
  if (!response.Certificate.DomainValidationOptions) throw new Error("FATAL Certificate does not have DomainValidationOptions")

  const dnsValidation = response.Certificate.DomainValidationOptions.find(_ => _.ValidationMethod === "DNS")
  if (!dnsValidation) throw new Error("FATAL Certificate does not have DomainValidationOptions with ValidationMethod DNS")

  if (dnsValidation.ValidationStatus === "FAILED") {
    throw new Error("FATAL Certificate validation fiaed")
  }

  if (dnsValidation.ValidationStatus === "SUCCESS") {
    console.log("Certificate is already validated")
    return
  }

  console.log("Configuring Route53 with DNS record for validation")
  await route53.changeResourceRecordSets({
    HostedZoneId: hostedZone.Id,
    ChangeBatch: {
      Changes: [dnsValidationToChange(dnsValidation)]
    }
  }).promise()

  console.log("Waiting for certificate to validate")
  await acm.waitFor("certificateValidated", { CertificateArn: certificate.CertificateArn }).promise()
}

function dnsValidationToChange(dnsValidation: ACM.DomainValidation): Route53.Change {
  if (!dnsValidation.ResourceRecord) throw new Error("FATAL !DomainValidationOptions.ValidationMethod.ResourceRecord")

  const {Name, Type, Value} = dnsValidation.ResourceRecord
  return {
    Action: "UPSERT",
    ResourceRecordSet: {
      Name,
      Type,
      TTL: 60,
      ResourceRecords: [{ Value }],
    },
  }
}


async function findHostedZone(domainName: string): Promise<Route53.HostedZone> {
  const response = await route53.listHostedZones().promise()
  const zone = response.HostedZones.find(_ => _.Name === `${domainName}.`)
  if (!zone) throw new Error(`Hosted zone for domain '${domainName}' is missing`)
  return zone
}


main().catch(err => {
  console.error(err)
  process.exit(1)
})

const AWS = require("aws-sdk")

const CloudWatch = new AWS.CloudWatch()

exports.handler = async event => {
  console.log(JSON.stringify(event, null, 2))

  try {
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(200, {})
    }

    if (event.resource === "/metrics/widget") {
      return await getWidget(event)
    } else if (event.resource === "/metrics") {
      return listMetrics()
    } else if (event.resource === "/alarms") {
      return describeAlarms()
    } else {
      return jsonResponse(404, { error: "Not Found" })
    }
  } catch (e) {
    console.log(e.stack)
    return jsonResponse(500, { error: "Internal Server Error" })
  }
}

async function describeAlarms() {
  const response = await CloudWatch.describeAlarms().promise()
  return jsonResponse(200, response.MetricAlarms)
}

async function listMetrics() {
  const startsWith = (prefix, s) => s.indexOf(prefix) === 0
  const isCustomMetric = m => !startsWith("AWS/", m.Namespace)

  const response = await CloudWatch.listMetrics().promise()
  const customMetrics = response.Metrics.filter(isCustomMetric)
  return jsonResponse(200, customMetrics)
}

async function getWidget(event) {
  const q = event.queryStringParameters
  if (!q.namespace || !q.metric) {
    return jsonResponse(403, { error: "Bad Request" })
  }

  const metric = [q.namespace, q.metric]

  const widgetDefinition = {
    metrics: [metric],
    width: 600,
    height: 400,
    yAxis: {
      left: { min: 0 },
    },
    period: 3600,
    start: "-PT48H",
    legend: { position: "hidden" },
    stat: "Average",
  }

  const widget = await CloudWatch.getMetricWidgetImage({
    MetricWidget: JSON.stringify(widgetDefinition),
  }).promise()

  return pngResponse(200, widget.MetricWidgetImage)
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
}

function pngResponse(statusCode, buffer) {
  return {
    statusCode,
    headers: {
      "Content-Type": "image/png",
      ...corsHeaders,
    },
    isBase64Encoded: true,
    body: buffer.toString("base64"),
  }
}

function jsonResponse(statusCode, json) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
    body: JSON.stringify(json, null, 2),
  }
}

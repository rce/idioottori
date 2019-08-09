const React = require("karet")
const Kefir = require("kefir")
const {render} = require("react-dom")
const U = require("karet.util")

const REFRESH_INTERVAL = 60 * 1000

require("./style.css")

const App = () => {
  return (
    <React.Fragment>
      <AlarmList />
      <MetricList />
    </React.Fragment>
  )
}

const MetricList = () => {
  const metrics = refreshMs(REFRESH_INTERVAL)
    .flatMap(() => get("/metrics"))
    .toProperty()
  metrics.log("/metrics")

  return (
    <div className="metric-list">
      <p>Metrics last updated {lastUpdated(metrics)}</p>
      {U.mapElems((metric, key) =>
        <Metric key={key} metric={metric} />, metrics)}
    </div>
  )
}

const Metric = ({metric}) => {
  const widgetUrl = metric.map(mkWidgetImageUrl).toProperty()
  widgetUrl.log("widgetUrl")

  return (
    <img src={widgetUrl} />
  )
}

const AlarmList = () => {
  const alarms = refreshMs(REFRESH_INTERVAL)
    .flatMap(() => get("/alarms"))
    .toProperty()
  alarms.log("/alarms")

  return (
    <div className="alarm-list">
      <table>
        <thead>
          <tr>
            <td colSpan={2}>Alarms last updated {lastUpdated(alarms)}</td>
          </tr>
        </thead>
        <tbody>
          {U.mapElems((alarm, key) =>
            <Alarm key={key} alarm={alarm} />, alarms)}
        </tbody>
      </table>
    </div>
  )
}

const Alarm = ({alarm}) => {
  const state = U.view("StateValue", alarm)
  const className = state.map(_ => "alarm-state-" + _)
  const name = U.view("AlarmName", alarm)

  return (
    <tr className={className}>
      <td>{state}</td>
      <td>{name}</td>
    </tr>
  )
}

const refreshMs = ms =>
  Kefir.constant().delay(1000).concat(Kefir.interval(ms))

const lastUpdated = stream =>
  stream.map(() => formatTime(new Date())).toProperty()

const apiBase = `${window.location.origin}/api`

function get(path, options) {
  return Kefir.fromPromise(
    fetch(`${apiBase}${path}`, options)
    .then(response => response.json())
  )
}

function mkWidgetImageUrl(metric) {
  return `${apiBase}/metrics/widget?namespace=${encodeURIComponent(metric.Namespace)}&metric=${encodeURIComponent(metric.MetricName)}`
}

const dateTimeFormat = new Intl.DateTimeFormat("default", {
  dateStyle: "medium",
  timeStyle: "medium",
})

function formatTime(date) {
  return dateTimeFormat.format(date)
}

render(<App />, document.getElementById("app"))

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");

// Extract the pure date helpers and evaluate them in isolation.
const pick = name => {
  const start = ui.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = ui.indexOf("\n}\n", start);
  return ui.slice(start, end + 2);
};
const helpers = new Function(
  `${pick("parseGraphDate")}\n${pick("eventStart")}\n${pick("eventEnd")}\nreturn { parseGraphDate, eventStart, eventEnd };`
)();

// Native double-click editor: getEvent returns UTC-labelled values without offset.
const utcEvent = {
  start: { dateTime: "2026-10-05T08:00:00.0000000", timeZone: "UTC" },
  end: { dateTime: "2026-10-05T09:00:00.0000000", timeZone: "UTC" }
};
assert.strictEqual(helpers.eventStart(utcEvent).toISOString(), "2026-10-05T08:00:00.000Z");
assert.strictEqual(helpers.eventEnd(utcEvent).toISOString(), "2026-10-05T09:00:00.000Z");

// Values that already carry an offset are not altered.
assert.strictEqual(helpers.parseGraphDate("2026-10-05T08:00:00Z", "UTC").toISOString(), "2026-10-05T08:00:00.000Z");
assert.strictEqual(helpers.parseGraphDate("2026-10-05T10:00:00+02:00", "UTC").toISOString(), "2026-10-05T08:00:00.000Z");

// Space calendarView values in the configured zone keep local wall-clock parsing.
const local = helpers.parseGraphDate("2026-10-05T10:00:00.0000000", "W. Europe Standard Time");
assert.strictEqual(local.getHours(), 10);
assert.strictEqual(helpers.parseGraphDate("", "UTC"), null);

console.log("V2.50 Space UTC event times: PASS");

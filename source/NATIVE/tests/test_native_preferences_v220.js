"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "api.js"), "utf8");
assert.ok(api.includes("extensions.m365CalendarNative."), "native UI preferences need a persistent pref store");
for (const prop of ["color", "disabled", "calendar-main-in-composite", "suppressAlarms", "imip.identity.key"]) {
  assert.ok(api.includes(`\"${prop}\"`), `preference contract missing ${prop}`);
}
assert.ok(api.includes("snapshotCalendarUserPrefs"), "calendar UI preferences must be snapshotted");
assert.ok(api.includes("snapshotAllCalendarUserPrefs(extension)"), "shutdown must snapshot preferences before calendar removal");
assert.ok(api.includes("applySavedCalendarUserPrefs(extension, calendar, descriptor, true)"), "new/recreated calendars must restore preferences");
const updateStart = api.indexOf("stageSync(`updateCalendar:${label}`");
const updateEnd = api.indexOf("result.push(calendarDescriptor", updateStart);
const update = api.slice(updateStart, updateEnd);
assert.ok(updateStart >= 0 && updateEnd > updateStart, "existing calendar update block missing");
assert.ok(!update.includes('setProperty("color", descriptor.color'), "existing calendar colour must not be overwritten by Graph metadata");
assert.ok(!update.includes("calendar.name = descriptor.name"), "existing calendar display name must not be overwritten");
assert.ok(api.includes("programmaticCalendarMutationDepth"), "programmatic changes must not be mistaken for user preferences");
console.log("native calendar preference persistence V2.22: OK");

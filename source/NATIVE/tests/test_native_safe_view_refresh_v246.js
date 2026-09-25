"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const api=fs.readFileSync(path.join(root,"experiments","nativeCalendar","api.js"),"utf8");
const helperStart=api.indexOf("async function refreshCalendarViewItems(view)");
const helperEnd=api.indexOf("async function reloadOpenCalendarViews", helperStart);
assert.ok(helperStart>=0 && helperEnd>helperStart, "V2.46 view-refresh helper missing");
const helper=api.slice(helperStart,helperEnd);
const refreshPos=helper.indexOf('typeof view.refreshItems === "function"');
const refreshCall=helper.indexOf("view.refreshItems(true)");
const fallbackPos=helper.indexOf('typeof view.goToDay === "function"');
const fallbackCall=helper.indexOf("view.goToDay()");
assert.ok(refreshPos>=0 && refreshCall>refreshPos, "refreshItems(true) must be primary path");
assert.ok(fallbackPos>refreshCall && fallbackCall>fallbackPos, "goToDay must be guarded legacy fallback after refreshItems");
assert.ok(!helper.includes("view.refreshView("), "do not use refreshView because it can route through goToDay(selectedDay)");
assert.ok(api.includes("lastStrategies: []"));
assert.ok(api.includes("lastViews: []"));
for (const field of ["startDay","endDay","rangeStartDate","rangeEndDate","selectedDay","strategy","elapsedMs"]) {
  assert.ok(api.includes(`${field}:`), `diagnostic field missing: ${field}`);
}
assert.ok(api.includes("const refreshed = await reloadOpenCalendarViews(reason);"), "manual reload API must await refresh completion");
console.log("native safe Month/Multiweek refresh contract V2.46: OK");

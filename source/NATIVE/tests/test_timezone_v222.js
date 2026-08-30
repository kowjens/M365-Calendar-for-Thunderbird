"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "calendar", "calendar.html"), "utf8");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(html.includes('<select id="timeZoneInput"></select>'), "timezone must be a select");
assert(js.includes('const EXCHANGE_TIME_ZONES = ['), "timezone option table missing");
assert(js.includes('["W. Europe Standard Time", "Europe/Berlin'), "Berlin/W. Europe option missing");
assert(js.includes('populateTimeZoneSelect(state.config.timeZone'), "timezone selector not populated from config");
assert(bg.includes('outlook.timezone="UTC", outlook.body-content-type="text"'), "hydration detail reads must request UTC");
assert(bg.includes('start: entry.event?.start || response.body?.start'), "batch hydration must preserve calendarView UTC start");
assert(bg.includes('end: entry.event?.end || response.body?.end'), "batch hydration must preserve calendarView UTC end");
assert(bg.includes('start: entry.event?.start || detail?.start'), "fallback hydration must preserve calendarView UTC start");
console.log("V2.22 timezone transport/dropdown contract passed");

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "api.js"), "utf8");
const options = fs.readFileSync(path.join(root, "options", "options.js"), "utf8");

// Thunderbird <=153 compatibility remains available.
assert.ok(api.includes('Cc["@mozilla.org/calendar/startup-service;1"]'));
assert.ok(api.includes('Services.obs.addObserver(observer, "calendar-startup-done")'));

// Thunderbird 154+ must not depend on the removed startup service/notification.
assert.ok(api.includes("function modernCalendarManagerReady()"));
assert.ok(api.includes('typeof cal.manager.getCalendars === "function"'));
assert.ok(api.includes("cal.manager.getCalendars();"));
assert.ok(api.includes("if (!legacy)"));

// No startup wait may remain unbounded.
assert.ok(api.includes("async function waitForCalendarStartup(timeoutMs = 12000)"));
assert.ok(api.includes("nativeSetTimeout(() =>"));
assert.ok(api.includes("Timed out after ${timeoutMs} ms waiting for legacy calendar startup"));

// Settings diagnostics must surface a failure rather than stay on Loading/checking forever.
assert.ok(options.includes("async function withTimeout("));
assert.ok(options.includes('withTimeout(browser.nativeCalendar?.ping?.(),3000,"nativeCalendar.ping")'));
assert.ok(options.includes('withTimeout(msg("nativeStatus"),15000,"nativeStatus")'));

console.log("V2.41 Thunderbird 154+ calendar-startup compatibility contract passed");

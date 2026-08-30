"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(bg.includes('scheduleNativeProviderActivation("background-start", 1200)'), "provider startup activation not scheduled");
assert(bg.includes('await api.activate();'), "provider startup activation does not activate native API");
const refreshPos = js.indexOf('await refreshNativeStatus();', js.indexOf('async function openSettings()'));
const buildInfoPos = js.indexOf('els.buildInfo.textContent', js.indexOf('async function openSettings()'));
assert(refreshPos >= 0 && buildInfoPos > refreshPos, "build info must render after native status/probe");
assert(js.includes('providerStartupActivated='), "provider startup diagnostics missing");
console.log("V2.22 provider startup/status contract passed");

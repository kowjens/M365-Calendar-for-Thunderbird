"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
function must(re, msg) { if (!re.test(bg)) throw new Error(msg); }
must(/scheduleNativeAutoSync\("background-start",\s*3000\)/, "background-start native auto sync missing");
must(/browser\.runtime\?\.onStartup/, "Thunderbird onStartup hook missing");
must(/runNativeAutoSync\("login-success"\)/, "post-login native auto sync missing");
must(/syncNativeCalendars\(\)/, "native direct sync function missing");
if (!/api\("syncNativeCalendars"\)/.test(ui)) throw new Error("settings enable/save does not use direct native sync");
console.log("Native V2.18 auto-start synchronization contract passed.");

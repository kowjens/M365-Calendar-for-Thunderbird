"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const css = fs.readFileSync(path.join(root, "calendar", "calendar.css"), "utf8");
function ok(value, message) { if (!value) throw new Error(message); }
ok(js.includes('NATIVE_TEAMS_POPUP'), "Teams popup launch mode missing");
ok(js.includes('NATIVE_TEAMS_CALENDAR_ID'), "requested calendar selection missing");
ok(js.includes('calendar.isDefault && calendar.canEdit'), "writable default calendar fallback missing");
ok(css.includes('body.native-teams-popup'), "compact popup CSS missing");
console.log("Teams editor popup contract: ok");

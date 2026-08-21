"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "api.js"), "utf8");
for (const needle of [
  'calendar-view-context-menu',
  'calendar-view-context-menu-newevent',
  'native-calendar-context',
  'selectedDateTime',
  'getDefaultStartDate',
  'TEAMS_CONTEXT_ID'
]) {
  if (!api.includes(needle)) throw new Error(`Missing native Teams context-menu contract: ${needle}`);
}
console.log("Native Teams context-menu contract passed");

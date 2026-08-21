const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "api.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "schema.json"), "utf8");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
for (const needle of [
  'onEventEditRequested',
  'addEventListener("dblclick", handler, true)',
  'event.stopImmediatePropagation()',
  'native-calendar-dblclick',
  'editEventId',
  'case "getEvent"',
  'NATIVE_EDIT_EVENT_ID'
]) {
  if (![api,schema,bg,ui].some(s => s.includes(needle))) throw new Error(`Missing V2.18 native editor contract: ${needle}`);
}
console.log("V2.18 native double-click editor contract: PASS");

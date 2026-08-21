"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const html = fs.readFileSync(path.join(root, "calendar", "calendar.html"), "utf8");
if (!manifest.permissions.includes("addressBooks")) throw new Error("addressBooks permission missing");
for (const needle of ['contacts.quickSearch', 'searchContacts', 'includeLocal: true', 'includeRemote: true']) {
  if (!background.includes(needle)) throw new Error(`Missing background autocomplete contract: ${needle}`);
}
for (const needle of ['attendeeSuggestions', 'scheduleAttendeeSearch', 'handleAttendeeSuggestionKeydown']) {
  if (!js.includes(needle) && !html.includes(needle)) throw new Error(`Missing attendee UI contract: ${needle}`);
}
console.log("Attendee autocomplete contract passed");

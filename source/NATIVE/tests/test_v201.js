"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "calendar/calendar.js"), "utf8");
const html = fs.readFileSync(path.join(root, "calendar/calendar.html"), "utf8");

assert.strictEqual(manifest.version, "2.0.33");
assert.ok(bg.includes('"Calendars.ReadWrite.Shared"'), "shared calendar scope missing");
for (const fn of ["updateEvent", "deleteEvent", "getSchedule", "buildGraphEventPayload"]) {
  assert.ok(bg.includes(`function ${fn}`) || bg.includes(`async function ${fn}`), `missing ${fn}`);
}
for (const fn of ["openEditEvent", "deleteCurrentEvent", "checkAvailability", "buildRecurrencePayload"]) {
  assert.ok(ui.includes(`function ${fn}`) || ui.includes(`async function ${fn}`), `missing UI ${fn}`);
}
for (const id of ["editEventBtn", "deleteEventBtn", "newAllDay", "newReminder", "newShowAs", "newSensitivity", "newCategories", "newRecurrenceType", "checkAvailabilityBtn"]) {
  assert.ok(html.includes(`id="${id}"`), `missing UI element ${id}`);
}
for (const lang of ["de", "en"]) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, `_locales/${lang}/messages.json`), "utf8"));
  for (const key of ["editEvent", "deleteEvent", "checkAvailability", "recurrence", "sharedShort", "eventUpdated", "eventDeleted"]) {
    assert.ok(messages[key]?.message, `${lang}: missing ${key}`);
  }
}
console.log("test_v201.js: OK");

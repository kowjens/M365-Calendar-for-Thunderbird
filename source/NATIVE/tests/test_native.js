"use strict";
const assert = require("assert");
const native = require("../lib/native.js");

const event = {
  id: "abc",
  subject: "Test Meeting",
  start: { dateTime: "2026-08-20T08:00:00.0000000", timeZone: "UTC" },
  end: { dateTime: "2026-08-20T09:00:00.0000000", timeZone: "UTC" },
  location: { displayName: "Room 1" },
  organizer: { emailAddress: { address: "boss@example.com", name: "Boss" } },
  attendees: [
    { emailAddress: { address: "me@example.com", name: "Me" }, type: "required", status: { response: "accepted" } },
    { emailAddress: { address: "opt@example.com" }, type: "optional", status: { response: "notResponded" } }
  ],
  responseStatus: { response: "accepted" },
  isOnlineMeeting: true,
  onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/test" },
  webLink: "https://outlook.office.com/calendar/item/test",
  isOrganizer: false,
  type: "singleInstance",
  showAs: "busy",
  sensitivity: "private",
  body: { contentType: "text", content: "Full Description" },
  bodyPreview: "Description",
  isCancelled: false,
  isAllDay: false,
  iCalUId: "icaluid",
  isReminderOn: true,
  reminderMinutesBeforeStart: 10,
  categories: ["Blue"]
};

const converted = native.graphEventToNative(event);
assert.strictEqual(converted.id, "abc");
assert.strictEqual(converted.start, "2026-08-20T08:00:00.000Z");
assert.strictEqual(converted.end, "2026-08-20T09:00:00.000Z");
assert.strictEqual(converted.privacy, "PRIVATE");
assert.strictEqual(converted.description, "Full Description");
assert.strictEqual(converted.attendees[0].status, "ACCEPTED");
assert.strictEqual(converted.attendees[1].role, "OPT-PARTICIPANT");
assert.strictEqual(converted.url.startsWith("https://teams.microsoft.com/"), true);
assert.strictEqual(converted.reminderMinutes, 10);

const payload = native.nativeItemToGraphPayload(converted);
assert.strictEqual(payload.subject, "Test Meeting");
assert.strictEqual(payload.start.timeZone, "UTC");
assert.strictEqual(payload.start.dateTime, "2026-08-20T08:00:00");
assert.strictEqual(payload.attendees[1].type, "optional");
assert.strictEqual(payload.sensitivity, "private");

const oldItem = JSON.parse(JSON.stringify(converted));
oldItem.attendees[0].status = "NEEDS-ACTION";
assert.strictEqual(native.responseChangeForUser(converted, oldItem, "me@example.com"), "accept");
assert.strictEqual(native.responseChangeForUser(converted, converted, "me@example.com"), "");

const range = native.stableRange(new Date("2026-08-20T11:00:00Z"), 90, 365);
assert.strictEqual(range.start, "2026-05-22T00:00:00.000Z");
assert.strictEqual(range.end, "2027-08-20T00:00:00.000Z");
assert.match(native.graphColorToHex("lightBlue"), /^#[0-9a-f]{6}$/i);

console.log("test_native.js: OK");

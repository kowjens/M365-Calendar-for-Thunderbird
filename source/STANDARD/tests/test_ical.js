"use strict";

const assert = require("assert");
const parser = require("../lib/ical.js");

const sample = [
  "BEGIN:VCALENDAR",
  "METHOD:REQUEST",
  "BEGIN:VEVENT",
  "UID:040000008200E00074C5B7101A82E00800000000ABCDEF",
  "SEQUENCE:3",
  "DTSTART;TZID=Europe/Berlin:20260821T093000",
  "DTEND;TZID=Europe/Berlin:20260821T103000",
  "SUMMARY:Projekt\\, Test",
  "LOCATION:Teams\\; Online",
  "ORGANIZER;CN=Max Mustermann:mailto:max@example.com",
  "ATTENDEE;CN=Jens:mailto:jens@example.com",
  "DESCRIPTION:Zeile 1\\nZeile 2",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\r\n");

const event = parser.parseInvitation(sample);
assert(event, "Invitation should be parsed");
assert.strictEqual(event.method, "REQUEST");
assert.strictEqual(event.uid, "040000008200E00074C5B7101A82E00800000000ABCDEF");
assert.strictEqual(event.summary, "Projekt, Test");
assert.strictEqual(event.location, "Teams; Online");
assert.strictEqual(event.organizer.address, "max@example.com");
assert.strictEqual(event.attendees[0].address, "jens@example.com");
assert.strictEqual(event.sequence, 3);
assert(event.start.iso, "Start ISO should exist");

const folded = "BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Long \r\n continuation\r\nEND:VEVENT\r\nEND:VCALENDAR";
assert.strictEqual(parser.parseInvitation(folded).summary, "Long continuation");
assert.strictEqual(parser.parseInvitation("not a calendar"), null);

console.log("test_ical.js: OK");

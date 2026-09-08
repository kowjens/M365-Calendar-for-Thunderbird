"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const native = require("../lib/native.js");

const base = {
  id: "evt-1",
  title: "3-5PE Sales Meeting",
  start: "2026-09-08T12:00:00.000Z",
  end: "2026-09-08T13:00:00.000Z",
  allDay: false,
  description: "Agenda",
  location: "Teams",
  privacy: "PUBLIC",
  transparency: "OPAQUE",
  categories: ["Sales"],
  reminderMinutes: 15,
  attendees: [
    { address: "volker.dudek@3-5pe.com", name: "Volker", role: "REQ-PARTICIPANT", status: "ACCEPTED", type: "INDIVIDUAL" },
    { address: "jens.kowalsky@3-5pe.com", name: "Jens", role: "REQ-PARTICIPANT", status: "ACCEPTED", type: "INDIVIDUAL" }
  ]
};

// Metadata which is not written to Graph must not create a remote change.
const localOnly = { ...base, changeKey: "new-change-key", responseStatus: "accepted" };
assert.strictEqual(native.nativeGraphRelevantEqual(base, localOnly), true,
  "local/server metadata differences must not trigger a Graph write");

// Attendee and category ordering is not a semantic meeting change.
const reordered = { ...base, categories: ["Sales"], attendees: [...base.attendees].reverse() };
assert.strictEqual(native.nativeGraphRelevantEqual(base, reordered), true,
  "attendee ordering must not trigger a Graph write");

assert.strictEqual(native.nativeGraphRelevantEqual(base, { ...base, title: "Changed title" }), false,
  "subject changes must remain Graph-relevant");
assert.strictEqual(native.nativeGraphRelevantEqual(base, { ...base, reminderMinutes: 30 }), false,
  "real reminder setting changes must remain Graph-relevant");

const api = fs.readFileSync(path.resolve(__dirname, "../experiments/nativeCalendar/api.js"), "utf8");
const bg = fs.readFileSync(path.resolve(__dirname, "../background.js"), "utf8");

assert.ok(api.includes("plainRemoteOperationSignature(newPlain) === plainRemoteOperationSignature(oldPlain)"),
  "native provider local-only fast path missing");
assert.ok(api.includes("return newItem;"),
  "local-only path must preserve the exact Thunderbird item including alarm acknowledgement/snooze state");
assert.ok(api.includes('result?.nativeOperation === "local-only" ? newItem : plainToItem(result, this)'),
  "background fallback must preserve the original Thunderbird item");

const updateStart = bg.indexOf("async function nativeUpdateHandler");
const updateEnd = bg.indexOf("async function nativeRemoveHandler", updateStart);
const update = bg.slice(updateStart, updateEnd);
const guardPos = update.indexOf("M365_NATIVE.nativeGraphRelevantEqual(item, oldItem)");
const confirmPos = update.indexOf('kind: "meetingUpdate"');
const patchPos = update.indexOf('method: "PATCH"');
assert.ok(guardPos >= 0, "background local-only guard missing");
assert.ok(confirmPos > guardPos, "local-only guard must run before meeting-update confirmation");
assert.ok(patchPos > guardPos, "local-only guard must run before Graph PATCH");
assert.ok(update.includes('nativeOperation: "local-only"'), "local-only marker missing");

console.log("V2.36 native reminder-dismiss/local-only write guard passed");

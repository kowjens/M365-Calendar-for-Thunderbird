"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const native = require("../lib/native.js");

const join = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC%40thread.v2/0?context=%7B%22Tid%22%3A%22tenant%22%7D&foo=bar";
const external = {
  subject: "External Teams invitation",
  isOnlineMeeting: false,
  onlineMeeting: null,
  onlineMeetingUrl: "",
  body: { contentType: "html", content: `<p>Join:</p><a href="${join.replace(/&/g,"&amp;")}">Microsoft Teams</a>` },
  bodyPreview: "Microsoft Teams meeting",
  start: { dateTime: "2026-09-10T08:00:00", timeZone: "UTC" },
  end: { dateTime: "2026-09-10T09:00:00", timeZone: "UTC" }
};
assert.strictEqual(native.extractTeamsJoinUrl(external), join);
const mapped = native.graphEventToNative(external);
assert.strictEqual(mapped.url, join);
assert.strictEqual(mapped.isOnlineMeeting, true);

const direct = { onlineMeeting: { joinUrl: "https://contoso.example/join" } };
assert.strictEqual(native.extractTeamsJoinUrl(direct), "https://contoso.example/join");

const calendarJs = fs.readFileSync(path.resolve(__dirname,"../calendar/calendar.js"),"utf8");
const calendarHtml = fs.readFileSync(path.resolve(__dirname,"../calendar/calendar.html"),"utf8");
assert.ok(calendarJs.includes("M365_NATIVE.extractTeamsJoinUrl(event)"));
assert.ok(calendarHtml.includes('../lib/native.js'));
console.log("V2.34 external Teams join-link fallback passed");

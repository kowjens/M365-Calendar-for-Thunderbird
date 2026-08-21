"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "api.js"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "experiments", "nativeCalendar", "schema.json"), "utf8"));
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const calendar = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
function ok(value, message) { if (!value) throw new Error(message); }
ok(api.includes('m365-native-teams-meeting-button'), "native Teams button injection missing");
ok(api.includes('nativeCalendar.onTeamsMeetingRequested'), "native Teams event bridge missing");
ok(schema[0].events.some(e => e.name === "onTeamsMeetingRequested"), "schema event missing");
ok(bg.includes('openNativeTeamsMeetingPopup'), "background popup opener missing");
ok(bg.includes('calendar/calendar.html?${params.toString()}'), "popup must reuse the existing calendar editor");
ok(calendar.includes('NATIVE_TEAMS_POPUP'), "calendar editor popup mode missing");
console.log("native Teams meeting button contract: ok");

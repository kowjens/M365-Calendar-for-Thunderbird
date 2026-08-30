"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const bg=fs.readFileSync(path.join(root,"background.js"),"utf8");
assert.ok(bg.includes('api.upsertCalendarEvent(calendarId, nativeEvent)'));
assert.ok(bg.includes('api.removeCalendarEvent(calendarId, deletedEventId)'));
assert.ok(bg.includes('scheduleNativeAutoSync("external-write-reconcile", 2200)'));
if(fs.existsSync(path.join(root,'experiments/nativeCalendar/api.js'))){const api=fs.readFileSync(path.join(root,'experiments/nativeCalendar/api.js'),'utf8');assert.ok(api.includes('async function upsertCalendarEventUnlocked'));assert.ok(api.includes('async function removeCalendarEventUnlocked'));}
console.log('V2.27 direct native cache push contract passed');

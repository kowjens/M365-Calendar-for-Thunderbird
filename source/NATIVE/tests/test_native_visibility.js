"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const api=fs.readFileSync(path.join(root,"experiments","nativeCalendar","api.js"),"utf8");
const updateStart=api.indexOf("stageSync(`updateCalendar:${label}`");
const updateEnd=api.indexOf("result.push(calendarDescriptor", updateStart);
const updateSection=api.slice(updateStart, updateEnd);
assert.ok(updateSection.includes("readOnly"), "existing calendar update section not found");
assert.ok(!updateSection.includes('setProperty("calendar-main-in-composite", descriptor.visible'), "existing calendar must preserve Hide/Show state");
assert.ok(!updateSection.includes('setProperty("disabled", descriptor.enabled'), "existing calendar must preserve enabled state");
assert.ok(api.includes('calendar.setProperty("calendar-main-in-composite", prefs && Object.prototype.hasOwnProperty.call(prefs, "visible")'), "new/recreated calendars should restore initial visibility");
assert.ok(api.includes('calendar.setProperty("disabled", prefs && Object.prototype.hasOwnProperty.call(prefs, "disabled")'), "new/recreated calendars should restore enabled state");
console.log("native visibility preservation V2.22: OK");

assert.ok(api.includes('name === "calendar-main-in-composite"'), "visibility observer must watch Thunderbird composite membership");
assert.ok(api.includes('scheduleCalendarViewReload(value ? "visibility:show" : "visibility:hide")'), "show/hide must schedule a view reload");
assert.ok(api.includes('view.goToDay();'), "view reload must use Thunderbird no-navigation goToDay refresh path");
assert.ok(api.includes('cal.manager.addCalendarObserver(nativeVisibilityObserver)'), "calendar observer must be registered");
console.log("native visibility auto-reload V2.22: OK");

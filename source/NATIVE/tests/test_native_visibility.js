"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=path.resolve(__dirname,"..");
const api=fs.readFileSync(path.join(root,"experiments","nativeCalendar","api.js"),"utf8");
const updateSection=api.split("stageSync(`updateCalendar:${label}`")[1]?.split("});")[0] || "";
assert.ok(updateSection.includes("readOnly"), "existing calendar update section not found");
assert.ok(!updateSection.includes('setProperty("calendar-main-in-composite"'), "existing calendar must preserve Hide/Show state");
assert.ok(!updateSection.includes('setProperty("disabled"'), "existing calendar must preserve enabled state");
const createSection=api.split("stageSync(`configureCalendar:${label}`")[1]?.split("});")[0] || "";
assert.ok(createSection.includes('setProperty("calendar-main-in-composite"'), "new calendars should get initial visibility");
console.log("native visibility preservation V2.18: OK");

assert.ok(api.includes('name !== "calendar-main-in-composite"'), "visibility observer must watch Thunderbird composite membership");
assert.ok(api.includes('scheduleCalendarViewReload(value ? "visibility:show" : "visibility:hide")'), "show/hide must schedule a view reload");
assert.ok(api.includes('view.goToDay();'), "view reload must use Thunderbird no-navigation goToDay refresh path");
assert.ok(api.includes('cal.manager.addCalendarObserver(nativeVisibilityObserver)'), "calendar observer must be registered");
console.log("native visibility auto-reload V2.18: OK");

"use strict";
const assert=require("assert"), fs=require("fs"), path=require("path");
const api=fs.readFileSync(path.join(__dirname,"../experiments/nativeCalendar/api.js"),"utf8");
assert.ok(api.includes('X-M365-SYNTHETIC-SELF'));
assert.ok(api.includes('status: "ACCEPTED"'));
assert.ok(api.includes('if (!syntheticSelfMirror)'));
assert.ok(api.includes('cacheAppointments'));
assert.ok(api.includes('cacheOnlineMeetings'));
console.log("test_native_self_mirror_v227.js: OK");

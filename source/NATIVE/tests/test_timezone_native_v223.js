"use strict";
const fs=require("fs"), path=require("path"), assert=require("assert");
const root=path.resolve(__dirname,"..");
const api=fs.readFileSync(path.join(root,"experiments","nativeCalendar","api.js"),"utf8");
assert.ok(api.includes('CalDateTime.sys.mjs'), 'CalDateTime import missing');
assert.ok(api.includes('cal.dtz.jsDateToDateTime(date).getInTimezone(cal.dtz.UTC)'), 'instant-preserving conversion missing');
assert.ok(!api.includes('cal.dtz.jsDateToDateTime(date, cal.dtz.UTC)'), 'wall-clock reinterpretation must be removed');
assert.ok(api.includes('dt.resetTo(Number(match[1]), Number(match[2]) - 1'), 'all-day direct date construction missing');
console.log('V2.23 native timezone conversion contract passed');

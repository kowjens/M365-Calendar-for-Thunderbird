"use strict";
const fs=require("fs"), path=require("path"), assert=require("assert");
const root=path.resolve(__dirname,"..");
const bg=fs.readFileSync(path.join(root,"background.js"),"utf8");
for (const needle of [
  'const NATIVE_WRITE_GUARD_TTL_MS = 120000;',
  'rememberNativeUpsert(payload.calendarId, created)',
  'rememberNativeDelete(calendarId, eventId)',
  'applyRecentNativeWriteGuards(calendarId, hydrated.events)',
  'guardedChangeKey === serverChangeKey',
  'serverModifiedMs >= guardedModifiedMs',
  'protectedDeletes += 1'
]) assert.ok(bg.includes(needle), `missing V2.24 read-after-write contract: ${needle}`);
console.log("V2.24 read-after-write guard contract passed");

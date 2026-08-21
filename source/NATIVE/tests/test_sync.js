"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { console, URL, encodeURIComponent };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require("path").join(__dirname, "..", "lib", "sync.js"), "utf8"), context);
const S = context.M365_SYNC;

const base = {
  id: "1", subject: "Meeting", start: { dateTime: "2026-08-20T10:00:00Z" }, end: { dateTime: "2026-08-20T11:00:00Z" },
  "@odata.etag": "A", type: "singleInstance"
};
let r = S.applyDelta([], [base], { initial: true });
assert.equal(r.events.length, 1);
assert.equal(r.summary.added, 1);
assert.equal(r.summary.loaded, 1);

r = S.applyDelta(r.events, [{ ...base, subject: "Meeting changed", "@odata.etag": "B" }]);
assert.equal(r.events[0].subject, "Meeting changed");
assert.equal(r.summary.updated, 1);

r = S.applyDelta(r.events, [{ id: "1", "@removed": { reason: "deleted" } }]);
assert.equal(r.events.length, 0);
assert.equal(r.summary.removed, 1);

const snap = S.diffSnapshots([base], [{ ...base, subject: "snapshot changed" }, { ...base, id: "3" }]);
assert.equal(snap.summary.updated, 1);
assert.equal(snap.summary.added, 1);
assert.equal(snap.summary.removed, 0);

const recur = { ...base, id: "2", type: "occurrence", seriesMasterId: "master", originalStart: "2026-08-21T10:00:00Z" };
r = S.applyDelta([], [recur]);
assert.equal(r.events[0].seriesMasterId, "master");
assert.equal(r.events[0].type, "occurrence");

const k1 = S.makeWindowKey({ accountId:"a", calendarId:"c", start:"s", end:"e", timeZone:"UTC" });
const k2 = S.makeWindowKey({ accountId:"a", calendarId:"c", start:"s", end:"e", timeZone:"W. Europe Standard Time" });
assert.notEqual(k1, k2);

const store = S.newStore();
for (let i = 0; i < 15; i++) store.windows[`k${i}`] = { lastAccessAt: i };
assert.equal(Object.keys(S.pruneStore(store, 12).windows).length, 12);
assert(S.isLikelyDeltaTokenError({ status: 410 }));
assert(S.isLikelyDeltaTokenError({ status: 400, message: "syncStateNotFound deltaToken" }));
assert(!S.isLikelyDeltaTokenError({ status: 500, message: "server error" }));
console.log("test_sync: OK");

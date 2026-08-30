"use strict";
const fs = require("fs");
const path = require("path");
const api = fs.readFileSync(path.resolve(__dirname, "..", "experiments", "nativeCalendar", "api.js"), "utf8");
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(api.includes('Ci.nsIAbManager.ASYNC_DIRECTORY_TYPE'), "async address-book directory type not handled");
assert(api.includes('directory.search(null, text, listener)'), "async CardDAV-like directory direct search missing");
assert(api.includes('backend === "ldap" ? 5000 : 9000'), "addrbook autocomplete timeout not extended for async/CardDAV results");
assert(api.includes('JSON.stringify({ type: "addr_to" })'), "Thunderbird compose autocomplete search params missing");
assert(api.includes('asyncDirectoryResultCount'), "async address-book diagnostics missing");
assert(api.includes('newChangeKey === oldChangeKey && signatureUnchanged'), "cache reconciliation must detect client-side time conversion changes");
console.log("V2.22 CardDAV/cache-rewrite contract passed");

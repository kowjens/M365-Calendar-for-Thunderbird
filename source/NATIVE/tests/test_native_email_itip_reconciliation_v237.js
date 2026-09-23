"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const bg = fs.readFileSync(path.resolve(__dirname,"../background.js"),"utf8");
const api = fs.readFileSync(path.resolve(__dirname,"../experiments/nativeCalendar/api.js"),"utf8");
const native = require("../lib/native.js");

assert.ok(api.includes("async function cachedInvitationHint"), "provider must reconcile iTIP with an already cached Exchange event");
assert.ok(api.includes("options.invitationResponseStatus = safeString(invited.participationStatus)"), "provider must preserve Thunderbird's selected PARTSTAT");
assert.ok(api.includes("options.cachedGraphEventId = hint.graphEventId"), "provider must pass cached Graph id to the background");

assert.ok(bg.includes("async function findEventForInvitationWithRetry"), "Graph lookup must tolerate Exchange propagation delay");
assert.ok(bg.includes("const waits = [0, 400, 900, 1700, 3000]"), "retry schedule must be bounded and explicit");
assert.ok(bg.includes("async function finalizeNativeInvitationResponse"), "successful RSVP must have a non-fatal reconciliation/readback stage");
assert.ok(bg.includes("RSVP succeeded but immediate Graph readback failed; returning reconciled event"));

const createStart = bg.indexOf("async function nativeCreateHandler");
const createEnd = bg.indexOf("async function nativeUpdateHandler", createStart);
const create = bg.slice(createStart, createEnd);
const respondPos = create.indexOf("await respondEvent({");
const finalizePos = create.indexOf("await finalizeNativeInvitationResponse", respondPos);
const createPayloadPos = create.indexOf("const payload = M365_NATIVE.nativeItemToGraphPayload(item)");
assert.ok(respondPos >= 0, "iTIP handler must call the dedicated Graph RSVP action");
assert.ok(finalizePos > respondPos, "post-RSVP reconciliation must happen only after Graph accepted the response");
assert.ok(createPayloadPos > finalizePos, "invitation branch must finish before generic event creation is reachable");

assert.strictEqual(native.partstatToGraphAction("ACCEPTED"), "accept");
assert.strictEqual(native.partstatToGraphAction("TENTATIVE"), "tentativelyAccept");
assert.strictEqual(native.partstatToGraphAction("DECLINED"), "decline");
assert.strictEqual(native.partstatToGraphAction("NEEDS-ACTION"), "");
console.log("V2.38 native email iTIP reconciliation contract passed");

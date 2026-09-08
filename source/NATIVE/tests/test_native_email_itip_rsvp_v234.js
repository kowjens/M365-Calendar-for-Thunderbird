"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const bg = fs.readFileSync(path.resolve(__dirname,"../background.js"),"utf8");
const api = fs.readFileSync(path.resolve(__dirname,"../experiments/nativeCalendar/api.js"),"utf8");
const native = require("../lib/native.js");

const start = bg.indexOf("async function nativeCreateHandler");
const end = bg.indexOf("async function nativeUpdateHandler", start);
const create = bg.slice(start,end);
assert.ok(create.includes("options = {}"));
assert.ok(create.includes("isInvitationOperation"));
assert.ok(create.includes("options?.invitation || isExternalOrganizer"), "external-organizer adopts must never fall through to Graph event creation");
assert.ok(create.includes("findEventForInvitation(nativePlainItemAsInvitation(item))"));
assert.ok(create.includes("response: responseAction"));
assert.ok(create.includes("sendResponse: true"));
assert.ok(create.includes('nativeOperation: "rsvp-existing"'));
const invitationPos = create.indexOf("if (isInvitationOperation)");
const graphCreatePos = create.indexOf("const payload = M365_NATIVE.nativeItemToGraphPayload(item)");
assert.ok(invitationPos >= 0 && graphCreatePos > invitationPos, "RSVP branch must run before any Graph event create");
assert.ok(create.slice(invitationPos, graphCreatePos).includes("no new meeting was created"), "unmatched iTIP must fail closed");

assert.ok(api.includes('options.invitation = true'));
assert.ok(api.includes('identityEmail: String(get("imip.identity")?.email || "")'));
assert.ok(api.includes('X-MOZ-INVITED-ATTENDEE'));
assert.ok(api.includes('result?.nativeOperation === "rsvp-existing"'));
assert.ok(api.includes('await this.offlineStorage.deleteItem(existing)'));

assert.strictEqual(native.responseActionForUser({attendees:[{address:"ews@example.com",status:"ACCEPTED"}]}, ["graph@example.com","ews@example.com"]), "accept");
assert.strictEqual(native.responseActionForUser({attendees:[{address:"ews@example.com",status:"TENTATIVE"}]}, ["graph@example.com","ews@example.com"]), "tentativelyAccept");
assert.strictEqual(native.responseActionForUser({attendees:[{address:"ews@example.com",status:"DECLINED"}]}, ["graph@example.com","ews@example.com"]), "decline");
console.log("V2.34 native email iTIP RSVP isolation passed");

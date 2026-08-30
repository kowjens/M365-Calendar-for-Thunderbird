"use strict";
const assert = require("assert");
const native = require("../lib/native.js");
const appointment = native.graphEventToNative({
  id:"appointment-1", subject:"Plain appointment",
  start:{dateTime:"2026-08-24T08:00:00.0000000",timeZone:"UTC"},
  end:{dateTime:"2026-08-24T09:00:00.0000000",timeZone:"UTC"},
  organizer:{emailAddress:{address:"me@example.com",name:"Me"}}, attendees:[],
  responseStatus:{response:"organizer"}, isOnlineMeeting:false, isOrganizer:true,
  showAs:"busy", sensitivity:"normal", isCancelled:false, isAllDay:false
});
assert.strictEqual(appointment.isAppointment,true);
assert.strictEqual(appointment.isOnlineMeeting,false);
assert.strictEqual(appointment.organizer.address,"me@example.com");
assert.strictEqual(appointment.attendees.length,0);
assert.strictEqual(appointment.nativeSelfMirror,true);
const physical = native.graphEventToNative({
 id:"meeting-1", subject:"Physical meeting",
 start:{dateTime:"2026-08-24T10:00:00.0000000",timeZone:"UTC"},
 end:{dateTime:"2026-08-24T11:00:00.0000000",timeZone:"UTC"},
 organizer:{emailAddress:{address:"me@example.com",name:"Me"}},
 attendees:[{emailAddress:{address:"other@example.com"},type:"required",status:{response:"accepted"}}],
 isOnlineMeeting:false,isOrganizer:true
});
assert.strictEqual(physical.isAppointment,false);
assert.strictEqual(physical.nativeSelfMirror,false);
console.log("test_appointment_v227.js: OK");

"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const api=fs.readFileSync(path.join(__dirname,"../experiments/nativeCalendar/api.js"),"utf8");
assert.ok(api.includes('const NATIVE_MAPPING_VERSION = "2.34-itip-teams-links"'));
assert.ok(api.includes('function nativeMappingConforms(item, data, calendar)'));
assert.ok(api.includes('boolProp("X-M365-APPOINTMENT") !== expectedAppointment'));
assert.ok(api.includes('boolProp("X-M365-SYNTHETIC-SELF") !== expectedSyntheticSelf'));
assert.ok(api.includes('const unchanged = graphContentUnchanged && mappingConforms'));
assert.ok(api.includes('const mappingRepair = graphContentUnchanged && !mappingConforms'))
assert.ok(api.includes('if (mappingRepair) stats.mappingRepairs += 1'));
assert.ok(api.includes('X-M365-NATIVE-MAP-VERSION'));
console.log("V2.28 native mapping migration contract passed");

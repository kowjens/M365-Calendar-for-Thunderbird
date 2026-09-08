const fs = require("fs");
const path = require("path");
const api = fs.readFileSync(path.join(__dirname, "../experiments/nativeCalendar/api.js"), "utf8");
if (!api.includes('const NATIVE_MAPPING_VERSION = "2.34-itip-teams-links"')) throw new Error("V2.32 mapping marker missing");
if (!api.includes('if (mappingRepair) {')) throw new Error("full mapping repair must recreate every event kind");
if (!api.includes('ITEM_FILTER_TYPE_EVENT | Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES')) throw new Error("range occurrence diagnostics missing");
if (!api.includes('rangeQueries')) throw new Error("rangeQueries export missing");
console.log("V2.32 native cache visibility contract checks passed.");

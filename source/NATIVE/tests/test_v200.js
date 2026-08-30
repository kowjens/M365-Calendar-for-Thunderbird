"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.strictEqual(manifest.version, "2.0.32");
assert.strictEqual(manifest.browser_specific_settings.gecko.id, "m365-calendar@jenskowalsky.invalid");
assert.ok(manifest.experiment_apis?.nativeCalendar, "nativeCalendar Experiment missing");
assert.ok(manifest.background.scripts.includes("lib/native.js"));
assert.ok(manifest.background.scripts.includes("background.js"));

const schema = JSON.parse(fs.readFileSync(path.join(root, "experiments/nativeCalendar/schema.json"), "utf8"));
assert.strictEqual(schema[0].namespace, "nativeCalendar");
const functionNames = new Set((schema[0].functions || []).map(f => f.name));
for (const name of ["ensureCalendars", "removeAll", "synchronize", "status"]) {
  assert.ok(functionNames.has(name), `missing native API function ${name}`);
}
const eventNames = new Set((schema[0].events || []).map(e => e.name));
for (const name of ["onSync", "onItemCreated", "onItemUpdated", "onItemRemoved"]) {
  assert.ok(eventNames.has(name), `missing native API event ${name}`);
}

for (const lang of ["de", "en"]) {
  const messages = JSON.parse(fs.readFileSync(path.join(root, `_locales/${lang}/messages.json`), "utf8"));
  for (const key of [
    "nativeIntegrationTitle",
    "nativeIntegrationEnable",
    "nativeSyncNow",
    "nativeStatusActive",
    "nativeSyncResult"
  ]) {
    assert.ok(messages[key]?.message, `${lang}: missing ${key}`);
  }
}

console.log("test_v200.js: OK");

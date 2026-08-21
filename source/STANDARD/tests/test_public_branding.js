"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.strictEqual(manifest.author, "Jens Kowalsky");
assert.strictEqual(manifest.browser_specific_settings.gecko.id, "m365-calendar@jenskowalsky.invalid");
for (const size of [16,32,48,64,96,128]) {
  const rel = manifest.icons[String(size)];
  assert.ok(rel, `missing ${size} icon entry`);
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${size} icon file`);
}
const cfg = fs.readFileSync(path.join(root, "config/build-config.js"), "utf8");
assert.ok(/clientId:\s*""/.test(cfg), "public clientId must be empty");
assert.ok(/tenant:\s*""/.test(cfg), "public tenant must be empty");
console.log("test_public_branding.js: OK");

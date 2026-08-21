"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const css = fs.readFileSync(path.join(root, "calendar", "calendar.css"), "utf8");
if (background.includes("height: 900")) throw new Error("Legacy oversized popup height still present");
for (const needle of ['fitNativeTeamsPopup', 'screen?.availHeight', 'windows.update']) {
  if (!js.includes(needle)) throw new Error(`Missing adaptive popup contract: ${needle}`);
}
if (!css.includes('dialog-body') || !css.includes('overflow: auto')) throw new Error("Popup scroll fallback missing");
console.log("Adaptive popup contract passed");

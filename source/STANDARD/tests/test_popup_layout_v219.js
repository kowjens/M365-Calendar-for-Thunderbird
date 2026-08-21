"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "calendar", "calendar.css"), "utf8");
const js = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
function ok(v, m) { if (!v) throw new Error(m); }
ok(css.includes('.dialog[open] { display: flex; flex-direction: column; }'), 'dialog flex shell missing');
ok(css.includes('overflow-y: auto') && css.includes('scrollbar-gutter: stable'), 'single vertical body scroller missing');
ok(css.includes('body.native-teams-popup .dialog-foot') && css.includes('z-index: 2'), 'persistent popup footer missing');
ok(css.includes('overflow-wrap: anywhere') && css.includes('word-break: break-word'), 'long meeting URL wrapping missing');
ok(css.includes('body.native-teams-popup .event-preview') && css.includes('overflow: visible'), 'nested event-preview scroll must be disabled in popup');
ok(js.includes('Math.min(680, dialog.scrollHeight + 32)'), 'compact popup height cap missing');
if (manifest.experiment_apis) ok(bg.includes('width: 680') && bg.includes('height: 640'), 'compact initial popup size missing');
console.log('V2.19 popup layout contract: PASS');

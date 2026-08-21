const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "calendar", "calendar.js"), "utf8");
const html = fs.readFileSync(path.join(root, "calendar", "calendar.html"), "utf8");
for (const needle of [
  'contacts.quickSearch(undefined, queryInfo)',
  'browser.addressBooks.list(true)',
  'browser.contacts.list(book.id)',
  'node?.vCard || properties.vCard',
  'attendeeSearchStatus'
]) {
  if (!bg.includes(needle) && !ui.includes(needle) && !html.includes(needle)) throw new Error(`Missing V2.18 autocomplete contract: ${needle}`);
}
console.log("V2.18 attendee autocomplete contract: PASS");

"use strict";

// Small, dependency-free iCalendar parser for meeting invitation metadata.
// It intentionally parses only the fields needed to map an email invitation
// to its Microsoft Graph calendar event.
var M365_ICAL = (() => {
  function unfold(text) {
    return String(text || "").replace(/\r?\n[ \t]/g, "");
  }

  function splitOutsideQuotes(text, delimiter) {
    const result = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') quoted = !quoted;
      if (ch === delimiter && !quoted) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function parseLine(line) {
    let colon = -1;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') quoted = !quoted;
      if (ch === ":" && !quoted) {
        colon = i;
        break;
      }
    }
    if (colon < 0) return null;
    const header = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const parts = splitOutsideQuotes(header, ";");
    const name = String(parts.shift() || "").trim().toUpperCase();
    const params = {};
    for (const item of parts) {
      const eq = item.indexOf("=");
      if (eq < 0) continue;
      const key = item.slice(0, eq).trim().toUpperCase();
      let paramValue = item.slice(eq + 1).trim();
      if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
        paramValue = paramValue.slice(1, -1);
      }
      params[key] = paramValue;
    }
    return { name, params, value };
  }

  function unescapeText(value) {
    return String(value || "")
      .replace(/\\[nN]/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  function cleanMailto(value) {
    return String(value || "").replace(/^mailto:/i, "").trim();
  }

  function parsePerson(prop) {
    if (!prop) return null;
    return {
      name: unescapeText(prop.params?.CN || ""),
      address: cleanMailto(prop.value)
    };
  }

  function parseIcalDate(prop) {
    if (!prop?.value) return null;
    const raw = String(prop.value).trim();
    const tzid = String(prop.params?.TZID || "");
    const valueType = String(prop.params?.VALUE || "").toUpperCase();
    const isDate = valueType === "DATE" || /^\d{8}$/.test(raw);
    const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
    if (!match) return { raw, iso: "", isDate, tzid };

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const second = Number(match[6] || 0);
    let date;
    if (match[7] === "Z") {
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      // Floating/TZID values are kept as wall-clock values. The ISO value is
      // used only to create a broad Graph search window, so exact zone
      // conversion is not required here.
      date = new Date(year, month, day, hour, minute, second);
    }
    return {
      raw,
      iso: Number.isNaN(date.getTime()) ? "" : date.toISOString(),
      isDate,
      tzid
    };
  }

  function parseInvitation(text) {
    const normalized = unfold(text).replace(/^\uFEFF/, "");
    if (!/BEGIN:VCALENDAR/i.test(normalized) || !/BEGIN:VEVENT/i.test(normalized)) return null;

    const lines = normalized.split(/\r?\n/);
    let method = "";
    let inEvent = false;
    const props = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const prop = parseLine(line);
      if (!prop) continue;
      if (!inEvent && prop.name === "METHOD") method = String(prop.value || "").trim().toUpperCase();
      if (prop.name === "BEGIN" && String(prop.value).toUpperCase() === "VEVENT") {
        inEvent = true;
        continue;
      }
      if (prop.name === "END" && String(prop.value).toUpperCase() === "VEVENT") break;
      if (inEvent) props.push(prop);
    }

    if (!props.length) return null;
    const first = name => props.find(p => p.name === name) || null;
    const all = name => props.filter(p => p.name === name);
    const uid = String(first("UID")?.value || "").trim();
    const summary = unescapeText(first("SUMMARY")?.value || "");
    const location = unescapeText(first("LOCATION")?.value || "");
    const description = unescapeText(first("DESCRIPTION")?.value || "");
    const organizer = parsePerson(first("ORGANIZER"));
    const attendees = all("ATTENDEE").map(parsePerson).filter(Boolean);
    const start = parseIcalDate(first("DTSTART"));
    const end = parseIcalDate(first("DTEND"));
    const recurrenceId = parseIcalDate(first("RECURRENCE-ID"));
    const status = String(first("STATUS")?.value || "").trim().toUpperCase();
    const sequence = Number(first("SEQUENCE")?.value || 0);

    return {
      method: method || "REQUEST",
      uid,
      summary,
      location,
      description,
      organizer,
      attendees,
      start,
      end,
      recurrenceId,
      status,
      sequence: Number.isFinite(sequence) ? sequence : 0
    };
  }

  function normalizeForCompare(value) {
    return String(value || "").trim().toLowerCase();
  }

  return Object.freeze({
    parseInvitation,
    parseIcalDate,
    normalizeForCompare,
    unfold
  });
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = M365_ICAL;
}

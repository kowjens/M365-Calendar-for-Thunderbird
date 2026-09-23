"use strict";

const $ = id => document.getElementById(id);
const LAUNCH_PARAMS = new URLSearchParams(window.location.search);
const NATIVE_TEAMS_POPUP = LAUNCH_PARAMS.get("nativeTeams") === "1";
const NATIVE_TEAMS_CALENDAR_ID = LAUNCH_PARAMS.get("calendarId") || "";
const NATIVE_TEAMS_START = LAUNCH_PARAMS.get("start") || "";
const NATIVE_EDIT_EVENT_ID = LAUNCH_PARAMS.get("editEventId") || "";
const els = {};
const state = {
  config: null,
  auth: null,
  calendars: [],
  events: [],
  cursor: new Date(),
  selectedEventId: null,
  loading: false,
  sync: null,
  calendarSource: null,
  autoSyncTimer: null,
  editingEventId: null,
  addressBooks: [],
  viewMode: "month"
};

const UI_LOCALE = browser.i18n.getUILanguage() || navigator.language || "de";
const monthFormatter = new Intl.DateTimeFormat(UI_LOCALE, { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat(UI_LOCALE, { weekday: "short", day: "2-digit", month: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat(UI_LOCALE, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat(UI_LOCALE, { hour: "2-digit", minute: "2-digit" });

const EXCHANGE_TIME_ZONES = [
  ["UTC", "UTC"],
  ["GMT Standard Time", "Europe/London — Dublin, Edinburgh, Lisbon, London"],
  ["W. Europe Standard Time", "Europe/Berlin — Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna"],
  ["Romance Standard Time", "Europe/Paris — Brussels, Copenhagen, Madrid, Paris"],
  ["Central Europe Standard Time", "Europe/Budapest — Belgrade, Bratislava, Budapest, Ljubljana, Prague"],
  ["Central European Standard Time", "Europe/Warsaw — Sarajevo, Skopje, Warsaw, Zagreb"],
  ["E. Europe Standard Time", "Europe/Chisinau"],
  ["FLE Standard Time", "Europe/Helsinki — Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius"],
  ["GTB Standard Time", "Europe/Athens — Athens, Bucharest"],
  ["Turkey Standard Time", "Europe/Istanbul"],
  ["Russian Standard Time", "Europe/Moscow"],
  ["Israel Standard Time", "Asia/Jerusalem"],
  ["Arab Standard Time", "Asia/Riyadh — Kuwait, Riyadh"],
  ["Arabian Standard Time", "Asia/Dubai — Abu Dhabi, Muscat"],
  ["India Standard Time", "Asia/Kolkata — Chennai, Kolkata, Mumbai, New Delhi"],
  ["Bangladesh Standard Time", "Asia/Dhaka"],
  ["SE Asia Standard Time", "Asia/Bangkok — Bangkok, Hanoi, Jakarta"],
  ["China Standard Time", "Asia/Shanghai — Beijing, Chongqing, Hong Kong, Urumqi"],
  ["Singapore Standard Time", "Asia/Singapore — Kuala Lumpur, Singapore"],
  ["Tokyo Standard Time", "Asia/Tokyo — Osaka, Sapporo, Tokyo"],
  ["Korea Standard Time", "Asia/Seoul"],
  ["AUS Eastern Standard Time", "Australia/Sydney — Canberra, Melbourne, Sydney"],
  ["E. Australia Standard Time", "Australia/Brisbane"],
  ["Tasmania Standard Time", "Australia/Hobart"],
  ["New Zealand Standard Time", "Pacific/Auckland"],
  ["Atlantic Standard Time", "America/Halifax"],
  ["Eastern Standard Time", "America/New_York — Eastern Time (US & Canada)"],
  ["Central Standard Time", "America/Chicago — Central Time (US & Canada)"],
  ["Mountain Standard Time", "America/Denver — Mountain Time (US & Canada)"],
  ["US Mountain Standard Time", "America/Phoenix — Arizona"],
  ["Pacific Standard Time", "America/Los_Angeles — Pacific Time (US & Canada)"],
  ["Alaskan Standard Time", "America/Anchorage — Alaska"],
  ["Hawaiian Standard Time", "Pacific/Honolulu — Hawaii"],
  ["SA Pacific Standard Time", "America/Bogota — Bogota, Lima, Quito"],
  ["E. South America Standard Time", "America/Sao_Paulo — Brasilia"],
  ["Argentina Standard Time", "America/Argentina/Buenos_Aires"],
  ["Greenland Standard Time", "America/Nuuk"],
  ["Azores Standard Time", "Atlantic/Azores"]
];

function populateTimeZoneSelect(value) {
  if (!els.timeZoneInput) return;
  const selected = String(value || "W. Europe Standard Time").trim() || "W. Europe Standard Time";
  els.timeZoneInput.replaceChildren();
  let found = false;
  for (const [id, label] of EXCHANGE_TIME_ZONES) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${id} · ${label}`;
    option.selected = id === selected;
    if (option.selected) found = true;
    els.timeZoneInput.appendChild(option);
  }
  // Preserve a previously configured Graph/Exchange timezone even when it is
  // not part of the curated list. This avoids silently changing existing setups.
  if (!found && selected) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = `${selected} · ${t("timeZoneCustom")}`;
    option.selected = true;
    els.timeZoneInput.prepend(option);
  }
}

function displayVersion(value) {
  const raw = String(value || "2.0.39");
  const match = raw.match(/^(\d+)\.0\.(\d+)$/);
  return match ? `V${match[1]}.${Number(match[2])}` : `V${raw}`;
}

function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}

function applyI18n() {
  document.documentElement.lang = UI_LOCALE;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  }
}

function updateBuildModeBanner() {
  if (!els.buildModeBanner || !state.auth) return;
  // nativeMode describes the XPI that is installed. nativeCapable describes
  // whether Thunderbird actually loaded the Experiment API. Keeping those two
  // states separate prevents a broken NATIVE provider from being mislabeled
  // as a STANDARD build.
  const packagedNative = Boolean(state.auth.nativeMode);
  const version = displayVersion(state.auth.version || "2.0.39");
  els.buildModeBanner.className = `build-mode-banner ${packagedNative ? "native" : "standard"}`;
  if (packagedNative) {
    const apiLabel = state.auth.nativeCapable
      ? t("nativeApiLoaded")
      : state.auth.nativeProbed
        ? t("nativeApiNotLoaded")
        : t("nativeApiDeferred");
    els.buildModeBanner.textContent = t(
      "buildBannerNativeDetailed",
      [version, apiLabel]
    );
  } else {
    els.buildModeBanner.textContent = t("buildBannerStandardDetailed", version);
  }
}

async function api(action, extra = {}) {
  const result = await browser.runtime.sendMessage({ action, ...extra });
  if (!result?.ok) {
    const error = new Error(result?.error || t("unknownAddonError"));
    error.status = Number(result?.status || 0);
    error.authRequired = Boolean(result?.authRequired);
    throw error;
  }
  return result.data;
}


function diagnosticDateValue(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initializeDiagnosticRange() {
  if (!els.diagnosticStartDate || !els.diagnosticEndDate) return;
  if (!els.diagnosticStartDate.value) {
    const start = new Date();
    start.setDate(start.getDate() - 28);
    els.diagnosticStartDate.value = diagnosticDateValue(start);
  }
  if (!els.diagnosticEndDate.value) {
    const end = new Date();
    end.setDate(end.getDate() + 56);
    els.diagnosticEndDate.value = diagnosticDateValue(end);
  }
}

function diagnosticRangeIso() {
  const startText = String(els.diagnosticStartDate?.value || "");
  const endText = String(els.diagnosticEndDate?.value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startText) || !/^\d{4}-\d{2}-\d{2}$/.test(endText)) {
    throw new Error(t("diagnosticExportDateError"));
  }
  const start = new Date(`${startText}T00:00:00.000Z`);
  const endInclusive = new Date(`${endText}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(endInclusive.getTime()) || endInclusive < start) {
    throw new Error(t("diagnosticExportDateError"));
  }
  const endExclusive = new Date(endInclusive.getTime() + 86400000);
  return { start: start.toISOString(), end: endExclusive.toISOString(), startText, endText };
}

let diagnosticCrcTable = null;
function diagnosticCrc32(bytes) {
  if (!diagnosticCrcTable) {
    diagnosticCrcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      diagnosticCrcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = diagnosticCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function diagnosticZipStamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function diagnosticHeader(size) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

function createDiagnosticZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = diagnosticZipStamp();

  for (const file of files) {
    const nameBytes = encoder.encode(String(file.name || "file.txt").replace(/\\/g, "/"));
    const dataBytes = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data ?? ""));
    const crc = diagnosticCrc32(dataBytes);

    const local = diagnosticHeader(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true); // UTF-8 filenames.
    local.view.setUint16(8, 0, true); // STORE: deterministic and dependency-free.
    local.view.setUint16(10, stamp.dosTime, true);
    local.view.setUint16(12, stamp.dosDate, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, dataBytes.length, true);
    local.view.setUint32(22, dataBytes.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    local.view.setUint16(28, 0, true);
    localParts.push(local.bytes, nameBytes, dataBytes);

    const central = diagnosticHeader(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, stamp.dosTime, true);
    central.view.setUint16(14, stamp.dosDate, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, dataBytes.length, true);
    central.view.setUint32(24, dataBytes.length, true);
    central.view.setUint16(28, nameBytes.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, offset, true);
    centralParts.push(central.bytes, nameBytes);

    offset += local.bytes.length + nameBytes.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = diagnosticHeader(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(4, 0, true);
  end.view.setUint16(6, 0, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);
  end.view.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end.bytes], { type: "application/zip" });
}

function diagnosticJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function diagnosticCsvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function diagnosticComparisonCsv(data) {
  const columns = [
    "status", "match", "graphId", "nativeId", "graphType", "nativeGraphType", "subject",
    "start", "nativeStart", "end", "nativeEnd", "iCalUId", "seriesMasterId", "nativeSeriesMasterId",
    "originalStart", "isCancelled", "changeKey", "nativeMappingVersion", "nativeRecurrenceId"
  ];
  const rows = [...(data?.rows || []), ...(data?.nativeOnly || [])];
  return [columns.join(","), ...rows.map(row => columns.map(key => diagnosticCsvEscape(row?.[key])).join(","))].join("\r\n") + "\r\n";
}

function diagnosticReadme(data) {
  const summary = data?.comparison?.summary || {};
  return [
    "M365 Calendar for Thunderbird V2.39 - diagnostic export",
    "",
    "Purpose:",
    "Compare the Microsoft Graph / M365 Space calendarView with the actual Thunderbird native provider cache.",
    "The export itself does NOT start a native calendar synchronization, so the failing cache state is preserved.",
    "",
    "Important files:",
    "- summary.txt: compact counts and missing/native-only events",
    "- comparison.csv / comparison.json: one row per Graph event plus native-only rows",
    "- series_comparison.json: recurring-series groups and missing instances",
    "- graph_calendarview_raw.json: raw Graph calendarView response rows",
    "- space_snapshot.json: event set used by the M365 Space for the requested range",
    "- space_cache.json: matching add-on offline-cache windows",
    "- native_cache.json: actual Thunderbird provider cache items including mapping/recurrence metadata",
    "- native_calendar.ics: VEVENT representation read from the native Thunderbird cache",
    "- native_range_queries.json: real cache.sqlite range-query results for parent/event occurrence filter masks",
    "- native_diagnostics.json: provider/cache diagnostics",
    "",
    `Graph events: ${Number(summary.graphEvents || 0)}`,
    `Native events: ${Number(summary.nativeEvents || 0)}`,
    `Missing in native: ${Number(summary.missingNative || 0)}`,
    `Native-only: ${Number(summary.nativeOnly || 0)}`,
    `Series with missing instances: ${Number(summary.seriesWithMissingInstances || 0)}`,
    "",
    "Privacy: calendar content and attendee addresses are included. OAuth access/refresh tokens are NOT exported.",
    ""
  ].join("\r\n");
}

function downloadDiagnosticBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function setDiagnosticExportStatus(text = "", kind = "") {
  if (!els.diagnosticExportStatus) return;
  els.diagnosticExportStatus.textContent = text;
  els.diagnosticExportStatus.className = `muted${kind ? ` ${kind}` : ""}`;
}

async function exportCalendarDiagnostics() {
  const button = els.diagnosticExportBtn;
  const calendarId = String(state.config?.selectedCalendarId || els.calendarSelect?.value || "");
  if (!calendarId) {
    toast(t("errorNoCalendarSelected"), "error");
    return;
  }
  let range;
  try { range = diagnosticRangeIso(); }
  catch (error) { setDiagnosticExportStatus(error.message, "error"); return; }

  if (button) button.disabled = true;
  setDiagnosticExportStatus(t("diagnosticExportRunning"));
  try {
    const data = await api("exportCalendarDiagnostics", { calendarId, start: range.start, end: range.end });
    const nativeSnapshot = data?.nativeSnapshot || {};
    const files = [
      { name: "README.txt", data: diagnosticReadme(data) },
      { name: "summary.txt", data: data?.summaryText || "" },
      { name: "metadata.json", data: diagnosticJson(data?.metadata || {}) },
      { name: "graph_calendarview_raw.json", data: diagnosticJson(data?.graphRaw || {}) },
      { name: "space_snapshot.json", data: diagnosticJson(data?.spaceSnapshot || {}) },
      { name: "space_cache.json", data: diagnosticJson(data?.spaceCache || {}) },
      { name: "native_cache.json", data: diagnosticJson({ ...nativeSnapshot, ics: undefined }) },
      { name: "native_calendar.ics", data: String(nativeSnapshot?.ics || "") },
      { name: "native_range_queries.json", data: diagnosticJson(nativeSnapshot?.rangeQueries || {}) },
      { name: "native_diagnostics.json", data: diagnosticJson({ diagnostics: data?.nativeDiagnostics || null, error: data?.nativeError || "", auth: data?.authDiagnostics || null }) },
      { name: "comparison.json", data: diagnosticJson(data?.comparison || {}) },
      { name: "series_comparison.json", data: diagnosticJson(data?.comparison?.series || []) },
      { name: "comparison.csv", data: diagnosticComparisonCsv(data?.comparison || {}) }
    ];
    const zip = createDiagnosticZip(files);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
    downloadDiagnosticBlob(zip, `M365_Calendar_Diagnostics_V2.39_${stamp}.zip`);
    const summary = data?.comparison?.summary || {};
    setDiagnosticExportStatus(t("diagnosticExportDone", [String(summary.graphEvents || 0), String(summary.nativeEvents || 0), String(summary.missingNative || 0)]), "success");
  } catch (error) {
    setDiagnosticExportStatus(t("diagnosticExportFailed", error?.message || String(error)), "error");
  } finally {
    if (button) button.disabled = false;
  }
}


let attendeeSearchTimer = null;
let attendeeSearchSerial = 0;
let attendeeSuggestions = [];
let attendeeSuggestionIndex = -1;

function attendeeTokenInfo() {
  const value = String(els.newAttendees?.value || "");
  const match = value.match(/^(.*?[;,]\s*)?([^;,]*)$/);
  const prefix = match?.[1] || "";
  const token = (match?.[2] || value).trim();
  return { value, prefix, token };
}

function setAttendeeSearchStatus(message = "", kind = "") {
  if (!els.attendeeSearchStatus) return;
  els.attendeeSearchStatus.textContent = message;
  els.attendeeSearchStatus.className = `attendee-search-status${kind ? ` ${kind}` : ""}${message ? "" : " hidden"}`;
}

function hideAttendeeSuggestions({ clearStatus = true } = {}) {
  attendeeSuggestions = [];
  attendeeSuggestionIndex = -1;
  if (els.attendeeSuggestions) {
    els.attendeeSuggestions.replaceChildren();
    els.attendeeSuggestions.classList.add("hidden");
  }
  if (clearStatus) setAttendeeSearchStatus();
}

function chooseAttendeeSuggestion(index) {
  const item = attendeeSuggestions[index];
  if (!item?.email) return;
  const { prefix } = attendeeTokenInfo();
  els.newAttendees.value = `${prefix}${item.email}; `;
  hideAttendeeSuggestions();
  els.newAttendees.focus();
  els.newAttendees.setSelectionRange(els.newAttendees.value.length, els.newAttendees.value.length);
}

function positionAttendeeSuggestions() {
  if (!els.attendeeSuggestions || els.attendeeSuggestions.classList.contains("hidden") || !els.newAttendees) return;
  const rect = els.newAttendees.getBoundingClientRect();
  const gap = 4;
  const availableBelow = Math.max(0, window.innerHeight - rect.bottom - 12);
  const availableAbove = Math.max(0, rect.top - 12);
  const maxHeight = Math.max(100, Math.min(260, Math.max(availableBelow, availableAbove)));
  const placeAbove = availableBelow < 130 && availableAbove > availableBelow;
  els.attendeeSuggestions.style.left = `${Math.max(8, rect.left)}px`;
  els.attendeeSuggestions.style.width = `${Math.max(260, Math.min(rect.width, window.innerWidth - 16))}px`;
  els.attendeeSuggestions.style.maxHeight = `${maxHeight}px`;
  if (placeAbove) {
    els.attendeeSuggestions.style.top = "auto";
    els.attendeeSuggestions.style.bottom = `${Math.max(8, window.innerHeight - rect.top + gap)}px`;
  } else {
    els.attendeeSuggestions.style.bottom = "auto";
    els.attendeeSuggestions.style.top = `${Math.min(window.innerHeight - 80, rect.bottom + gap)}px`;
  }
}

function renderAttendeeSuggestions(items) {
  attendeeSuggestions = Array.isArray(items) ? items : [];
  attendeeSuggestionIndex = -1;
  if (!els.attendeeSuggestions) return;
  els.attendeeSuggestions.replaceChildren();
  if (!attendeeSuggestions.length) {
    els.attendeeSuggestions.classList.add("hidden");
    setAttendeeSearchStatus(t("attendeeSearchNoResults"), "empty");
    return;
  }
  setAttendeeSearchStatus(t("attendeeSearchResultCount", String(attendeeSuggestions.length)), "success");
  attendeeSuggestions.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "attendee-suggestion";
    button.setAttribute("role", "option");
    const name = document.createElement("span");
    name.className = "attendee-suggestion-name";
    name.textContent = item.name || item.email;
    const email = document.createElement("span");
    email.className = "attendee-suggestion-email";
    email.textContent = item.email;
    button.append(name, email);
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => chooseAttendeeSuggestion(index));
    els.attendeeSuggestions.appendChild(button);
  });
  els.attendeeSuggestions.classList.remove("hidden");
  requestAnimationFrame(positionAttendeeSuggestions);
}

function updateAttendeeSuggestionSelection() {
  if (!els.attendeeSuggestions) return;
  [...els.attendeeSuggestions.querySelectorAll(".attendee-suggestion")].forEach((button, index) => {
    button.classList.toggle("selected", index === attendeeSuggestionIndex);
    button.setAttribute("aria-selected", index === attendeeSuggestionIndex ? "true" : "false");
    if (index === attendeeSuggestionIndex) button.scrollIntoView({ block: "nearest" });
  });
}

function scheduleAttendeeSearch() {
  if (attendeeSearchTimer) clearTimeout(attendeeSearchTimer);
  const { token } = attendeeTokenInfo();
  if (token.length < 2) {
    hideAttendeeSuggestions();
    return;
  }
  const serial = ++attendeeSearchSerial;
  attendeeSearchTimer = setTimeout(async () => {
    attendeeSearchTimer = null;
    setAttendeeSearchStatus(t("attendeeSearchSearching"));
    try {
      const items = await api("searchContacts", { query: token });
      if (serial !== attendeeSearchSerial || attendeeTokenInfo().token !== token) return;
      renderAttendeeSuggestions(items);
    } catch (error) {
      console.warn("M365 contact autocomplete unavailable", error);
      hideAttendeeSuggestions({ clearStatus: false });
      setAttendeeSearchStatus(t("attendeeSearchUnavailable", error.message || String(error)), "error");
    }
  }, 110);
}

function handleAttendeeSuggestionKeydown(event) {
  if (!attendeeSuggestions.length || els.attendeeSuggestions?.classList.contains("hidden")) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    attendeeSuggestionIndex = (attendeeSuggestionIndex + 1) % attendeeSuggestions.length;
    updateAttendeeSuggestionSelection();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    attendeeSuggestionIndex = attendeeSuggestionIndex <= 0 ? attendeeSuggestions.length - 1 : attendeeSuggestionIndex - 1;
    updateAttendeeSuggestionSelection();
  } else if (event.key === "Enter" && attendeeSuggestionIndex >= 0) {
    event.preventDefault();
    chooseAttendeeSuggestion(attendeeSuggestionIndex);
  } else if (event.key === "Escape") {
    hideAttendeeSuggestions();
  }
}

async function fitNativeTeamsPopup() {
  if (!NATIVE_TEAMS_POPUP || !browser.windows?.getCurrent || !browser.windows?.update) return;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const dialog = els.newEventDialog?.open ? els.newEventDialog : (els.eventDialog?.open ? els.eventDialog : els.newEventDialog);
  if (!dialog) return;

  const availWidth = Math.max(420, Number(window.screen?.availWidth) || 900);
  const availHeight = Math.max(420, Number(window.screen?.availHeight) || 700);
  const maxWidth = Math.max(420, availWidth - 56);
  const maxHeight = Math.max(500, availHeight - 72);

  // Keep the window compact. Long event bodies/forms scroll in the dialog body,
  // while header and action footer stay visible.
  const desiredWidth = Math.min(700, maxWidth);
  const naturalHeight = Math.max(540, Math.min(680, dialog.scrollHeight + 32));
  const desiredHeight = Math.min(naturalHeight, maxHeight);

  try {
    const current = await browser.windows.getCurrent();
    if (current?.id !== undefined) {
      await browser.windows.update(current.id, {
        width: Math.round(desiredWidth),
        height: Math.round(desiredHeight)
      });
    }
  } catch (error) {
    console.warn("M365 Teams popup could not be fitted to the screen", error);
  }
}

function toast(message, type = "") {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`.trim();
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add("hidden"), 4200);
}

function setBusy(busy) {
  state.loading = busy;
  for (const id of ["prevBtn", "todayBtn", "nextBtn", "refreshBtn", "newEventBtn", "calendarSelect"]) {
    if (els[id]) els[id].disabled = busy;
  }
  if (busy) els.syncInfo.textContent = t("syncing");
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseGraphDate(value) {
  if (!value) return null;
  return new Date(value);
}

function eventStart(event) {
  return parseGraphDate(event?.start?.dateTime);
}

function eventEnd(event) {
  return parseGraphDate(event?.end?.dateTime);
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfGrid(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const jsDay = first.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  first.setHours(0, 0, 0, 0);
  return first;
}

function endOfGrid(monthDate) {
  const start = startOfGrid(monthDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 42);
  return end;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function visibleRange() {
  const mode = state.viewMode || "month";
  if (mode === "week") {
    const start = startOfWeek(state.cursor);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (mode === "day") {
    const start = startOfDay(state.cursor);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (mode === "agenda") {
    const start = startOfDay(state.cursor);
    const end = new Date(start); end.setDate(end.getDate() + 30);
    return { start, end };
  }
  return { start: startOfGrid(state.cursor), end: endOfGrid(state.cursor) };
}

function shiftCursor(direction) {
  const d = new Date(state.cursor);
  if (state.viewMode === "week") d.setDate(d.getDate() + direction * 7);
  else if (state.viewMode === "day") d.setDate(d.getDate() + direction);
  else if (state.viewMode === "agenda") d.setDate(d.getDate() + direction * 30);
  else d.setMonth(d.getMonth() + direction);
  state.cursor = d;
}

function viewTitle() {
  const mode = state.viewMode || "month";
  if (mode === "day") return new Intl.DateTimeFormat(UI_LOCALE, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(state.cursor);
  if (mode === "week") {
    const start = startOfWeek(state.cursor);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const short = new Intl.DateTimeFormat(UI_LOCALE, { day: "2-digit", month: "2-digit" });
    return `${t("viewWeek")} · ${short.format(start)} – ${short.format(end)}`;
  }
  if (mode === "agenda") {
    const { start, end } = visibleRange();
    const last = new Date(end); last.setDate(last.getDate() - 1);
    const short = new Intl.DateTimeFormat(UI_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${t("viewAgenda")} · ${short.format(start)} – ${short.format(last)}`;
  }
  return monthFormatter.format(state.cursor);
}

function updateViewSwitch() {
  for (const button of document.querySelectorAll(".view-mode-btn")) {
    button.classList.toggle("active", button.dataset.view === state.viewMode);
    button.setAttribute("aria-pressed", button.dataset.view === state.viewMode ? "true" : "false");
  }
}

function currentEvent() {
  return state.events.find(event => event.id === state.selectedEventId) || null;
}

function responseLabel(response) {
  const labels = {
    organizer: t("responseOrganizer"),
    accepted: t("responseAccepted"),
    tentative: t("responseTentative"),
    declined: t("responseDeclined"),
    none: t("responseNone"),
    notResponded: t("responseNotResponded")
  };
  return labels[response] || response || t("unknown");
}

function getJoinUrl(event) {
  if (globalThis.M365_NATIVE?.extractTeamsJoinUrl) {
    return globalThis.M365_NATIVE.extractTeamsJoinUrl(event);
  }
  return event?.onlineMeeting?.joinUrl || event?.onlineMeetingUrl || "";
}

function isRecurringEvent(event) {
  return Boolean(event?.seriesMasterId || event?.recurrence || ["seriesMaster", "occurrence", "exception"].includes(event?.type));
}

function formatEventTime(event) {
  const start = eventStart(event);
  const end = eventEnd(event);
  if (!start || !end) return "";
  if (event.isAllDay) return t("allDay");
  if (sameDay(start, end)) return `${dateTimeFormatter.format(start)} – ${timeFormatter.format(end)}`;
  return `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)}`;
}

function createLink(label, url, className = "") {
  const a = document.createElement("a");
  a.textContent = label;
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  if (className) a.className = className;
  return a;
}

async function loadState() {
  state.config = await api("getConfig");
  state.viewMode = ["month", "week", "day", "agenda"].includes(state.config?.spaceViewMode) ? state.config.spaceViewMode : "month";
  state.auth = await api("authStatus");
  updateHeader();
  updateBuildModeBanner();
  if (!state.auth.loggedIn) {
    showWelcome();
    return;
  }
  await loadCalendarsAndEvents();
}

function updateHeader() {
  const profile = state.auth?.profile;
  if (state.auth?.loggedIn && profile) {
    const address = profile.mail || profile.userPrincipalName || "Microsoft 365";
    els.accountBadge.textContent = profile.displayName ? `${profile.displayName} · ${address}` : address;
  } else if (state.auth?.loggedIn) {
    els.accountBadge.textContent = t("connected");
  } else {
    els.accountBadge.textContent = t("notSignedIn");
  }
}

function showWelcome() {
  els.calendarApp.classList.add("hidden");
  els.welcomePanel.classList.remove("hidden");
  if (!state.auth?.configured) {
    els.welcomeText.textContent = t("welcomeNeedsConfig");
    els.welcomeLoginBtn.disabled = true;
  } else {
    els.welcomeText.textContent = t("welcomeReady");
    els.welcomeLoginBtn.disabled = false;
  }
}

function showCalendar() {
  els.welcomePanel.classList.add("hidden");
  els.calendarApp.classList.remove("hidden");
}

async function loadCalendarsAndEvents() {
  setBusy(true);
  try {
    const calendarResult = await api("listCalendarsCached");
    state.calendars = calendarResult.calendars || [];
    state.calendarSource = calendarResult;
    if (!state.calendars.length) throw new Error(t("noCalendars"));
    let selected = state.config.selectedCalendarId;
    if (!state.calendars.some(c => c.id === selected)) selected = state.calendars[0].id;
    state.config.selectedCalendarId = selected;
    await api("saveConfig", { config: { selectedCalendarId: selected } });
    renderCalendarSelector();
    showCalendar();
    await loadEvents();
  } catch (error) {
    if (error.status === 401 || error.authRequired) {
      state.auth = await api("authStatus");
      updateHeader();
      showWelcome();
    }
    toast(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderCalendarSelector() {
  els.calendarSelect.replaceChildren();
  for (const calendar of state.calendars) {
    const option = document.createElement("option");
    option.value = calendar.id;
    option.textContent = `${calendar.name || t("calendarFallback")}${calendar.isShared ? ` · ${t("sharedShort")}` : ""}`;
    if (calendar.isShared) option.classList.add("shared-calendar");
    option.selected = calendar.id === state.config.selectedCalendarId;
    els.calendarSelect.appendChild(option);
  }
}

function formatSyncInfo(sync) {
  if (!sync) return "";
  const when = sync.lastSyncAt ? timeFormatter.format(new Date(sync.lastSyncAt)) : t("unknown");
  if (sync.source === "cache" || sync.offline) return t("syncInfoOffline", when);
  if (sync.mode === "full" || sync.mode === "full-secondary") {
    const loaded = String(sync.changes?.loaded ?? state.events.length);
    let text = sync.mode === "full-secondary"
      ? t("syncInfoFullSecondary", [when, loaded])
      : t("syncInfoFull", [when, loaded]);
    const hydrated = Number(sync.changes?.hydrated || 0);
    const unresolved = Number(sync.changes?.unresolved || 0);
    const missing = Number(sync.changes?.missingSubjects || 0);
    if (hydrated || unresolved || missing) {
      text += ` · ${t("syncDetailHealth", [String(hydrated), String(unresolved), String(missing)])}`;
    }
    return text;
  }
  const changes = sync.changes || {};
  let text = t("syncInfoDelta", [when, String(changes.added || 0), String(changes.updated || 0), String(changes.removed || 0)]);
  if (sync.recoveredFromStaleToken) text += ` · ${t("syncTokenRecovered")}`;
  return text;
}

function stopAutoSync() {
  if (state.autoSyncTimer) clearInterval(state.autoSyncTimer);
  state.autoSyncTimer = null;
}

function restartAutoSync() {
  stopAutoSync();
  const minutes = Number(state.config?.autoSyncMinutes || 0);
  if (!state.auth?.loggedIn || minutes <= 0) return;
  state.autoSyncTimer = setInterval(() => {
    if (!state.loading && document.visibilityState !== "hidden") loadEvents({ quiet: true });
  }, Math.max(1, minutes) * 60 * 1000);
}

async function loadEvents({ forceFull = false, quiet = false } = {}) {
  if (!state.config?.selectedCalendarId) return;
  setBusy(true);
  try {
    const { start, end } = visibleRange();
    const result = await api("getEvents", {
      calendarId: state.config.selectedCalendarId,
      start: start.toISOString(),
      end: end.toISOString(),
      forceFull
    });
    state.events = result.events || [];
    state.sync = result.sync || null;
    renderAll();
    els.syncInfo.textContent = formatSyncInfo(state.sync);
    if (state.sync?.offline && !quiet) toast(t("offlineCacheNotice"), "");
    restartAutoSync();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderAll() {
  els.monthTitle.textContent = viewTitle();
  updateViewSwitch();
  const isMonth = state.viewMode === "month";
  const isAgenda = state.viewMode === "agenda";
  els.monthViewContainer?.classList.toggle("hidden", !isMonth);
  els.periodView?.classList.toggle("hidden", isMonth || isAgenda);
  els.calendarPanel?.classList.toggle("hidden", isAgenda);
  document.querySelector(".content-grid")?.classList.toggle("agenda-only", isAgenda);
  if (isMonth) renderMonthGrid();
  else if (!isAgenda) renderPeriodView();
  renderAgenda();
}

function eventsInRange(start, end) {
  return state.events.filter(event => {
    const value = eventStart(event);
    return value && value >= start && value < end;
  }).sort((a, b) => (eventStart(a)?.getTime() || 0) - (eventStart(b)?.getTime() || 0));
}

function renderPeriodView() {
  if (!els.periodView) return;
  els.periodView.replaceChildren();
  const dayStarts = [];
  if (state.viewMode === "week") {
    const start = startOfWeek(state.cursor);
    for (let i = 0; i < 7; i += 1) { const d = new Date(start); d.setDate(d.getDate() + i); dayStarts.push(d); }
  } else {
    dayStarts.push(startOfDay(state.cursor));
  }
  els.periodView.className = `period-view ${state.viewMode === "week" ? "week-view" : "day-view"}`;
  for (const day of dayStarts) {
    const end = new Date(day); end.setDate(end.getDate() + 1);
    const column = document.createElement("section");
    column.className = "period-day";
    const heading = document.createElement("button");
    heading.type = "button"; heading.className = "period-day-title";
    heading.textContent = dayFormatter.format(day);
    heading.addEventListener("click", async () => { state.cursor = new Date(day); state.viewMode = "day"; await api("saveConfig", { config: { spaceViewMode: "day" } }); await loadEvents(); });
    column.appendChild(heading);
    const events = eventsInRange(day, end);
    if (!events.length) {
      const empty = document.createElement("div"); empty.className = "period-empty"; empty.textContent = t("noEventsDay"); column.appendChild(empty);
    } else {
      for (const event of events) {
        const card = document.createElement("button"); card.type = "button"; card.className = "period-event"; card.addEventListener("click", () => openEvent(event.id));
        const time = document.createElement("span"); time.className = "period-event-time"; time.textContent = event.isAllDay ? t("allDay") : timeFormatter.format(eventStart(event));
        const subject = document.createElement("strong"); subject.textContent = event.subject || t("noSubject");
        const meta = document.createElement("small");
        const bits = []; if (getJoinUrl(event)) bits.push("Teams"); if (event.location?.displayName) bits.push(event.location.displayName);
        meta.textContent = bits.join(" · ");
        card.append(time, subject, meta); column.appendChild(card);
      }
    }
    els.periodView.appendChild(column);
  }
}

function eventsByStartDate() {
  const map = new Map();
  for (const event of state.events) {
    const start = eventStart(event);
    if (!start) continue;
    const key = localDateKey(start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  }
  for (const values of map.values()) values.sort((a, b) => eventStart(a) - eventStart(b));
  return map;
}

function renderMonthGrid() {
  els.monthGrid.replaceChildren();
  const byDay = eventsByStartDate();
  const start = startOfGrid(state.cursor);
  const today = new Date();

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (date.getMonth() !== state.cursor.getMonth()) cell.classList.add("other-month");
    if (sameDay(date, today)) cell.classList.add("today");

    const number = document.createElement("div");
    number.className = "day-number";
    const n = document.createElement("span");
    n.textContent = String(date.getDate());
    number.appendChild(n);
    cell.appendChild(number);

    const dayEvents = byDay.get(localDateKey(date)) || [];
    const maxVisible = 4;
    for (const event of dayEvents.slice(0, maxVisible)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "event-chip";
      if (getJoinUrl(event)) chip.classList.add("teams");
      if (event.isCancelled) chip.classList.add("cancelled");
      const startTime = event.isAllDay ? "" : `${timeFormatter.format(eventStart(event))} `;
      const recurring = isRecurringEvent(event) ? "↻ " : "";
      chip.textContent = `${startTime}${recurring}${event.subject || t("noSubject")}`;
      chip.title = `${event.subject || t("noSubject")}\n${formatEventTime(event)}`;
      chip.addEventListener("click", () => openEvent(event.id));
      cell.appendChild(chip);
    }
    if (dayEvents.length > maxVisible) {
      const more = document.createElement("div");
      more.className = "more-events";
      more.textContent = t("moreEvents", String(dayEvents.length - maxVisible));
      cell.appendChild(more);
    }
    els.monthGrid.appendChild(cell);
  }
}

function renderAgenda() {
  els.agendaList.replaceChildren();
  els.agendaTitle.textContent = viewTitle();
  const { start: rangeStart, end: rangeEnd } = visibleRange();
  const events = eventsInRange(rangeStart, rangeEnd);

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.viewMode === "month" ? t("noEventsMonth") : t("noEventsPeriod");
    els.agendaList.appendChild(empty);
    return;
  }

  let previousKey = "";
  for (const event of events) {
    const start = eventStart(event);
    const key = localDateKey(start);
    if (key !== previousKey) {
      const head = document.createElement("div");
      head.className = "agenda-day";
      head.textContent = dayFormatter.format(start);
      els.agendaList.appendChild(head);
      previousKey = key;
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "agenda-item";
    item.addEventListener("click", () => openEvent(event.id));

    const time = document.createElement("div");
    time.className = "agenda-time";
    time.textContent = event.isAllDay ? t("dayShort") : timeFormatter.format(start);

    const content = document.createElement("div");
    const subject = document.createElement("div");
    subject.className = "agenda-subject";
    subject.textContent = event.subject || t("noSubject");
    const meta = document.createElement("div");
    meta.className = "agenda-meta";
    const bits = [];
    if (getJoinUrl(event)) bits.push("Teams");
    if (isRecurringEvent(event)) bits.push(t("recurring"));
    if (event.location?.displayName) bits.push(event.location.displayName);
    if (!event.isOrganizer) bits.push(responseLabel(event.responseStatus?.response));
    meta.textContent = bits.join(" · ");
    content.append(subject, meta);
    item.append(time, content);
    els.agendaList.appendChild(item);
  }
}

function attendeeDisplay(attendee) {
  const email = attendee?.emailAddress || {};
  const label = email.name ? `${email.name} · ${email.address || ""}` : (email.address || t("unknown"));
  return `${label} — ${responseLabel(attendee?.status?.response)}`;
}

function reminderLabel(event) {
  if (!event?.isReminderOn) return t("reminderNone");
  const minutes = Number(event?.reminderMinutesBeforeStart || 0);
  if (minutes === 0) return t("reminderAtStart");
  if (minutes === 1440) return t("reminderOneDay");
  return t("reminderMinutes", String(minutes));
}

function eventIsEditable(event) {
  return Boolean(event && !event.isCancelled && (event.isOrganizer || !event.organizer?.emailAddress?.address));
}

function openEvent(eventId) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;
  state.selectedEventId = eventId;
  els.eventTitle.textContent = event.subject || t("noSubject");
  const eventKinds = [];
  eventKinds.push(event.isOnlineMeeting || getJoinUrl(event) ? t("teamsMeeting") : t("calendarEvent"));
  if (isRecurringEvent(event)) eventKinds.push(t("recurring"));
  els.eventSubline.textContent = event.isCancelled ? t("cancelled") : eventKinds.join(" · ");
  els.eventTime.textContent = formatEventTime(event) || t("noneDash");
  els.eventLocation.textContent = event.location?.displayName || t("noneDash");
  const org = event.organizer?.emailAddress;
  els.eventOrganizer.textContent = org ? (org.name ? `${org.name} · ${org.address || ""}` : org.address || t("noneDash")) : t("noneDash");
  els.eventStatus.textContent = event.isOrganizer ? t("organizer") : responseLabel(event.responseStatus?.response);
  els.eventAttendees.replaceChildren();
  const attendeeList = event.attendees || [];
  if (!attendeeList.length) {
    els.eventAttendees.textContent = t("noneDash");
  } else {
    const box = document.createElement("div");
    box.className = "attendee-status-list";
    for (const attendee of attendeeList) {
      const line = document.createElement("div");
      line.className = "attendee-status-line";
      line.textContent = attendeeDisplay(attendee);
      box.appendChild(line);
    }
    els.eventAttendees.appendChild(box);
  }
  els.eventCategories.textContent = (event.categories || []).join(", ") || t("noneDash");
  els.eventReminder.textContent = reminderLabel(event);
  els.eventPreview.textContent = event.body?.content || event.bodyPreview || t("noDescription");
  els.responseComment.value = "";
  els.sendResponseCheck.checked = true;

  els.eventLinks.replaceChildren();
  const joinUrl = getJoinUrl(event);
  if (joinUrl) els.eventLinks.appendChild(createLink(t("joinTeams"), joinUrl, "teams-link"));
  if (event.webLink) els.eventLinks.appendChild(createLink(t("openOutlook"), event.webLink));

  const canRespond = !event.isOrganizer && !event.isCancelled;
  els.responseButtons.classList.toggle("hidden", !canRespond);
  els.responseCommentWrap.classList.toggle("hidden", !canRespond);
  els.sendResponseWrap.classList.toggle("hidden", !canRespond);
  els.eventOwnerButtons.classList.toggle("hidden", !eventIsEditable(event));
  els.eventDialog.showModal();
}

async function respondToEvent(response) {
  const event = currentEvent();
  if (!event) return;
  const buttons = els.responseButtons.querySelectorAll("button");
  buttons.forEach(button => button.disabled = true);
  try {
    await api("respondEvent", {
      eventId: event.id,
      response,
      comment: els.responseComment.value.trim(),
      sendResponse: els.sendResponseCheck.checked
    });
    els.eventDialog.close();
    toast(response === "accept" ? t("toastAccepted") : response === "decline" ? t("toastDeclined") : t("toastTentative"), "success");
    await loadEvents();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

async function openSettings() {
  state.config = await api("getConfig");
  state.auth = await api("authStatus");
  els.clientIdInput.value = state.config.clientId || "";
  els.tenantInput.value = state.config.tenant || "";
  populateTimeZoneSelect(state.config.timeZone || "W. Europe Standard Time");
  els.autoSyncMinutesInput.value = String(state.config.autoSyncMinutes ?? 5);
  els.nativeIntegrationCheck.checked = state.config.nativeIntegration !== false;
  els.nativeDaysBeforeInput.value = String(state.config.nativeDaysBefore ?? 90);
  els.nativeDaysAfterInput.value = String(state.config.nativeDaysAfter ?? 365);
  els.confirmOutgoingMessagesCheck.checked = state.config.confirmOutgoingMessages !== false;
  els.nativeIntegrationBox.classList.remove("hidden");
  await populateAddressBookSelection();
  els.redirectUriInput.value = state.auth.redirectUri || "";
  els.loginStateText.textContent = state.auth.loggedIn
    ? (state.auth.profile?.userPrincipalName ? t("signedInAs", state.auth.profile.userPrincipalName) : t("signedIn"))
    : t("notSignedInMicrosoft");
  els.logoutBtn.disabled = !state.auth.loggedIn;
  els.fullSyncBtn.disabled = !state.auth.loggedIn || !state.config.selectedCalendarId;
  initializeDiagnosticRange();
  if (els.diagnosticExportBtn) els.diagnosticExportBtn.disabled = !state.auth.loggedIn || !state.config.selectedCalendarId || !state.auth.nativeMode;
  setDiagnosticExportStatus();
  await refreshCacheInfo();
  // V2.24: probe/activate the native bridge before rendering the build-info
  // label. V2.21 rendered state.auth.nativeCapable first and therefore showed
  // "native API/provider not loaded" after restart even when the subsequent
  // refresh successfully loaded and registered the provider.
  await refreshNativeStatus();
  const distribution = state.auth.preconfigured
    ? t("buildInfoInternal", displayVersion(state.auth.version || "2.0.39"))
    : t("buildInfoGithub", displayVersion(state.auth.version || "2.0.39"));
  const mode = state.auth.nativeMode ? t("nativeBuildTitle") : t("standardBuildTitle");
  const apiState = state.auth.nativeMode
    ? (state.auth.nativeCapable ? t("nativeApiLoaded") : t("nativeApiNotLoaded"))
    : "";
  els.buildInfo.textContent = `${distribution} · ${mode}${apiState ? ` · ${apiState}` : ""}`;
  els.settingsDialog.showModal();
}

async function saveSettings() {
  const previousClientId = state.config?.clientId || "";
  const previousTenant = state.config?.tenant || "";
  const config = await api("saveConfig", {
    config: {
      clientId: els.clientIdInput.value,
      tenant: els.tenantInput.value,
      timeZone: els.timeZoneInput.value,
      autoSyncMinutes: els.autoSyncMinutesInput.value,
      nativeIntegration: els.nativeIntegrationCheck.checked,
      nativeDaysBefore: els.nativeDaysBeforeInput.value,
      nativeDaysAfter: els.nativeDaysAfterInput.value,
      contactAddressBookIds: selectedAddressBookIdsFromUi(),
      confirmOutgoingMessages: els.confirmOutgoingMessagesCheck.checked
    }
  });
  state.config = config;
  if ((previousClientId && previousClientId !== config.clientId) || (previousTenant && previousTenant !== config.tenant)) {
    await api("logout");
    state.auth = await api("authStatus");
    updateHeader();
    toast(t("configChangedRelogin"));
  } else {
    if (state.auth?.nativeMode) {
      if (state.auth?.loggedIn && config.nativeIntegration) {
        // V2.16: use the proven direct-cache-push path immediately when the
        // user enables/saves native integration.
        try { await api("syncNativeCalendars"); } catch (error) { console.warn(error); }
      } else {
        try { await api("ensureNativeCalendars", { synchronize: false }); } catch (_) {}
      }
    }
    toast(t("settingsSaved"), "success");
  }
  restartAutoSync();
  await refreshNativeStatus();
}

async function refreshCacheInfo() {
  try {
    const stats = await api("syncCacheStats");
    const when = stats.lastSyncAt ? dateTimeFormatter.format(new Date(stats.lastSyncAt)) : t("never");
    els.cacheInfo.textContent = t("cacheStats", [String(stats.windows || 0), String(stats.events || 0), when]);
  } catch (_) {
    els.cacheInfo.textContent = t("cacheStatsUnavailable");
  }
}

function renderNativeDiagnostics(status) {
  if (!els.nativeDebugText) return;
  const diag = status?.diagnostics || {};
  const auto = status?.autoEnsure || {};
  const lines = [
    `build=${state.auth?.nativeMode ? "NATIVE" : "STANDARD"} ${state.auth?.version || "2.0.39"}`,
    `experiment=${status?.available ? "loaded" : "not-loaded"}`,
    `providerRuntime=${diag.providerModuleLoaded ? "loaded" : "not-loaded"}`,
    `providerType=${diag.providerType || "-"}`,
    `calendarStartup=${diag.calendarStartupReady ? "ready" : "not-ready"}`,
    `managerProvider=${diag.managerProviderRegistered ? "registered" : "not-registered"}`,
    `uiProvider=${diag.uiProviderRegistered ? "registered" : "not-registered"}`,
    `tbCalendars=${Number(diag.registeredCalendarCount || 0)}`,
    `autoEnsure=${auto.attempted ? (auto.ok ? "ok" : "failed") : "not-run"}`,
    `graphCalendars=${Number(auto.graphCalendarCount || 0)}`,
    `registered=${Number(auto.registeredCount || 0)}`,
    `authLoggedIn=${status?.loggedIn ? "yes" : "no"}`,
    `authNeedsInteraction=${status?.authDiagnostics?.requiresInteraction ? "yes" : "no"}`,
    `authHasAccessToken=${status?.authDiagnostics?.hasAccessToken ? "yes" : "no"}`,
    `authHasRefreshToken=${status?.authDiagnostics?.hasRefreshToken ? "yes" : "no"}`,
    `exchangeTimeZone=${state.config?.timeZone || "W. Europe Standard Time"}`,
    `nativeTimeTransport=UTC`,
  ];
  if (status?.authDiagnostics?.expiresInSeconds != null) lines.push(`authExpiresIn=${status.authDiagnostics.expiresInSeconds}s`);
  if (status?.authDiagnostics?.lastAuthError) lines.push(`authLastError=${status.authDiagnostics.lastAuthError}`);
  if (status?.authDiagnostics?.lastSilentAuthError) lines.push(`authSilentError=${status.authDiagnostics.lastSilentAuthError}`);
  if (diag.mailIdentityCount != null) lines.push(`mailIdentities=${Number(diag.mailIdentityCount || 0)}`);
  if (diag.addressBookDiagnostics) {
    const ab = diag.addressBookDiagnostics;
    lines.push(`addressBookBackend=${ab.backend || "-"}`);
    lines.push(`addressBookDirectories=${Number(ab.directoryCount || 0)}`);
    lines.push(`addressBookCards=${Number(ab.cardCount || 0)}`);
    lines.push(`addressBookLastQuery=${ab.lastQuery || "-"}`);
    lines.push(`addressBookLastResults=${Number(ab.lastResultCount || 0)}`);
    if (ab.autocompleteAddrbookCount != null) lines.push(`addressBookAutocomplete=${Number(ab.autocompleteAddrbookCount || 0)}`);
    if (ab.asyncDirectoryCount != null) lines.push(`addressBookAsyncDirectories=${Number(ab.asyncDirectoryCount || 0)}`);
    if (ab.asyncDirectoryResultCount != null) lines.push(`addressBookAsyncResults=${Number(ab.asyncDirectoryResultCount || 0)}`);
    if (ab.asyncDirectoryTimeouts != null) lines.push(`addressBookAsyncTimeouts=${Number(ab.asyncDirectoryTimeouts || 0)}`);
    for (const dir of ab.asyncDirectories || []) {
      lines.push(`addressBookAsync[${dir.name || "?"}]=${Number(dir.cardCount || 0)}${dir.timedOut ? ",timeout" : ""}`);
    }
    if (ab.lastError) lines.push(`addressBookError=${ab.lastError}`);
  }
  for (const cal of diag.calendarDetails || []) {
    lines.push(`calendar[${cal.name || cal.id || "?"}].type=${cal.type || "-"}`);
    lines.push(`calendar[${cal.name || cal.id || "?"}].forceDisabled=${cal.forceDisabled ? "yes" : "no"}`);
    lines.push(`calendar[${cal.name || cal.id || "?"}].identityDisabled=${String(cal.imipIdentityDisabled)}`);
    lines.push(`calendar[${cal.name || cal.id || "?"}].identity=${cal.identityEmail || cal.identityKey || "-"}`);
  }
  const providerStartup = status?.providerStartup || {};
  if (providerStartup.lastReason) lines.push(`providerStartupReason=${providerStartup.lastReason}`);
  lines.push(`providerStartupAttempted=${providerStartup.attempted ? "yes" : "no"}`);
  lines.push(`providerStartupActivated=${providerStartup.activated ? "yes" : "no"}`);
  if (providerStartup.lastError) lines.push(`providerStartupError=${providerStartup.lastError}`);
  const autoSync = status?.autoSync || {};
  lines.push(`autoSyncRunning=${autoSync.running ? "yes" : "no"}`);
  if (autoSync.timer) lines.push(`autoSyncScheduled=yes`);
  if (autoSync.scheduledAt) lines.push(`autoSyncScheduledAt=${autoSync.scheduledAt}`);
  if (autoSync.lastReason) lines.push(`autoSyncReason=${autoSync.lastReason}`);
  if (autoSync.lastStartedAt) lines.push(`autoSyncStarted=${autoSync.lastStartedAt}`);
  if (autoSync.lastFinishedAt) lines.push(`autoSyncFinished=${autoSync.lastFinishedAt}`);
  lines.push(`autoSyncCalendars=${Number(autoSync.lastSynchronized || 0)}`);
  if (autoSync.lastError) lines.push(`autoSyncError=${autoSync.lastError}`);
  if (diag.providerLoadError) lines.push(`providerLoadError=${diag.providerLoadError}`);
  if (diag.providerRegistrationError) lines.push(`providerRegistrationError=${diag.providerRegistrationError}`);
  if (auto.error) lines.push(`autoEnsureError=${auto.error}`);
  const sync = diag.syncStats || {};
  if (sync.lastStartedAt) lines.push(`syncStarted=${sync.lastStartedAt}`);
  if (sync.lastFinishedAt) lines.push(`syncFinished=${sync.lastFinishedAt}`);
  lines.push(`syncMode=${sync.mode || "-"}`);
  lines.push(`syncGraphEvents=${Number(sync.graphEvents || 0)}`);
  lines.push(`syncCacheWrites=${Number(sync.cacheWrites || 0)}`);
  lines.push(`syncCacheAdds=${Number(sync.cacheAdds || 0)}`);
  lines.push(`syncCacheModifies=${Number(sync.cacheModifies || 0)}`);
  lines.push(`syncCacheDeletes=${Number(sync.cacheDeletes || 0)}`);
  lines.push(`syncCacheUnchanged=${Number(sync.cacheUnchanged || 0)}`);
  lines.push(`syncCacheMappingRepairs=${Number(sync.cacheMappingRepairs || 0)}`);
  lines.push(`syncCacheVisibilityRepairs=${Number(sync.cacheVisibilityRepairs || 0)}`);
  lines.push(`syncCacheItems=${Number(sync.cacheItems || 0)}`);
  lines.push(`syncGraphAppointments=${Number(sync.graphAppointments || 0)}`);
  lines.push(`syncGraphOnlineMeetings=${Number(sync.graphOnlineMeetings || 0)}`);
  lines.push(`syncGraphOtherMeetings=${Number(sync.graphOtherMeetings || 0)}`);
  lines.push(`syncCacheAppointments=${Number(sync.cacheAppointments || 0)}`);
  lines.push(`syncCacheOnlineMeetings=${Number(sync.cacheOnlineMeetings || 0)}`);
  lines.push(`syncCacheOtherMeetings=${Number(sync.cacheOtherMeetings || 0)}`);
  lines.push(`syncCacheSyntheticSelf=${Number(sync.cacheSyntheticSelf || 0)}`);
  lines.push(`syncDirectPushes=${Number(sync.directPushes || 0)}`);
  if (sync.lastGraphCalendarId) lines.push(`syncGraphCalendarId=${sync.lastGraphCalendarId}`);
  if (sync.message) lines.push(`syncMessage=${sync.message}`);
  if (sync.error) lines.push(`syncError=${sync.error}`);
  const directEvent = diag.directEventStats || {};
  lines.push(`directEventUpserts=${Number(directEvent.upserts || 0)}`);
  lines.push(`directEventRemoves=${Number(directEvent.removes || 0)}`);
  if (directEvent.lastOperation) lines.push(`directEventLastOperation=${directEvent.lastOperation}`);
  if (directEvent.lastEventId) lines.push(`directEventLastEventId=${directEvent.lastEventId}`);
  if (directEvent.lastCalendarId) lines.push(`directEventLastCalendarId=${directEvent.lastCalendarId}`);
  lines.push(`directEventLastStored=${directEvent.lastStored ? "yes" : "no"}`);
  if (directEvent.lastTitle) lines.push(`directEventLastTitle=${directEvent.lastTitle}`);
  if (directEvent.lastStart) lines.push(`directEventLastStart=${directEvent.lastStart}`);
  if (directEvent.lastEnd) lines.push(`directEventLastEnd=${directEvent.lastEnd}`);
  lines.push(`directEventLastAppointment=${directEvent.lastAppointment ? "yes" : "no"}`);
  lines.push(`directEventLastOnlineMeeting=${directEvent.lastOnlineMeeting ? "yes" : "no"}`);
  lines.push(`directEventLastSyntheticSelf=${directEvent.lastSyntheticSelf ? "yes" : "no"}`);
  if (directEvent.lastError) lines.push(`directEventError=${directEvent.lastError}`);
  const viewReload = diag.viewReloadStats || {};
  lines.push(`viewReloadScheduled=${Number(viewReload.scheduled || 0)}`);
  lines.push(`viewReloadExecuted=${Number(viewReload.executed || 0)}`);
  lines.push(`viewReloadViews=${Number(viewReload.refreshedViews || 0)}`);
  if (viewReload.lastReason) lines.push(`viewReloadReason=${viewReload.lastReason}`);
  if (viewReload.lastError) lines.push(`viewReloadError=${viewReload.lastError}`);
  const teamsUi = diag.teamsButtonStats || {};
  lines.push(`teamsButtonWindows=${Number(teamsUi.injectedWindows || 0)}`);
  lines.push(`teamsButtonClicks=${Number(teamsUi.clicks || 0)}`);
  if (teamsUi.lastError) lines.push(`teamsButtonError=${teamsUi.lastError}`);
  if (diag.lastOperation) lines.push(`lastOperation=${diag.lastOperation}`);
  if (diag.lastErrorStage) lines.push(`lastErrorStage=${diag.lastErrorStage}`);
  if (diag.lastError) lines.push(`lastError=${diag.lastError}`);
  if (Array.isArray(diag.trace) && diag.trace.length) {
    lines.push("trace:");
    for (const entry of diag.trace) {
      lines.push(`  ${entry.ok ? "OK" : "FAIL"} ${entry.stage}${entry.detail ? ` :: ${entry.detail}` : ""}`);
    }
  }
  els.nativeDebugText.textContent = lines.join("\n");
  if ((auto.attempted && !auto.ok) || diag.lastError) {
    els.nativeDebugDetails.open = true;
  }
}

async function populateAddressBookSelection() {
  if (!els.contactAddressBooksSelect) return;
  let books = [];
  try { books = await api("listAddressBooks"); } catch (_) {}
  state.addressBooks = Array.isArray(books) ? books : [];
  const configured = Array.isArray(state.config?.contactAddressBookIds) ? state.config.contactAddressBookIds.map(String) : ["*"];
  const allSelected = configured.includes("*");
  const selected = new Set(configured);
  els.contactAddressBooksSelect.replaceChildren();
  for (const book of state.addressBooks) {
    const option = document.createElement("option");
    option.value = book.id;
    const flags = [book.remote ? t("contactAddressBookRemote") : t("contactAddressBookLocal")];
    if (book.useForAutocomplete === false) flags.push(t("contactAddressBookNotAutocomplete"));
    if (Number.isFinite(Number(book.cardCount))) flags.push(String(book.cardCount));
    option.textContent = `${book.name} — ${flags.join(" · ")}`;
    option.selected = allSelected || selected.has(String(book.id));
    els.contactAddressBooksSelect.appendChild(option);
  }
  updateAddressBookSelectionStatus();
}

function selectedAddressBookIdsFromUi() {
  if (!els.contactAddressBooksSelect) return ["*"];
  const options = [...els.contactAddressBooksSelect.options];
  const selected = options.filter(option => option.selected).map(option => option.value);
  if (options.length && selected.length === options.length) return ["*"];
  return selected;
}

function updateAddressBookSelectionStatus() {
  if (!els.contactAddressBooksStatus || !els.contactAddressBooksSelect) return;
  const total = els.contactAddressBooksSelect.options.length;
  const selected = [...els.contactAddressBooksSelect.options].filter(option => option.selected).length;
  els.contactAddressBooksStatus.textContent = t("contactAddressBooksStatus", [String(selected), String(total)]);
}

function selectAddressBooks(mode) {
  if (!els.contactAddressBooksSelect) return;
  const byId = new Map((state.addressBooks || []).map(book => [String(book.id), book]));
  for (const option of els.contactAddressBooksSelect.options) {
    if (mode === "all") option.selected = true;
    else if (mode === "none") option.selected = false;
    else option.selected = byId.get(option.value)?.useForAutocomplete !== false;
  }
  updateAddressBookSelectionStatus();
}

async function testAddressBookSearch() {
  if (!els.contactTestInput || !els.contactTestOutput) return;
  const query = String(els.contactTestInput.value || "").trim();
  if (query.length < 2) {
    els.contactTestOutput.textContent = t("contactTestNeedQuery");
    return;
  }
  els.contactTestOutput.textContent = t("contactTestRunning");
  try {
    const results = await api("searchContacts", { query, diagnostic: true });
    const diagnostics = await api("contactDiagnostics");
    const lines = [
      `${t("contactTestResults")}: ${results.length}`,
      ...results.map(item => `- ${item.name || item.email} <${item.email}> [${item.source || "webext"}]`),
      "",
      "Diagnostics:",
      JSON.stringify(diagnostics, null, 2)
    ];
    els.contactTestOutput.textContent = lines.join("\n");
  } catch (error) {
    els.contactTestOutput.textContent = `${t("contactTestFailed")}: ${error.message || String(error)}`;
  }
}

async function refreshNativeStatus() {
  const packagedNative = Boolean(state.auth?.nativeMode);
  els.nativeIntegrationBox.classList.remove("hidden");

  if (!packagedNative) {
    els.nativeIntegrationCheck.disabled = true;
    els.nativeDaysBeforeInput.disabled = true;
    els.nativeDaysAfterInput.disabled = true;
    els.nativeSyncBtn.disabled = true;
    els.nativeStatusText.textContent = t("nativeStatusStandardBuild");
    const warning = document.getElementById("nativeExperimentWarning");
    if (warning) warning.classList.add("hidden");
    return;
  }

  const warning = document.getElementById("nativeExperimentWarning");
  if (warning) warning.classList.remove("hidden");
  els.nativeStatusText.textContent = t("nativeStatusProbing");

  try {
    // V2.16 deliberately performs the first Experiment access only here,
    // after the normal STANDARD UI/background are already alive.
    const status = await api("nativeStatus");
    renderNativeDiagnostics(status);
    state.auth.nativeCapable = Boolean(status.available);
    state.auth.nativeProbed = Boolean(status.probed);
    state.auth.nativeProbeError = status.bridgeError || "";
    updateBuildModeBanner();

    els.nativeIntegrationCheck.disabled = !status.available;
    els.nativeDaysBeforeInput.disabled = !status.available;
    els.nativeDaysAfterInput.disabled = !status.available;
    els.nativeSyncBtn.disabled = !status.available || !status.enabled || !status.loggedIn;

    const diag = status.diagnostics || {};
    const bridgeError = status.bridgeError || (!status.available ? diag.providerLoadError : "");
    if (!status.available) {
      els.nativeStatusText.textContent = bridgeError
        ? t("nativeBridgeFailed", bridgeError)
        : t("nativeStatusApiNotLoaded");
      return;
    }

    const moduleState = diag.providerModuleLoaded
      ? ` · ${t("nativeProviderModuleLoaded")}`
      : diag.providerLoadError
        ? ` · ${t("nativeProviderModuleFailed", diag.providerLoadError)}`
        : ` · ${t("nativeProviderModuleNotLoaded")}`;
    const registry = ` · ${t("nativeRegistryState", [
      diag.managerProviderRegistered ? t("yes") : t("no"),
      diag.uiProviderRegistered ? t("yes") : t("no"),
      String(diag.registeredCalendarCount || 0)
    ])}`;
    const ensureInfo = status.autoEnsure?.attempted
      ? status.autoEnsure?.ok
        ? ` · ${t("nativeAutoEnsureOk", [
            String(status.autoEnsure.graphCalendarCount || 0),
            String(status.autoEnsure.registeredCount || 0)
          ])}`
        : ` · ${t("nativeAutoEnsureFailed", status.autoEnsure?.error || t("unknownError"))}`
      : "";

    if (!status.enabled) {
      els.nativeStatusText.textContent = `${t("nativeStatusDisabled")}${moduleState}${registry}${ensureInfo}`;
    } else if (!status.loggedIn) {
      els.nativeStatusText.textContent = `${t("nativeStatusNotSignedIn")}${moduleState}${registry}${ensureInfo}`;
    } else {
      const names = (status.calendars || []).map(calendar => calendar.name).filter(Boolean);
      const base = t("nativeStatusActive", String(status.calendars?.length || 0));
      els.nativeStatusText.textContent = `${base}${moduleState}${registry}${ensureInfo}${names.length ? ` · ${names.join(", ")}` : ""}`;
    }
  } catch (error) {
    state.auth.nativeCapable = false;
    state.auth.nativeProbed = true;
    state.auth.nativeProbeError = error.message || String(error);
    updateBuildModeBanner();
    els.nativeIntegrationCheck.disabled = true;
    els.nativeDaysBeforeInput.disabled = true;
    els.nativeDaysAfterInput.disabled = true;
    els.nativeSyncBtn.disabled = true;
    els.nativeStatusText.textContent = t("nativeBridgeFailed", error.message || String(error));
    if (els.nativeDebugText) {
      els.nativeDebugText.textContent = `build=${state.auth?.nativeMode ? "NATIVE" : "STANDARD"} ${state.auth?.version || "2.0.39"}\nFAIL refreshNativeStatus :: ${error.message || String(error)}`;
      if (els.nativeDebugDetails) els.nativeDebugDetails.open = true;
    }
  }
}

async function syncNativeNow() {
  els.nativeSyncBtn.disabled = true;
  try {
    const result = await api("syncNativeCalendars");
    toast(t("nativeSyncComplete", String(result.synchronized || 0)), "success");
    await refreshNativeStatus();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    await refreshNativeStatus();
  }
}

async function forceFullSync() {
  if (!state.auth?.loggedIn || !state.config?.selectedCalendarId) return;
  if (els.settingsDialog.open) els.settingsDialog.close();
  await loadEvents({ forceFull: true });
}

async function clearOfflineCache() {
  if (!confirm(t("confirmClearCache"))) return;
  try {
    await api("clearSyncCache");
    await refreshCacheInfo();
    toast(t("cacheCleared"), "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function doLogin() {
  try {
    state.config = await api("getConfig");
    if (!state.config.clientId || !state.config.tenant) {
      toast(t("enterConfigFirst"), "error");
      if (!els.settingsDialog.open) await openSettings();
      return;
    }
    els.loginBtn.disabled = true;
    const profile = await api("login");
    state.auth = await api("authStatus");
    updateHeader();
    toast(t("loginSuccess", profile?.displayName ? `: ${profile.displayName}` : ""), "success");
    if (els.settingsDialog.open) els.settingsDialog.close();
    await loadCalendarsAndEvents();
    await refreshNativeStatus();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    els.loginBtn.disabled = false;
  }
}

async function doLogout() {
  try {
    await api("logout");
    state.auth = await api("authStatus");
    state.events = [];
    state.calendars = [];
    state.sync = null;
    stopAutoSync();
    updateHeader();
    if (els.settingsDialog.open) els.settingsDialog.close();
    showWelcome();
    toast(t("logoutSuccess"), "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

function toDateTimeLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function weekdayGraph(date) {
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
}

function normalizeEditorTimes() {
  let start = els.newStart.value;
  let end = els.newEnd.value;
  if (els.newAllDay.checked) {
    const startDate = new Date(start);
    let endDate = new Date(end);
    startDate.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);
    if (endDate <= startDate) endDate = new Date(startDate.getTime() + 86400000);
    start = `${dateOnly(startDate)}T00:00:00`;
    end = `${dateOnly(endDate)}T00:00:00`;
  }
  return { start, end };
}

function updateRecurrenceVisibility() {
  const type = els.newRecurrenceType.value;
  const enabled = type !== "none" && !state.editingEventId;
  els.newRecurrenceInterval.disabled = !enabled;
  els.newRecurrenceEndType.disabled = !enabled;
  const endType = els.newRecurrenceEndType.value;
  els.recurrenceEndDateWrap.classList.toggle("hidden", !enabled || endType !== "endDate");
  els.recurrenceCountWrap.classList.toggle("hidden", !enabled || endType !== "numbered");
}

function buildRecurrencePayload(startValue) {
  const type = els.newRecurrenceType.value;
  if (type === "none" || state.editingEventId) return null;
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return null;
  const interval = Math.max(1, Math.min(99, Number(els.newRecurrenceInterval.value) || 1));
  let pattern;
  if (type === "daily") pattern = { type: "daily", interval };
  if (type === "weekly") pattern = { type: "weekly", interval, daysOfWeek: [weekdayGraph(start)], firstDayOfWeek: "monday" };
  if (type === "monthly") pattern = { type: "absoluteMonthly", interval, dayOfMonth: start.getDate() };
  if (type === "yearly") pattern = { type: "absoluteYearly", interval, dayOfMonth: start.getDate(), month: start.getMonth() + 1 };
  const range = {
    type: els.newRecurrenceEndType.value || "noEnd",
    startDate: dateOnly(start),
    recurrenceTimeZone: state.config?.timeZone || "W. Europe Standard Time"
  };
  if (range.type === "endDate") range.endDate = els.newRecurrenceEndDate.value || dateOnly(new Date(start.getTime() + 90*86400000));
  if (range.type === "numbered") range.numberOfOccurrences = Math.max(1, Math.min(999, Number(els.newRecurrenceCount.value) || 10));
  return { pattern, range };
}

function resetEventEditor() {
  state.editingEventId = null;
  let start = NATIVE_TEAMS_POPUP && NATIVE_TEAMS_START ? new Date(NATIVE_TEAMS_START) : new Date();
  if (Number.isNaN(start.getTime())) start = new Date();
  start.setSeconds(0, 0);
  if (!(NATIVE_TEAMS_POPUP && NATIVE_TEAMS_START)) {
    start.setMinutes(start.getMinutes() < 30 ? 30 : 0);
    if (start.getMinutes() === 0) start.setHours(start.getHours() + 1);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  els.newSubject.value = "";
  els.newStart.value = toDateTimeLocal(start);
  els.newEnd.value = toDateTimeLocal(end);
  els.newAllDay.checked = false;
  els.newAttendees.value = "";
  hideAttendeeSuggestions();
  els.newLocation.value = "";
  els.newBody.value = "";
  els.newTeams.checked = true;
  els.newTeams.disabled = false;
  els.newReminder.value = "15";
  els.newShowAs.value = "busy";
  els.newSensitivity.value = "normal";
  els.newCategories.value = "";
  els.newRecurrenceType.value = "none";
  els.newRecurrenceType.disabled = false;
  els.newRecurrenceInterval.value = "1";
  els.newRecurrenceEndType.value = "noEnd";
  els.newRecurrenceCount.value = "10";
  els.newRecurrenceEndDate.value = dateOnly(new Date(start.getTime() + 90*86400000));
  els.recurrenceEditHint.classList.add("hidden");
  els.availabilityResults.classList.add("hidden");
  els.availabilityResults.replaceChildren();
  els.newEventTitleText.textContent = t("newEventTitle");
  els.newEventSubtitleText.textContent = t("newEventSubtitle");
  els.saveEventBtn.textContent = t("createEvent");
  updateRecurrenceVisibility();
}

function openNewEvent() {
  resetEventEditor();
  const calendar = state.calendars.find(c => c.id === state.config.selectedCalendarId);
  els.newEventInfo.textContent = calendar ? t("calendarInfo", `${calendar.name}${calendar.isShared ? ` · ${t("sharedShort")}` : ""}`) : "";
  els.newEventDialog.showModal();
  if (NATIVE_TEAMS_POPUP) window.setTimeout(() => fitNativeTeamsPopup(), 0);
}

function openEditEvent() {
  const event = currentEvent();
  if (!event || !eventIsEditable(event)) return;
  state.editingEventId = event.id;
  els.newSubject.value = event.subject || "";
  els.newStart.value = toDateTimeLocal(eventStart(event) || new Date());
  els.newEnd.value = toDateTimeLocal(eventEnd(event) || new Date(Date.now()+3600000));
  els.newAllDay.checked = Boolean(event.isAllDay);
  els.newAttendees.value = (event.attendees || []).map(a => a?.emailAddress?.address).filter(Boolean).join("; ");
  els.newLocation.value = event.location?.displayName || "";
  els.newBody.value = event.body?.content || event.bodyPreview || "";
  els.newTeams.checked = Boolean(event.isOnlineMeeting || getJoinUrl(event));
  els.newTeams.disabled = true;
  els.newReminder.value = event.isReminderOn ? String(event.reminderMinutesBeforeStart ?? 15) : "";
  if (![...els.newReminder.options].some(o => o.value === els.newReminder.value) && event.isReminderOn) {
    const option = document.createElement("option");
    option.value = els.newReminder.value;
    option.textContent = t("reminderMinutes", els.newReminder.value);
    els.newReminder.appendChild(option);
  }
  els.newShowAs.value = event.showAs || "busy";
  els.newSensitivity.value = event.sensitivity || "normal";
  els.newCategories.value = (event.categories || []).join("; ");
  els.newRecurrenceType.value = "none";
  els.newRecurrenceType.disabled = true;
  els.recurrenceEditHint.classList.toggle("hidden", !isRecurringEvent(event));
  els.availabilityResults.classList.add("hidden");
  els.newEventTitleText.textContent = t("editEventTitle");
  els.newEventSubtitleText.textContent = t("editEventSubtitle");
  els.saveEventBtn.textContent = t("saveChanges");
  const calendar = state.calendars.find(c => c.id === state.config.selectedCalendarId);
  els.newEventInfo.textContent = calendar ? t("calendarInfo", calendar.name) : "";
  updateRecurrenceVisibility();
  if (els.eventDialog.open) els.eventDialog.close();
  els.newEventDialog.showModal();
  if (NATIVE_TEAMS_POPUP) window.setTimeout(() => fitNativeTeamsPopup(), 0);
}

function editorPayload() {
  const attendees = els.newAttendees.value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  const categories = els.newCategories.value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  const times = normalizeEditorTimes();
  return {
    calendarId: state.config.selectedCalendarId,
    subject: els.newSubject.value,
    start: times.start,
    end: times.end,
    allDay: els.newAllDay.checked,
    attendees,
    location: els.newLocation.value,
    body: els.newBody.value,
    teams: els.newTeams.checked,
    reminderMinutes: els.newReminder.value === "" ? null : Number(els.newReminder.value),
    showAs: els.newShowAs.value,
    sensitivity: els.newSensitivity.value,
    categories,
    recurrence: buildRecurrencePayload(times.start)
  };
}

async function saveEventEditor() {
  const submit = els.saveEventBtn;
  submit.disabled = true;
  try {
    const payload = editorPayload();
    if (state.editingEventId) {
      payload.eventId = state.editingEventId;
      payload.includeRecurrence = false;
      await api("updateEvent", { payload });
      toast(t("eventUpdated"), "success");
    } else {
      await api("createEvent", { payload });
      toast(payload.teams ? t("teamsCreated") : t("eventCreated"), "success");
    }
    els.newEventDialog.close();
    state.editingEventId = null;
    if (NATIVE_TEAMS_POPUP) {
      window.setTimeout(() => window.close(), 80);
      return;
    }
    await loadEvents();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function deleteCurrentEvent() {
  const event = currentEvent();
  if (!event || !eventIsEditable(event) || !confirm(t("confirmDeleteEvent"))) return;
  els.deleteEventBtn.disabled = true;
  try {
    await api("deleteEvent", { eventId: event.id, calendarId: state.config.selectedCalendarId });
    els.eventDialog.close();
    toast(t("eventDeleted"), "success");
    await loadEvents();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    els.deleteEventBtn.disabled = false;
  }
}

function availabilityLabel(view) {
  const text = String(view || "");
  if (!text || /^0+$/.test(text)) return { label: t("availabilityFree"), free: true };
  if (text.includes("3")) return { label: t("availabilityOof"), free: false };
  if (text.includes("2")) return { label: t("availabilityBusy"), free: false };
  if (text.includes("1")) return { label: t("availabilityTentative"), free: false };
  if (text.includes("4")) return { label: t("availabilityWorkingElsewhere"), free: false };
  return { label: t("availabilityUnknown"), free: false };
}

async function checkAvailability() {
  const schedules = els.newAttendees.value.split(/[;,]/).map(v => v.trim()).filter(v => v.includes("@"));
  if (!schedules.length) {
    toast(t("availabilityNeedAttendees"), "error");
    return;
  }
  const times = normalizeEditorTimes();
  els.checkAvailabilityBtn.disabled = true;
  try {
    const result = await api("getSchedule", { schedules, start: times.start, end: times.end, interval: 15 });
    els.availabilityResults.replaceChildren();
    for (const schedule of result.value || []) {
      const status = availabilityLabel(schedule.availabilityView);
      const row = document.createElement("div");
      row.className = `availability-row ${status.free ? "availability-free" : "availability-busy"}`;
      const addr = document.createElement("span");
      addr.textContent = schedule.scheduleId || "?";
      const label = document.createElement("strong");
      label.textContent = status.label;
      row.append(addr, label);
      els.availabilityResults.appendChild(row);
    }
    els.availabilityResults.classList.toggle("hidden", !(result.value || []).length);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    els.checkAvailabilityBtn.disabled = false;
  }
}

async function copyRedirect() {
  try {
    await navigator.clipboard.writeText(els.redirectUriInput.value);
    toast(t("redirectCopied"), "success");
  } catch (_) {
    els.redirectUriInput.select();
    document.execCommand("copy");
    toast(t("redirectCopied"), "success");
  }
}

function bindEvents() {
  els.settingsBtn.addEventListener("click", openSettings);
  els.welcomeSettingsBtn.addEventListener("click", openSettings);
  els.welcomeLoginBtn.addEventListener("click", doLogin);
  els.loginBtn.addEventListener("click", async () => {
    await saveSettings();
    await doLogin();
  });
  els.logoutBtn.addEventListener("click", doLogout);
  els.copyRedirectBtn.addEventListener("click", copyRedirect);
  els.fullSyncBtn.addEventListener("click", forceFullSync);
  els.clearCacheBtn.addEventListener("click", clearOfflineCache);
  els.nativeSyncBtn.addEventListener("click", syncNativeNow);
  if (els.diagnosticExportBtn) els.diagnosticExportBtn.addEventListener("click", exportCalendarDiagnostics);
  if (els.contactTestBtn) els.contactTestBtn.addEventListener("click", testAddressBookSearch);
  if (els.contactAddressBooksSelect) els.contactAddressBooksSelect.addEventListener("change", updateAddressBookSelectionStatus);
  if (els.contactBooksAllBtn) els.contactBooksAllBtn.addEventListener("click", () => selectAddressBooks("all"));
  if (els.contactBooksRecommendedBtn) els.contactBooksRecommendedBtn.addEventListener("click", () => selectAddressBooks("recommended"));
  if (els.contactBooksNoneBtn) els.contactBooksNoneBtn.addEventListener("click", () => selectAddressBooks("none"));

  els.settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await saveSettings();
      els.settingsDialog.close();
      state.auth = await api("authStatus");
      updateHeader();
      if (state.auth.loggedIn) await loadCalendarsAndEvents(); else showWelcome();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  els.prevBtn.addEventListener("click", async () => { shiftCursor(-1); await loadEvents(); });
  els.nextBtn.addEventListener("click", async () => { shiftCursor(1); await loadEvents(); });
  els.todayBtn.addEventListener("click", async () => { state.cursor = new Date(); await loadEvents(); });
  document.querySelectorAll(".view-mode-btn").forEach(button => button.addEventListener("click", async () => {
    const mode = button.dataset.view;
    if (!["month", "week", "day", "agenda"].includes(mode) || mode === state.viewMode) return;
    state.viewMode = mode;
    state.config.spaceViewMode = mode;
    await api("saveConfig", { config: { spaceViewMode: mode } });
    await loadEvents();
  }));
  els.refreshBtn.addEventListener("click", () => loadEvents());
  els.calendarSelect.addEventListener("change", async () => {
    state.config.selectedCalendarId = els.calendarSelect.value;
    await api("saveConfig", { config: { selectedCalendarId: els.calendarSelect.value } });
    await loadEvents();
  });

  els.newEventBtn.addEventListener("click", openNewEvent);
  els.newEventForm.addEventListener("submit", async event => {
    event.preventDefault();
    await saveEventEditor();
  });
  els.editEventBtn.addEventListener("click", openEditEvent);
  els.deleteEventBtn.addEventListener("click", deleteCurrentEvent);
  els.checkAvailabilityBtn.addEventListener("click", checkAvailability);
  els.newAttendees.addEventListener("input", scheduleAttendeeSearch);
  els.newAttendees.addEventListener("focus", () => { if (attendeeSuggestions.length) positionAttendeeSuggestions(); });
  els.newAttendees.addEventListener("keydown", handleAttendeeSuggestionKeydown);
  window.addEventListener("resize", positionAttendeeSuggestions);
  document.addEventListener("scroll", positionAttendeeSuggestions, true);
  els.newAttendees.addEventListener("blur", () => window.setTimeout(hideAttendeeSuggestions, 140));
  els.newRecurrenceType.addEventListener("change", updateRecurrenceVisibility);
  els.newRecurrenceEndType.addEventListener("change", updateRecurrenceVisibility);
  els.newAllDay.addEventListener("change", () => {
    if (!els.newAllDay.checked) return;
    const start = new Date(els.newStart.value);
    let end = new Date(els.newEnd.value);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0,0,0,0);
      els.newStart.value = toDateTimeLocal(start);
    }
    if (!Number.isNaN(end.getTime())) {
      end.setHours(0,0,0,0);
      if (!Number.isNaN(start.getTime()) && end <= start) end = new Date(start.getTime()+86400000);
      els.newEnd.value = toDateTimeLocal(end);
    }
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const dialog = $(button.dataset.close);
      if (dialog?.open) dialog.close();
    });
  });

  els.responseButtons.querySelectorAll("[data-response]").forEach(button => {
    button.addEventListener("click", () => respondToEvent(button.dataset.response));
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !state.auth?.loggedIn || state.loading) return;
  const minutes = Number(state.config?.autoSyncMinutes || 0);
  const last = Number(state.sync?.lastSyncAt || 0);
  if (minutes > 0 && Date.now() - last >= minutes * 60 * 1000) loadEvents({ quiet: true });
});

async function init() {
  applyI18n();
  if (NATIVE_TEAMS_POPUP) {
    document.body.classList.add("native-teams-popup");
    document.title = t(NATIVE_EDIT_EVENT_ID ? "nativeEventEditorPopupTitle" : "nativeTeamsMeetingPopupTitle");
  }
  for (const node of document.querySelectorAll("[id]")) els[node.id] = node;
  bindEvents();
  if (NATIVE_TEAMS_POPUP) {
    const closePopupWindow = () => {
      if (!state.loading) window.setTimeout(() => window.close(), 40);
    };
    els.newEventDialog.addEventListener("close", closePopupWindow);
    els.eventDialog.addEventListener("close", closePopupWindow);
  }
  try {
    await loadState();
    updateBuildModeBanner();
    if (NATIVE_TEAMS_POPUP && state.auth?.loggedIn && state.calendars.length) {
      const preferred = state.calendars.find(calendar =>
        calendar.id === NATIVE_TEAMS_CALENDAR_ID && calendar.canEdit
      ) || state.calendars.find(calendar => calendar.isDefault && calendar.canEdit)
        || state.calendars.find(calendar => calendar.canEdit);
      if (preferred) {
        // Popup-only selection: do not overwrite the user's persistent Space selection.
        state.config.selectedCalendarId = preferred.id;
        renderCalendarSelector();
        if (NATIVE_EDIT_EVENT_ID) {
          const event = await api("getEvent", { eventId: NATIVE_EDIT_EVENT_ID, calendarId: preferred.id });
          state.events = event ? [event] : [];
          state.selectedEventId = event?.id || null;
          if (!event) throw new Error(t("eventNotFound"));
          if (eventIsEditable(event)) openEditEvent();
          else {
            openEvent(event.id);
            if (NATIVE_TEAMS_POPUP) window.setTimeout(() => fitNativeTeamsPopup(), 0);
          }
        } else {
          openNewEvent();
        }
      } else {
        toast(t("noCalendars"), "error");
      }
    }
  } catch (error) {
    showWelcome();
    toast(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);

/*
 * M365 native calendar Experiment API for Thunderbird.
 *
 * V2.09 is deliberately STANDARD-first: this implementation is NOT loaded at
 * Thunderbird startup. It is loaded only after the normal WebExtension
 * background and M365 Space are already running and code explicitly accesses
 * browser.nativeCalendar.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

var _m365NativeProviderModule = null;
var _m365NativeProviderLoadError = "";
var _m365NativeExtension = null;

function _m365NativeErrorText(error) {
  const parts = [];
  if (error?.name) parts.push(error.name);
  if (error?.message) parts.push(error.message);
  if (!parts.length) parts.push(String(error || "Unknown native provider error"));
  if (error?.result != null) parts.push(`result=${error.result}`);
  if (error?.stack) parts.push(String(error.stack).split("\n").slice(0, 4).join(" | "));
  return parts.join(": ");
}

function _m365NativeLoadProvider(_extension) {
  if (_m365NativeProviderModule) return _m365NativeProviderModule;
  if (_m365NativeProviderLoadError) return null;
  try {
    _m365NativeProviderModule = _m365NativeCreateProviderRuntime();
    return _m365NativeProviderModule;
  } catch (error) {
    _m365NativeProviderLoadError = _m365NativeErrorText(error);
    console.error("M365 native provider runtime could not be initialized", error);
    return null;
  }
}

async function _m365NativeProviderCall(extension, method, ...args) {
  const runtime = _m365NativeLoadProvider(extension);
  if (!runtime) {
    throw new Error(_m365NativeProviderLoadError || "Native provider runtime is unavailable");
  }
  if (typeof runtime[method] !== "function") {
    throw new Error(`Native provider method is unavailable: ${method}`);
  }
  return runtime[method](extension, ...args);
}

// Thunderbird Experiment API modules must expose a top-level var/this property
// with the same name as the namespace. This follows Thunderbird's documented
// minimal Experiment pattern.
var nativeCalendar = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    const extension = context.extension;
    _m365NativeExtension = extension;

    const makeEvent = (name, mapper) => new ExtensionCommon.EventManager({
      context,
      name,
      register(fire) {
        const listener = async (_event, ...args) => fire.async(...mapper(...args));
        extension.on(name, listener);
        return () => extension.off(name, listener);
      },
    }).api();

    return {
      nativeCalendar: {
        // Does not import calendar internals. This proves only that Thunderbird
        // successfully loaded the Experiment bridge itself.
        async ping() {
          return true;
        },

        async activate() {
          return _m365NativeProviderCall(extension, "activate");
        },

        async ensureCalendars(calendars) {
          return _m365NativeProviderCall(extension, "ensureCalendars", calendars || []);
        },

        async removeAll() {
          if (!_m365NativeProviderModule && !_m365NativeProviderLoadError) {
            return false;
          }
          return _m365NativeProviderCall(extension, "removeAll");
        },

        async synchronize() {
          return _m365NativeProviderCall(extension, "synchronize");
        },

        // V2.18: explicit cache push from the WebExtension background. This
        // bypasses the provider-event return path for the main sync action and
        // mirrors Thunderbird's maintained Calendar Experiment, where onSync
        // writes directly to the calendar cache.
        async replaceCalendarEvents(graphCalendarId, events) {
          return _m365NativeProviderCall(
            extension,
            "replaceCalendarEvents",
            String(graphCalendarId || ""),
            Array.isArray(events) ? events : []
          );
        },

        async upsertCalendarEvent(graphCalendarId, event) {
          return _m365NativeProviderCall(extension, "upsertCalendarEvent", String(graphCalendarId || ""), event || {});
        },

        async removeCalendarEvent(graphCalendarId, eventId) {
          return _m365NativeProviderCall(extension, "removeCalendarEvent", String(graphCalendarId || ""), String(eventId || ""));
        },

        async reloadViews(reason) {
          return _m365NativeProviderCall(extension, "reloadViews", String(reason || "manual"));
        },

        async listAddressBooks() {
          return _m365NativeProviderCall(extension, "listAddressBooks");
        },

        async searchAddressBook(query, addressBookIds) {
          return _m365NativeProviderCall(extension, "searchAddressBook", String(query || ""), Array.isArray(addressBookIds) ? addressBookIds : ["*"]);
        },

        async status() {
          if (!_m365NativeProviderModule && !_m365NativeProviderLoadError) {
            return [];
          }
          return _m365NativeProviderCall(extension, "status");
        },

        async exportDiagnostics(graphCalendarId, start, end) {
          return _m365NativeProviderCall(extension, "exportDiagnostics", String(graphCalendarId || ""), String(start || ""), String(end || ""));
        },

        async diagnostics() {
          const module = _m365NativeLoadProvider(extension);
          if (!module) {
            return {
              experimentLoaded: true,
              providerModuleLoaded: false,
              providerLoadError: _m365NativeProviderLoadError,
              calendarStartupReady: false,
              managerProviderRegistered: false,
              uiProviderRegistered: false,
              registeredCalendars: [],
              registeredCalendarCount: 0,
            };
          }

          try {
            const data = await module.diagnostics(extension);
            return {
              experimentLoaded: true,
              providerModuleLoaded: true,
              providerLoadError: "",
              ...data,
            };
          } catch (error) {
            return {
              experimentLoaded: true,
              providerModuleLoaded: true,
              providerLoadError: _m365NativeErrorText(error),
              calendarStartupReady: false,
              managerProviderRegistered: false,
              uiProviderRegistered: false,
              registeredCalendars: [],
              registeredCalendarCount: 0,
            };
          }
        },

        onSync: makeEvent("nativeCalendar.onSync", calendar => [calendar]),
        onItemCreated: makeEvent(
          "nativeCalendar.onItemCreated",
          (calendar, item, options) => [calendar, item, options]
        ),
        onItemUpdated: makeEvent(
          "nativeCalendar.onItemUpdated",
          (calendar, item, oldItem, options) => [calendar, item, oldItem, options]
        ),
        onItemRemoved: makeEvent(
          "nativeCalendar.onItemRemoved",
          (calendar, item, options) => [calendar, item, options]
        ),
        onTeamsMeetingRequested: makeEvent(
          "nativeCalendar.onTeamsMeetingRequested",
          details => [details || {}]
        ),
        onEventEditRequested: makeEvent(
          "nativeCalendar.onEventEditRequested",
          details => [details || {}]
        ),
      },
    };
  }

  onShutdown(isAppShutdown) {
    const extension = _m365NativeExtension || this.extension;
    if (_m365NativeProviderModule?.shutdown && extension) {
      try {
        const result = _m365NativeProviderModule.shutdown(extension, Boolean(isAppShutdown));
        if (result?.catch) {
          result.catch(error => console.warn("M365 native shutdown failed", error));
        }
      } catch (error) {
        console.warn("M365 native shutdown failed", error);
      }
    }
    if (!isAppShutdown) {
      try {
        Services.obs.notifyObservers(null, "startupcache-invalidate");
      } catch (_) {}
    }
  }
};


// ---- Embedded lazy native provider runtime (V2.09) ------------------------
// V2.07 imported provider.sys.mjs through a temporary resource:// mapping.
// On the user's Thunderbird installation that import failed before any
// calendar code could execute (providerModule=not-loaded). V2.09 removes that
// fragile module boundary. Calendar internals are imported only when this
// factory is called, while the provider implementation itself lives in this
// already-loaded Experiment parent script.
function _m365NativeCreateProviderRuntime() {
  const { classes: Cc, interfaces: Ci, results: Cr } = Components;
  // Thunderbird 115+ exposes Services directly in the privileged Experiment
  // global scope. There is no Services.sys.mjs to import on the user's TB
  // installation (V2.08 failed with NS_ERROR_FILE_NOT_FOUND / 0x80520012).
  const Services = globalThis.Services;
  if (!Services) {
    throw new Error("Thunderbird globalThis.Services is unavailable in the Experiment scope");
  }
  const { cal } = ChromeUtils.importESModule("resource:///modules/calendar/calUtils.sys.mjs");
  const { setTimeout: nativeSetTimeout, clearTimeout: nativeClearTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  const { CalEvent } = ChromeUtils.importESModule("resource:///modules/CalEvent.sys.mjs");
  const { CalAttendee } = ChromeUtils.importESModule("resource:///modules/CalAttendee.sys.mjs");
  const { CalAlarm } = ChromeUtils.importESModule("resource:///modules/CalAlarm.sys.mjs");
  const { CalDateTime } = ChromeUtils.importESModule("resource:///modules/CalDateTime.sys.mjs");
  let MailServices = null;
  try {
    ({ MailServices } = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs"));
  } catch (error) {
    console.warn("M365 native MailServices import failed; identity/address-book integration will use WebExtension fallbacks", error);
  }

  /* M365 native Thunderbird calendar provider implementation.
   * Loaded lazily by api.js so provider incompatibilities cannot break the add-on UI.
   * SPDX-License-Identifier: MPL-2.0
   */


  const PROP_GRAPH_ID = "m365.graphCalendarId";
  const PROP_ACCOUNT_ID = "m365.accountId";
  const PROP_ORGANIZER_ID = "m365.organizerId";
  const PROP_ORGANIZER_NAME = "m365.organizerName";

  // Thunderbird persists normal calendar UI properties in calendar.registry.*.
  // V2.22 keeps those registry branches intact across normal shutdown. This
  // provider-owned store is now only a safety backup for explicit removal/re-login
  // and for migration from older versions that used to unregister calendars.
  const USER_PREF_PROPERTIES = new Set([
    "color",
    "disabled",
    "calendar-main-in-composite",
    "suppressAlarms",
    "imip.identity.key",
    "notifications.times",
  ]);
  const PREF_PROPERTY_KEYS = {
    color: "color",
    disabled: "disabled",
    "calendar-main-in-composite": "visible",
    suppressAlarms: "suppressAlarms",
    "imip.identity.key": "identityKey",
    "notifications.times": "notificationsTimes",
  };
  let programmaticCalendarMutationDepth = 0;

  function nativePrefsName(extension) {
    const id = safeString(extension?.id || "m365-calendar").replace(/[^A-Za-z0-9_.-]/g, "_");
    return `extensions.m365CalendarNative.${id}.userPrefs`;
  }

  function loadNativeUserPrefs(extension) {
    const empty = { version: 1, calendars: {} };
    try {
      const raw = Services.prefs.getStringPref(nativePrefsName(extension), "");
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return empty;
      if (!parsed.calendars || typeof parsed.calendars !== "object") parsed.calendars = {};
      parsed.version = 1;
      return parsed;
    } catch (_) {
      return empty;
    }
  }

  function saveNativeUserPrefs(extension, data) {
    try {
      Services.prefs.setStringPref(nativePrefsName(extension), JSON.stringify(data || { version: 1, calendars: {} }));
      return true;
    } catch (error) {
      console.warn("M365 native calendar preferences could not be saved", error);
      return false;
    }
  }

  function withProgrammaticCalendarMutation(fn) {
    programmaticCalendarMutationDepth += 1;
    try {
      return fn();
    } finally {
      programmaticCalendarMutationDepth = Math.max(0, programmaticCalendarMutationDepth - 1);
    }
  }

  function ownCalendarProperty(calendar, name) {
    const raw = rawCalendar(calendar);
    try {
      return calendar?.getProperty?.(name) ?? raw?.getProperty?.(name) ?? null;
    } catch (_) {
      return null;
    }
  }

  function graphCalendarIdFor(calendar) {
    return safeString(ownCalendarProperty(calendar, PROP_GRAPH_ID));
  }

  function snapshotCalendarUserPrefs(extension, calendar, allowSibling = false) {
    if (!calendar || (!allowSibling && !isOwnCalendar(calendar, extension))) return false;
    const graphId = graphCalendarIdFor(calendar);
    if (!graphId) return false;
    const store = loadNativeUserPrefs(extension);
    const existing = store.calendars[graphId] || {};
    const rawNotificationsTimes = ownCalendarProperty(calendar, "notifications.times");
    let notificationsTimes = null;
    try {
      notificationsTimes = rawNotificationsTimes == null
        ? null
        : JSON.parse(JSON.stringify(rawNotificationsTimes));
    } catch (_) {
      notificationsTimes = null;
    }
    store.calendars[graphId] = {
      ...existing,
      color: safeString(ownCalendarProperty(calendar, "color") || ""),
      disabled: Boolean(ownCalendarProperty(calendar, "disabled")),
      visible: ownCalendarProperty(calendar, "calendar-main-in-composite") !== false,
      suppressAlarms: Boolean(ownCalendarProperty(calendar, "suppressAlarms")),
      identityKey: safeString(ownCalendarProperty(calendar, "imip.identity.key") || ""),
      notificationsTimes: notificationsTimes == null ? null : notificationsTimes,
    };
    return saveNativeUserPrefs(extension, store);
  }

  function snapshotAllCalendarUserPrefs(extension) {
    try {
      for (const calendar of cal.manager.getCalendars().filter(item => isOwnCalendar(item, extension))) {
        snapshotCalendarUserPrefs(extension, calendar);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function deleteSavedCalendarProperty(extension, calendar, propertyName) {
    const graphId = graphCalendarIdFor(calendar);
    const key = PREF_PROPERTY_KEYS[propertyName];
    if (!graphId || !key) return;
    const store = loadNativeUserPrefs(extension);
    const prefs = store.calendars[graphId];
    if (!prefs || !Object.prototype.hasOwnProperty.call(prefs, key)) return;
    delete prefs[key];
    store.calendars[graphId] = prefs;
    saveNativeUserPrefs(extension, store);
  }

  function toPlainArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return Array.from(value); } catch (_) {}
    try {
      const result = [];
      const length = Number(value.length || 0);
      for (let i = 0; i < length; i += 1) {
        result.push(value.queryElementAt ? value.queryElementAt(i, Ci.nsISupports) : value[i]);
      }
      return result;
    } catch (_) {
      return [];
    }
  }

  function allMailIdentities() {
    try { return toPlainArray(MailServices?.accounts?.allIdentities); } catch (_) { return []; }
  }

  function identityForKey(key) {
    const wanted = safeString(key);
    if (!wanted) return null;
    return allMailIdentities().find(identity => safeString(identity?.key) === wanted) || null;
  }

  function identityForEmail(email) {
    const wanted = normalizeMail(email);
    if (!wanted) return null;
    return allMailIdentities().find(identity => normalizeMail(identity?.email) === wanted) || null;
  }

  function accountForIdentity(identity) {
    if (!identity) return null;
    try {
      for (const account of toPlainArray(MailServices?.accounts?.accounts)) {
        if (toPlainArray(account?.identities).some(candidate => safeString(candidate?.key) === safeString(identity.key))) {
          return account;
        }
      }
    } catch (_) {}
    return null;
  }

  function savedCalendarUserPrefs(extension, graphId) {
    const store = loadNativeUserPrefs(extension);
    const value = store.calendars[safeString(graphId)];
    return value && typeof value === "object" ? value : null;
  }

  function applySavedCalendarUserPrefs(extension, calendar, descriptor, isNew) {
    const prefs = savedCalendarUserPrefs(extension, descriptor.graphCalendarId);
    withProgrammaticCalendarMutation(() => {
      // New calendars use Graph metadata only as a default. Existing calendars
      // keep their current user-selected colour/state. Persisted values win when
      // a calendar is recreated on a later Thunderbird start.
      if (isNew) {
        calendar.setProperty("color", prefs && Object.prototype.hasOwnProperty.call(prefs, "color")
          ? prefs.color
          : (descriptor.color || "#4f6bed"));
        calendar.setProperty("disabled", prefs && Object.prototype.hasOwnProperty.call(prefs, "disabled")
          ? Boolean(prefs.disabled)
          : descriptor.enabled === false);
        calendar.setProperty("calendar-main-in-composite", prefs && Object.prototype.hasOwnProperty.call(prefs, "visible")
          ? Boolean(prefs.visible)
          : descriptor.visible !== false);
        calendar.setProperty("suppressAlarms", prefs && Object.prototype.hasOwnProperty.call(prefs, "suppressAlarms")
          ? Boolean(prefs.suppressAlarms)
          : false);
        if (prefs && Object.prototype.hasOwnProperty.call(prefs, "notificationsTimes") && prefs.notificationsTimes != null) {
          calendar.setProperty("notifications.times", prefs.notificationsTimes);
        }
      }

      // The native Thunderbird calendar properties dialog expects
      // imip.identity to resolve from imip.identity.key. Select the mail account
      // whose address matches the signed-in M365 user by default, but preserve an
      // explicit saved choice (including an intentionally empty/None selection).
      let identityKey = null;
      if (prefs && Object.prototype.hasOwnProperty.call(prefs, "identityKey")) {
        identityKey = safeString(prefs.identityKey);
      } else if (isNew || !safeString(calendar.getProperty("imip.identity.key"))) {
        identityKey = safeString(identityForEmail(descriptor.organizerId)?.key || "");
      }
      if (identityKey !== null) calendar.setProperty("imip.identity.key", identityKey);
    });
  }

  function calendarStartupReady() {
    try {
      const service = Cc["@mozilla.org/calendar/startup-service;1"].getService().wrappedJSObject;
      return Boolean(service?.started);
    } catch (_) {
      return false;
    }
  }

  async function waitForCalendarStartup() {
    if (calendarStartupReady()) return;
    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { Services.obs.removeObserver(observer, "calendar-startup-done"); } catch (_) {}
        resolve();
      };
      const observer = { observe: finish };
      Services.obs.addObserver(observer, "calendar-startup-done");
      // If the notification raced us, the started flag is already set.
      if (calendarStartupReady()) finish();
    });
  }

  class NoEmailTransport {
    wrappedJSObject = this;
    QueryInterface = ChromeUtils.generateQI(["calIItipTransport"]);
    senderAddress = "";
    get scheme() { return "mailto"; }
    get type() { return "m365-graph"; }
    sendItems() {
      // Exchange Online/Graph sends scheduling messages server-side.
      return true;
    }
  }

  function providerType(extension) {
    return "ext-" + extension.id;
  }

  function rawCalendar(calendar) {
    try {
      return calendar?.wrappedJSObject?.mUncachedCalendar?.wrappedJSObject ||
        calendar?.wrappedJSObject?.mUncachedCalendar ||
        calendar?.wrappedJSObject ||
        calendar;
    } catch (_) {
      return calendar;
    }
  }

  function isOwnCalendar(calendar, extension) {
    try {
      return String(calendar?.type || rawCalendar(calendar)?.type || "") === providerType(extension);
    } catch (_) {
      return false;
    }
  }

  function isM365SiblingCalendar(calendar, extension, desiredGraphIds = null) {
    if (!calendar || isOwnCalendar(calendar, extension)) return false;
    try {
      const graphId = safeString(calendar?.getProperty?.(PROP_GRAPH_ID) || rawCalendar(calendar)?.getProperty?.(PROP_GRAPH_ID));
      if (!graphId) return false;
      if (desiredGraphIds && !desiredGraphIds.has(graphId)) return false;
      const uri = safeString(calendar?.uri?.spec || rawCalendar(calendar)?.uri?.spec);
      return /^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/calendars\//i.test(uri);
    } catch (_) {
      return false;
    }
  }

  function calendarDescriptor(calendar) {
    const raw = rawCalendar(calendar);
    const get = name => {
      try { return calendar?.getProperty?.(name) ?? raw?.getProperty?.(name) ?? null; } catch (_) { return null; }
    };
    return {
      id: String(calendar?.id || raw?.id || ""),
      graphCalendarId: String(get(PROP_GRAPH_ID) || ""),
      accountId: String(get(PROP_ACCOUNT_ID) || ""),
      name: String(calendar?.name || get("name") || "Microsoft 365"),
      color: String(get("color") || "#4f6bed"),
      readOnly: Boolean(calendar?.readOnly || get("readOnly")),
      visible: get("calendar-main-in-composite") !== false,
      enabled: !Boolean(get("disabled")),
      organizerId: String(get(PROP_ORGANIZER_ID) || ""),
      organizerName: String(get(PROP_ORGANIZER_NAME) || ""),
      identityEmail: String(get("imip.identity")?.email || "")
    };
  }

  function safeString(value) {
    return value == null ? "" : String(value);
  }

  function dateTimeToIso(dt) {
    if (!dt) return "";
    try {
      if (dt.isDate) {
        const y = String(dt.year).padStart(4, "0");
        const m = String(dt.month + 1).padStart(2, "0");
        const d = String(dt.day).padStart(2, "0");
        return `${y}-${m}-${d}T00:00:00.000Z`;
      }
      return cal.dtz.dateTimeToJsDate(dt.getInTimezone(cal.dtz.UTC)).toISOString();
    } catch (_) {
      try { return cal.dtz.dateTimeToJsDate(dt).toISOString(); } catch (_) { return ""; }
    }
  }

  function isoToDateTime(value, allDay = false) {
    if (!value) return null;
    if (allDay) {
      // A Graph all-day event is a calendar date, not an instant. Construct it
      // directly so the host machine timezone cannot move it to another day.
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
      if (!match) return null;
      const dt = new CalDateTime();
      dt.resetTo(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, cal.dtz.UTC);
      dt.isDate = true;
      return dt;
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    // Do not pass UTC as the second parameter: Thunderbird then interprets the
    // JS Date's *local wall-clock fields* as UTC. Preserve the instant first,
    // then convert the resulting CalDateTime to UTC.
    return cal.dtz.jsDateToDateTime(date).getInTimezone(cal.dtz.UTC);
  }

  function normalizeMail(value) {
    return safeString(value).replace(/^mailto:/i, "").trim().toLowerCase();
  }

  function calendarSelfAddresses(calendar) {
    const addresses = new Set();
    const add = value => {
      const normalized = normalizeMail(value);
      if (normalized) addresses.add(normalized);
    };
    try { add(calendar?.getProperty?.(PROP_ORGANIZER_ID)); } catch (_) {}
    try { add(calendar?.getProperty?.("imip.identity")?.email); } catch (_) {}
    try {
      const key = safeString(calendar?.getProperty?.("imip.identity.key"));
      if (key) add(identityForKey(key)?.email);
    } catch (_) {}
    return addresses;
  }

  // V2.28 native mapping schema. Graph changeKey does not change when only
  // our Thunderbird-side representation changes, so cache migration must be
  // tracked separately from server content.
  const NATIVE_MAPPING_VERSION = "2.34-itip-teams-links";

  function attendeeToPlain(attendee) {
    if (!attendee) return null;
    return {
      address: normalizeMail(attendee.id),
      name: safeString(attendee.commonName),
      role: safeString(attendee.role || "REQ-PARTICIPANT"),
      status: safeString(attendee.participationStatus || "NEEDS-ACTION"),
      rsvp: attendee.rsvp !== "FALSE" && attendee.rsvp !== false,
      type: safeString(attendee.userType || "INDIVIDUAL")
    };
  }

  function plainToAttendee(data, organizer = false) {
    if (!data?.address) return null;
    const attendee = new CalAttendee();
    attendee.id = `mailto:${data.address}`;
    attendee.commonName = safeString(data.name) || null;
    attendee.role = safeString(data.role) || (organizer ? "CHAIR" : "REQ-PARTICIPANT");
    attendee.participationStatus = safeString(data.status) || (organizer ? "ACCEPTED" : "NEEDS-ACTION");
    attendee.rsvp = data.rsvp === false ? "FALSE" : "TRUE";
    attendee.userType = safeString(data.type) || "INDIVIDUAL";
    attendee.isOrganizer = organizer;
    return attendee;
  }

  function itemToPlain(item) {
    const syntheticSelfMirror = safeString(item?.getProperty?.("X-M365-SYNTHETIC-SELF")).toUpperCase() === "TRUE";
    const attendees = [];
    if (!syntheticSelfMirror) {
      try {
        for (const attendee of item.getAttendees() || []) {
          const converted = attendeeToPlain(attendee);
          if (converted?.address) attendees.push(converted);
        }
      } catch (_) {}
    }

    let categories = [];
    try { categories = item.getCategories() || []; } catch (_) {}

    let reminderMinutes = null;
    try {
      const displayAlarm = (item.getAlarms() || []).find(alarm => alarm.action === "DISPLAY");
      if (displayAlarm?.offset) {
        reminderMinutes = Math.max(0, Math.round(Math.abs(displayAlarm.offset.inSeconds) / 60));
      }
    } catch (_) {}

    const organizer = attendeeToPlain(item.organizer);
    return {
      id: safeString(item.id),
      title: safeString(item.title),
      start: dateTimeToIso(item.startDate),
      end: dateTimeToIso(item.endDate),
      allDay: Boolean(item.startDate?.isDate),
      location: safeString(item.getProperty("LOCATION")),
      description: safeString(item.getProperty("DESCRIPTION")),
      url: safeString(item.getProperty("URL")),
      webLink: safeString(item.getProperty("X-M365-WEBLINK")),
      status: safeString(item.status),
      privacy: safeString(item.privacy),
      transparency: safeString(item.getProperty("TRANSP")),
      categories: categories.map(safeString),
      organizer: organizer?.address ? organizer : undefined,
      attendees,
      reminderMinutes: reminderMinutes == null ? undefined : reminderMinutes,
      isCancelled: safeString(item.status).toUpperCase() === "CANCELLED",
      isOnlineMeeting: Boolean(item.getProperty("X-M365-ONLINE")),
      isAppointment: safeString(item.getProperty("X-M365-APPOINTMENT")).toUpperCase() === "TRUE",
      nativeSelfMirror: syntheticSelfMirror,
      isOrganizer: safeString(item.getProperty("X-M365-IS-ORGANIZER")).toUpperCase() === "TRUE",
      responseStatus: safeString(item.getProperty("X-M365-RESPONSE")),
      graphType: safeString(item.getProperty("X-M365-GRAPH-TYPE")),
      seriesMasterId: safeString(item.getProperty("X-M365-SERIES-MASTER-ID")),
      changeKey: safeString(item.getProperty("X-M365-CHANGEKEY")),
      iCalUId: safeString(item.getProperty("X-M365-ICALUID")),
      nativeUid: safeString(item.id),
      invitedAttendee: normalizeMail(item.getProperty("X-MOZ-INVITED-ATTENDEE"))
    };
  }

  // V2.36: Thunderbird mutates local alarm bookkeeping when a reminder is
  // dismissed or snoozed. None of those bookkeeping fields are part of the
  // Microsoft Graph event model used by this provider. If the plain remote
  // representation is unchanged, keep the exact Thunderbird item locally and
  // do not call the extension/background write handler at all.
  function plainRemoteOperationSignature(data) {
    const attendeeRows = (Array.isArray(data?.attendees) ? data.attendees : [])
      .map(attendee => ({
        address: normalizeMail(attendee?.address),
        name: safeString(attendee?.name),
        role: safeString(attendee?.role),
        status: safeString(attendee?.status),
        rsvp: attendee?.rsvp !== false,
        type: safeString(attendee?.type)
      }))
      .sort((a, b) => `${a.address}|${a.role}|${a.type}|${a.name}|${a.status}`.localeCompare(`${b.address}|${b.role}|${b.type}|${b.name}|${b.status}`));
    const organizer = data?.organizer?.address ? {
      address: normalizeMail(data.organizer.address),
      name: safeString(data.organizer.name),
      role: safeString(data.organizer.role),
      status: safeString(data.organizer.status),
      rsvp: data.organizer.rsvp !== false,
      type: safeString(data.organizer.type)
    } : null;
    return JSON.stringify({
      title: safeString(data?.title),
      start: safeString(data?.start),
      end: safeString(data?.end),
      allDay: Boolean(data?.allDay),
      location: safeString(data?.location),
      description: safeString(data?.description),
      url: safeString(data?.url),
      status: safeString(data?.status),
      privacy: safeString(data?.privacy),
      transparency: safeString(data?.transparency),
      categories: (Array.isArray(data?.categories) ? data.categories : []).map(safeString).sort(),
      organizer,
      attendees: attendeeRows,
      reminderMinutes: data?.reminderMinutes == null ? null : Number(data.reminderMinutes),
      isCancelled: Boolean(data?.isCancelled),
      isOnlineMeeting: Boolean(data?.isOnlineMeeting),
      isAppointment: Boolean(data?.isAppointment),
      isOrganizer: Boolean(data?.isOrganizer),
      responseStatus: safeString(data?.responseStatus),
      invitedAttendee: normalizeMail(data?.invitedAttendee)
    });
  }

  function addReminder(item, minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n < 0) return;
    try {
      const alarm = new CalAlarm();
      alarm.action = "DISPLAY";
      alarm.related = Ci.calIAlarm.ALARM_RELATED_START;
      const duration = cal.createDuration();
      duration.inSeconds = -Math.round(n * 60);
      alarm.offset = duration;
      item.addAlarm(alarm);
    } catch (error) {
      console.warn("M365 native: could not add reminder", error);
    }
  }

  function plainToItem(data, calendar) {
    const item = new CalEvent();
    if (data?.id) item.id = safeString(data.id);
    item.title = safeString(data?.title) || "(no subject)";
    const allDay = Boolean(data?.allDay);
    item.startDate = isoToDateTime(data?.start, allDay);
    item.endDate = isoToDateTime(data?.end, allDay);
    if (!item.startDate || !item.endDate) {
      throw new Error("Native item has invalid start/end");
    }
    item.calendar = calendar?.superCalendar || calendar || null;

    if (data?.location) item.setProperty("LOCATION", safeString(data.location));
    if (data?.description) item.setProperty("DESCRIPTION", safeString(data.description));
    if (data?.url) item.setProperty("URL", safeString(data.url));
    if (data?.webLink) item.setProperty("X-M365-WEBLINK", safeString(data.webLink));
    if (data?.isOnlineMeeting) item.setProperty("X-M365-ONLINE", "TRUE");
    if (data?.isAppointment) item.setProperty("X-M365-APPOINTMENT", "TRUE");
    if (data?.isOrganizer) item.setProperty("X-M365-IS-ORGANIZER", "TRUE");
    if (data?.responseStatus) item.setProperty("X-M365-RESPONSE", safeString(data.responseStatus));
    if (data?.graphType) item.setProperty("X-M365-GRAPH-TYPE", safeString(data.graphType));
    if (data?.seriesMasterId) item.setProperty("X-M365-SERIES-MASTER-ID", safeString(data.seriesMasterId));
    if (data?.changeKey) item.setProperty("X-M365-CHANGEKEY", safeString(data.changeKey));
    if (data?.iCalUId) item.setProperty("X-M365-ICALUID", safeString(data.iCalUId));
    item.setProperty("X-M365-NATIVE-MAP-VERSION", NATIVE_MAPPING_VERSION);

    if (data?.status) item.status = safeString(data.status).toUpperCase();
    if (data?.privacy) item.privacy = safeString(data.privacy).toUpperCase();
    if (data?.transparency) item.setProperty("TRANSP", safeString(data.transparency).toUpperCase());
    if (data?.isCancelled) item.status = "CANCELLED";

    try { item.setCategories((data?.categories || []).map(safeString)); } catch (_) {}

    const calendarSelfAddress = normalizeMail(calendar?.getProperty?.(PROP_ORGANIZER_ID));
    const calendarSelfName = safeString(calendar?.getProperty?.(PROP_ORGANIZER_NAME));
    let organizerData = data?.organizer?.address ? data.organizer : null;
    // Appointments are always the signed-in user's own calendar objects. Use
    // the calendar identity for the native mirror even if Graph exposes the
    // organizer through another SMTP/UPN alias. This prevents Thunderbird from
    // misclassifying a personal appointment as an invitation from another user.
    if (data?.isAppointment && calendarSelfAddress) {
      organizerData = { address: calendarSelfAddress, name: calendarSelfName, role: "CHAIR", status: "ACCEPTED", rsvp: false, type: "INDIVIDUAL" };
    }
    if (organizerData?.address) {
      item.organizer = plainToAttendee(organizerData, true);
    }

    // V2.27 native-render mirror: on the user's real Thunderbird installation
    // scheduled/online items render reliably while otherwise equivalent personal
    // appointments do not. Mirror a plain appointment through the same accepted
    // scheduling shape by adding the owner as a synthetic attendee. The marker
    // makes itemToPlain() strip this attendee before any Graph PATCH/POST.
    const sourceAttendees = Array.isArray(data?.attendees) ? data.attendees : [];
    if (data?.isAppointment && sourceAttendees.length === 0 && calendarSelfAddress) {
      const selfAttendee = plainToAttendee({
        address: calendarSelfAddress,
        name: calendarSelfName,
        role: "REQ-PARTICIPANT",
        status: "ACCEPTED",
        rsvp: false,
        type: "INDIVIDUAL"
      }, false);
      if (selfAttendee) item.addAttendee(selfAttendee);
      item.setProperty("X-M365-SYNTHETIC-SELF", "TRUE");
    } else {
      for (const attendeeData of sourceAttendees) {
        const attendee = plainToAttendee(attendeeData, false);
        if (attendee) item.addAttendee(attendee);
      }
      // Thunderbird's iTIP logic needs the concrete invited identity. This
      // also covers Exchange/EWS identities whose SMTP address differs from
      // the Microsoft Graph UPN used for the calendar account.
      const selfAddresses = calendarSelfAddresses(calendar);
      const invited = sourceAttendees.find(attendeeData => selfAddresses.has(normalizeMail(attendeeData?.address)));
      if (!data?.isOrganizer && invited?.address) {
        item.setProperty("X-MOZ-INVITED-ATTENDEE", `mailto:${normalizeMail(invited.address)}`);
      }
    }
    if (data?.reminderMinutes != null) addReminder(item, data.reminderMinutes);
    return item;
  }

  function stackContains(part) {
    return new Error().stack.includes(part);
  }

  function operationOptions(existing = {}) {
    const options = { ...existing };
    if (stackContains("calItipUtils")) options.invitation = true;
    if (stackContains("playbackOfflineItems")) options.offline = true;
    return options;
  }

  function firstUsefulResult(results) {
    for (const result of results || []) {
      if (result !== undefined && result !== null) return result;
    }
    return null;
  }

  const providerInstances = new Map();
  const nativeTrace = {
    lastOperation: "",
    lastErrorStage: "",
    lastError: "",
    trace: []
  };
  const nativeDirectEventStats = {
    upserts: 0,
    removes: 0,
    lastCalendarId: "",
    lastEventId: "",
    lastOperation: "",
    lastStored: false,
    lastTitle: "",
    lastStart: "",
    lastEnd: "",
    lastAppointment: false,
    lastOnlineMeeting: false,
    lastSyntheticSelf: false,
    lastError: ""
  };

  const nativeSyncStats = {
    lastStartedAt: "",
    lastFinishedAt: "",
    graphEvents: 0,
    cacheWrites: 0,
    cacheAdds: 0,
    cacheModifies: 0,
    cacheDeletes: 0,
    cacheUnchanged: 0,
    cacheMappingRepairs: 0,
    cacheVisibilityRepairs: 0,
    cacheItems: 0,
    graphAppointments: 0,
    graphOnlineMeetings: 0,
    graphOtherMeetings: 0,
    cacheAppointments: 0,
    cacheOnlineMeetings: 0,
    cacheOtherMeetings: 0,
    cacheSyntheticSelf: 0,
    directPushes: 0,
    lastGraphCalendarId: "",
    mode: "",
    message: "",
    error: ""
  };

  // Serialize every writer for one Graph calendar. Thunderbird's own
  // "Reload Calendars and Changes" can invoke provider replay while the
  // WebExtension also performs a direct cache push; running both concurrently
  // corrupts the observer lifecycle even if the SQLite rows are eventually sane.
  const nativeCalendarSyncLocks = new Map();
  function withCalendarSyncLock(graphCalendarId, task) {
    const key = safeString(graphCalendarId) || "__unknown__";
    const previous = nativeCalendarSyncLocks.get(key) || Promise.resolve();
    const run = previous.catch(() => {}).then(task);
    nativeCalendarSyncLocks.set(key, run);
    return run.finally(() => {
      if (nativeCalendarSyncLocks.get(key) === run) nativeCalendarSyncLocks.delete(key);
    });
  }

  // V2.18: Thunderbird can leave stale event DOM nodes behind when a cached
  // provider calendar is removed from and added back to the composite view.
  // The built-in calendar code itself uses currentView().goToDay() as a
  // no-navigation refresh. Keep a small observer here and request that same
  // full view refresh after an M365 Hide/Show transition.
  const nativeViewReloadStats = {
    scheduled: 0,
    executed: 0,
    refreshedViews: 0,
    lastReason: "",
    lastError: ""
  };
  let nativeVisibilityObserver = null;
  let nativeViewReloadPending = false;

  function reloadOpenCalendarViews(reason = "manual") {
    let refreshed = 0;
    let lastError = "";
    try {
      const windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        try {
          if (!win || win.closed || typeof win.currentView !== "function") continue;
          const view = win.currentView();
          if (!view || typeof view.goToDay !== "function") continue;
          // Calling goToDay() without a date is Thunderbird's own refresh path:
          // the current range is kept, while the view is rebuilt and its items
          // are queried again from the composite calendar.
          view.goToDay();
          refreshed += 1;
        } catch (error) {
          lastError = errorText(error);
        }
      }
    } catch (error) {
      lastError = errorText(error);
    }
    nativeViewReloadStats.executed += 1;
    nativeViewReloadStats.refreshedViews = refreshed;
    nativeViewReloadStats.lastReason = safeString(reason);
    nativeViewReloadStats.lastError = lastError;
    return refreshed;
  }

  function scheduleCalendarViewReload(reason = "visibility") {
    nativeViewReloadStats.scheduled += 1;
    nativeViewReloadStats.lastReason = safeString(reason);
    if (nativeViewReloadPending) return;
    nativeViewReloadPending = true;
    // Composite add/remove changes the persistent calendar property while it is
    // still processing the click. Run the refresh on the next main-thread turn
    // so the composite membership has settled first.
    Services.tm.dispatchToMainThread(() => {
      nativeViewReloadPending = false;
      reloadOpenCalendarViews(nativeViewReloadStats.lastReason || reason);
    });
  }

  function ensureVisibilityReloadObserver(extension) {
    if (nativeVisibilityObserver) return;
    nativeVisibilityObserver = {
      QueryInterface: ChromeUtils.generateQI(["calIObserver"]),
      onStartBatch() {},
      onEndBatch() {},
      onLoad() {},
      onAddItem() {},
      onModifyItem() {},
      onDeleteItem() {},
      onError() {},
      onPropertyChanged(calendar, name, value) {
        if (!isOwnCalendar(calendar, extension)) return;
        if (programmaticCalendarMutationDepth === 0 && USER_PREF_PROPERTIES.has(name)) {
          snapshotCalendarUserPrefs(extension, calendar);
        }
        if (name === "calendar-main-in-composite" && programmaticCalendarMutationDepth === 0) {
          scheduleCalendarViewReload(value ? "visibility:show" : "visibility:hide");
        }
      },
      onPropertyDeleting(calendar, name) {
        if (!isOwnCalendar(calendar, extension)) return;
        if (programmaticCalendarMutationDepth === 0 && USER_PREF_PROPERTIES.has(name)) {
          deleteSavedCalendarProperty(extension, calendar, name);
        }
        if (name === "calendar-main-in-composite" && programmaticCalendarMutationDepth === 0) {
          scheduleCalendarViewReload("visibility:hide");
        }
      }
    };
    cal.manager.addCalendarObserver(nativeVisibilityObserver);
  }

  function removeVisibilityReloadObserver() {
    if (!nativeVisibilityObserver) return;
    try { cal.manager.removeCalendarObserver(nativeVisibilityObserver); } catch (_) {}
    nativeVisibilityObserver = null;
  }

  const TEAMS_BUTTON_ID = "m365-native-teams-meeting-button";
  const TEAMS_BUTTON_GROUP_ID = "m365-native-teams-meeting-button-group";
  const nativeTeamsUiStats = {
    injectedWindows: 0,
    contextMenus: 0,
    clicks: 0,
    contextClicks: 0,
    lastError: ""
  };

  function extensionMessage(extension, key, fallback) {
    try {
      return extension?.localeData?.localizeMessage?.(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }


  const TEAMS_CONTEXT_ID = "m365-native-teams-meeting-context";
  const nativeEventEditorHandlers = new Map();
  const nativeEventEditorStats = { installedWindows: 0, doubleClicks: 0, requests: 0, lastEventId: "", lastError: "" };

  function selectedM365GraphCalendarId(win, extension) {
    try {
      const selected = typeof win.getSelectedCalendar === "function" ? win.getSelectedCalendar() : null;
      if (selected && isOwnCalendar(selected, extension) && !selected.readOnly) {
        return safeString(selected.getProperty(PROP_GRAPH_ID));
      }
    } catch (_) {}
    return "";
  }

  function selectedTeamsMeetingStart(win) {
    try {
      const view = typeof win.currentView === "function" ? win.currentView() : null;
      let start = view?.selectedDateTime || null;
      if (!start && view?.selectedDay) start = cal.dtz.getDefaultStartDate(view.selectedDay);
      if (start?.isDate) start = cal.dtz.getDefaultStartDate(start);
      if (!start) return "";
      return cal.dtz.dateTimeToJsDate(start.getInTimezone(cal.dtz.UTC)).toISOString();
    } catch (_) {
      return "";
    }
  }

  function emitTeamsMeetingRequest(win, extension, source) {
    nativeTeamsUiStats.clicks += 1;
    const details = {
      source,
      graphCalendarId: selectedM365GraphCalendarId(win, extension),
      timestamp: Date.now()
    };
    if (source === "native-calendar-context") {
      const start = selectedTeamsMeetingStart(win);
      if (start) details.start = start;
      nativeTeamsUiStats.contextClicks += 1;
    }
    const result = extension.emit("nativeCalendar.onTeamsMeetingRequested", details);
    if (result?.catch) {
      result.catch(error => {
        nativeTeamsUiStats.lastError = errorText(error);
        console.error("M365 Teams meeting request failed", error);
      });
    }
  }

  function itemFromCalendarDoubleClick(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      try {
        const item = node?.occurrence || node?.mOccurrence || node?.item || null;
        if (item?.calendar && item?.id) return item;
      } catch (_) {}
    }
    let node = event?.target || null;
    while (node) {
      try {
        const item = node?.occurrence || node?.mOccurrence || node?.item || null;
        if (item?.calendar && item?.id) return item;
      } catch (_) {}
      node = node.parentNode || node.host || null;
    }
    return null;
  }

  function graphCalendarIdForItem(item, extension) {
    try {
      const calendar = item?.calendar;
      if (!calendar || !isOwnCalendar(calendar, extension)) return "";
      return safeString(calendar.getProperty?.(PROP_GRAPH_ID) || rawCalendar(calendar)?.getProperty?.(PROP_GRAPH_ID));
    } catch (_) {
      return "";
    }
  }

  function installNativeEventEditorDoubleClick(extension) {
    let installed = 0;
    try {
      const windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        if (!win || win.closed || !win.document || !win.document.getElementById("calendarTabPanel")) continue;
        if (nativeEventEditorHandlers.has(win)) continue;
        const handler = event => {
          try {
            if (event.button !== 0) return;
            const item = itemFromCalendarDoubleClick(event);
            if (!item) return;
            const graphCalendarId = graphCalendarIdForItem(item, extension);
            if (!graphCalendarId) return;
            const eventId = safeString(item.id);
            if (!eventId) return;

            // Capture-phase interception is intentional: Thunderbird's
            // calendar-editable-item handles dblclick itself and otherwise opens
            // the built-in event dialog. M365 events use our Graph-aware editor.
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

            nativeEventEditorStats.doubleClicks += 1;
            nativeEventEditorStats.requests += 1;
            nativeEventEditorStats.lastEventId = eventId;
            const result = extension.emit("nativeCalendar.onEventEditRequested", {
              source: "native-calendar-dblclick",
              graphCalendarId,
              eventId,
              timestamp: Date.now()
            });
            if (result?.catch) result.catch(error => {
              nativeEventEditorStats.lastError = errorText(error);
              console.error("M365 native event editor request failed", error);
            });
          } catch (error) {
            nativeEventEditorStats.lastError = errorText(error);
            console.error("M365 native event double-click interception failed", error);
          }
        };
        win.addEventListener("dblclick", handler, true);
        nativeEventEditorHandlers.set(win, handler);
        installed += 1;
      }
    } catch (error) {
      nativeEventEditorStats.lastError = errorText(error);
    }
    nativeEventEditorStats.installedWindows = nativeEventEditorHandlers.size;
    return installed;
  }

  function removeNativeEventEditorDoubleClick() {
    for (const [win, handler] of nativeEventEditorHandlers.entries()) {
      try { win.removeEventListener("dblclick", handler, true); } catch (_) {}
    }
    nativeEventEditorHandlers.clear();
    nativeEventEditorStats.installedWindows = 0;
  }

  function injectTeamsMeetingButton(extension) {
    let injected = 0;
    let contextMenus = 0;
    let lastError = "";
    try {
      const windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        try {
          if (!win || win.closed || !win.document) continue;
          const doc = win.document;
          if (!doc.getElementById("calendarTabPanel")) continue;

          if (!doc.getElementById(TEAMS_BUTTON_ID)) {
            const controls = doc.getElementById("calendarControls");
            const sidePanel = doc.getElementById("primaryButtonSidePanel");
            const target = controls || sidePanel;
            if (target) {
              const ns = "http://www.w3.org/1999/xhtml";
              const button = doc.createElementNS(ns, "button");
              button.id = TEAMS_BUTTON_ID;
              button.type = "button";
              button.className = controls ? "button button-primary" : "button button-primary icon-button";
              button.textContent = extensionMessage(extension, "nativeTeamsMeetingButton", "Teams meeting");
              button.title = extensionMessage(
                extension,
                "nativeTeamsMeetingTooltip",
                "Create a new Microsoft Teams meeting in the Microsoft 365 calendar"
              );
              button.style.marginInlineStart = "8px";
              button.style.whiteSpace = "nowrap";
              button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                try {
                  emitTeamsMeetingRequest(win, extension, "native-calendar");
                } catch (error) {
                  nativeTeamsUiStats.lastError = errorText(error);
                  console.error("M365 Teams meeting button failed", error);
                }
              });
              if (controls) {
                const group = doc.createElementNS(ns, "div");
                group.id = TEAMS_BUTTON_GROUP_ID;
                group.className = "button-group";
                group.appendChild(button);
                controls.appendChild(group);
              } else {
                target.appendChild(button);
              }
              injected += 1;
            }
          }

          if (!doc.getElementById(TEAMS_CONTEXT_ID)) {
            const popup = doc.getElementById("calendar-view-context-menu");
            if (popup) {
              const item = typeof doc.createXULElement === "function"
                ? doc.createXULElement("menuitem")
                : doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
              item.id = TEAMS_CONTEXT_ID;
              item.setAttribute("label", extensionMessage(extension, "nativeTeamsMeetingContext", "New Teams meeting"));
              item.addEventListener("command", event => {
                event.preventDefault();
                event.stopPropagation();
                try {
                  emitTeamsMeetingRequest(win, extension, "native-calendar-context");
                } catch (error) {
                  nativeTeamsUiStats.lastError = errorText(error);
                  console.error("M365 Teams meeting context action failed", error);
                }
              });
              const after = doc.getElementById("calendar-view-context-menu-newevent");
              if (after?.parentNode === popup) popup.insertBefore(item, after.nextSibling);
              else popup.prepend(item);
              contextMenus += 1;
            }
          }
        } catch (error) {
          lastError = errorText(error);
        }
      }
    } catch (error) {
      lastError = errorText(error);
    }
    nativeTeamsUiStats.injectedWindows = injected || nativeTeamsUiStats.injectedWindows;
    nativeTeamsUiStats.contextMenus = contextMenus || nativeTeamsUiStats.contextMenus;
    nativeTeamsUiStats.lastError = lastError;
    return injected + contextMenus;
  }

  function removeTeamsMeetingButtons() {
    try {
      const windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        const doc = win?.document;
        if (!doc) continue;
        try { doc.getElementById(TEAMS_BUTTON_GROUP_ID)?.remove(); } catch (_) {}
        try { doc.getElementById(TEAMS_BUTTON_ID)?.remove(); } catch (_) {}
        try { doc.getElementById(TEAMS_CONTEXT_ID)?.remove(); } catch (_) {}
      }
    } catch (_) {}
  }

  function errorText(error) {
    const result = error?.result != null ? ` result=${error.result}` : "";
    return `${error?.name ? `${error.name}: ` : ""}${error?.message || String(error)}${result}`;
  }

  function resetTrace(operation) {
    nativeTrace.lastOperation = operation;
    nativeTrace.lastErrorStage = "";
    nativeTrace.lastError = "";
    nativeTrace.trace = [];
  }

  function trace(stage, ok, detail = "") {
    nativeTrace.trace.push({ stage, ok: Boolean(ok), detail: safeString(detail) });
  }

  async function stage(stageName, fn) {
    try {
      const value = await fn();
      trace(stageName, true);
      return value;
    } catch (error) {
      const detail = errorText(error);
      nativeTrace.lastErrorStage = stageName;
      nativeTrace.lastError = detail;
      trace(stageName, false, detail);
      throw new Error(`[${stageName}] ${detail}`);
    }
  }

  function stageSync(stageName, fn) {
    try {
      const value = fn();
      trace(stageName, true);
      return value;
    } catch (error) {
      const detail = errorText(error);
      nativeTrace.lastErrorStage = stageName;
      nativeTrace.lastError = detail;
      trace(stageName, false, detail);
      throw new Error(`[${stageName}] ${detail}`);
    }
  }

  class M365CalendarProvider {
    QueryInterface = ChromeUtils.generateQI(["calICalendarProvider"]);

    static register(extension) {
      const type = providerType(extension);

      if (!cal.manager.hasCalendarProvider(type)) {
        cal.manager.registerCalendarProvider(
          type,
          class extends M365Calendar {
            constructor() {
              super(extension);
            }
          }
        );
      }

      // Thunderbird's maintained Calendar Experiment registers both the dynamic
      // Calendar Manager implementation and a calICalendarProvider. Mirror that
      // exact structure instead of relying on manager registration alone.
      if (!providerInstances.has(type)) {
        const provider = new M365CalendarProvider(extension);
        cal.provider.register(provider);
        providerInstances.set(type, provider);
      }
    }

    static unregister(extension) {
      const type = providerType(extension);
      try { cal.manager.unregisterCalendarProvider(type, true); } catch (_) {}
      try { cal.provider.unregister(type); } catch (_) {}
      providerInstances.delete(type);
    }

    constructor(extension) {
      this.extension = extension;
    }

    get type() {
      return providerType(this.extension);
    }

    get displayName() {
      return "Microsoft 365";
    }

    createCalendar() {
      throw new Components.Exception("Not implemented", Cr.NS_ERROR_NOT_IMPLEMENTED);
    }

    deleteCalendar() {
      throw new Components.Exception("Not implemented", Cr.NS_ERROR_NOT_IMPLEMENTED);
    }

    getCalendar(url) {
      const calendar = new M365Calendar(this.extension);
      calendar.uri = url;
      return calendar;
    }
  }

  class M365Calendar extends cal.provider.BaseClass {
    QueryInterface = ChromeUtils.generateQI(["calICalendar", "calIChangeLog", "calISchedulingSupport"]);

    constructor(extension) {
      super();
      this.initProviderBase();
      this.extension = extension;
      this.wrappedJSObject = this;
      this._cachedAdoptItemCallback = null;
      this._cachedModifyItemCallback = null;
    }

    get type() {
      return providerType(this.extension);
    }

    get providerID() {
      return this.extension?.id || null;
    }

    // ChangeLog providers are synchronized by Thunderbird's calCachedCalendar.
    // Returning false here makes the cache wrapper call synchronize() ->
    // replayChangesOn(), which fills offlineStorage with the Graph snapshot.
    get canRefresh() { return false; }

    get supportsScheduling() { return true; }
    getSchedulingSupport() { return this; }

    isInvitation(item) {
      const organizer = normalizeMail(item?.organizer?.id);
      const ownAddresses = calendarSelfAddresses(this);
      return Boolean(organizer && ownAddresses.size && !ownAddresses.has(organizer));
    }

    getInvitedAttendee(item) {
      const ownAddresses = calendarSelfAddresses(this);
      try {
        const attendees = item?.getAttendees?.() || [];
        const explicit = normalizeMail(item?.getProperty?.("X-MOZ-INVITED-ATTENDEE"));
        if (explicit) {
          const match = attendees.find(attendee => normalizeMail(attendee.id) === explicit);
          if (match) return match;
        }
        return attendees.find(attendee => ownAddresses.has(normalizeMail(attendee.id))) || null;
      } catch (_) {
        return null;
      }
    }

    canNotify() {
      // Graph/Exchange Online is responsible for all meeting notifications.
      return true;
    }

    getProperty(name) {
      switch (name) {
        case "cache.supported":
        case "cache.enabled":
        case "cache.always":
          return true;
        case "requiresNetwork":
          return true;
        case "capabilities.tasks.supported":
          return false;
        case "capabilities.events.supported":
          return true;
        case "capabilities.attachments.supported":
          return false;
        case "capabilities.alarms.maxCount":
          return 1;
        case "capabilities.alarms.actionValues":
          return ["DISPLAY"];
        case "capabilities.removeModes":
          return ["unsubscribe"];
        case "organizerId": {
          const value = super.getProperty(PROP_ORGANIZER_ID);
          return value ? `mailto:${normalizeMail(value)}` : null;
        }
        case "organizerCN":
          return super.getProperty(PROP_ORGANIZER_NAME) || null;
        case "imip.identity.disabled":
          return false;
        case "imip.identity": {
          const graphId = safeString(super.getProperty(PROP_GRAPH_ID));
          const saved = savedCalendarUserPrefs(this.extension, graphId);
          if (saved && Object.prototype.hasOwnProperty.call(saved, "identityKey")) {
            return identityForKey(saved.identityKey);
          }
          const key = safeString(super.getProperty("imip.identity.key"));
          if (key) return identityForKey(key);
          // If no key has ever been stored, use the identity matching the M365
          // organizer as a sensible initial selection in Thunderbird's calendar
          // properties dialog.
          return identityForEmail(super.getProperty(PROP_ORGANIZER_ID));
        }
        case "imip.account":
          return accountForIdentity(this.getProperty("imip.identity"));
        case "itip.transport":
          return new NoEmailTransport();
        default:
          return super.getProperty(name);
      }
    }

    addItem(item) { return this.adoptItem(item.clone()); }

    async adoptItem(inputItem) {
      // CalCachedCalendar injects this callback before invoking the uncached
      // provider. Store it before the first await so concurrent operations do
      // not accidentally consume each other's callback.
      const cachedCallback = this._cachedAdoptItemCallback;
      const options = operationOptions();
      try {
        const results = await this.extension.emit(
          "nativeCalendar.onItemCreated",
          calendarDescriptor(this),
          itemToPlain(inputItem),
          options
        );
        const result = firstUsefulResult(results);
        if (!result?.id) throw new Error("Microsoft 365 did not return the created event");
        const item = plainToItem(result, this);
        if (result?.nativeOperation === "rsvp-existing" && item?.id) {
          // CalCachedCalendar's ADD callback inserts the returned provider item.
          // Email iTIP can enter through add/adopt although the Graph event is
          // already cached, so remove that row first and let the callback add
          // the updated server item under the authoritative Graph ID.
          try {
            const existing = await this.offlineStorage.getItem(item.id);
            if (existing) await this.offlineStorage.deleteItem(existing);
          } catch (error) {
            console.warn("M365 native: could not prepare cached RSVP replacement", error);
          }
        }
        if (cachedCallback) {
          await cachedCallback(
            this.superCalendar,
            Cr.NS_OK,
            Ci.calIOperationListener.ADD,
            item.id,
            item
          );
        }
        this.observers.notify("onAddItem", [item]);
        return item;
      } catch (error) {
        throw new Components.Exception(error?.message || String(error), error?.result || Cr.NS_ERROR_FAILURE);
      } finally {
        if (this._cachedAdoptItemCallback === cachedCallback) this._cachedAdoptItemCallback = null;
      }
    }

    async modifyItem(newItem, oldItem, suppliedOptions = {}) {
      const cachedCallback = this._cachedModifyItemCallback;
      const options = operationOptions(suppliedOptions);
      try {
        const newPlain = itemToPlain(newItem);
        const oldPlain = itemToPlain(oldItem);

        // V2.36 local-only fast path. Dismiss/snooze changes alarm bookkeeping
        // on the Thunderbird item but not the remote event representation. Keep
        // the exact new Thunderbird item so alarmLastAck/snooze properties are
        // preserved in cache, and bypass Graph + outgoing-message confirmation.
        // iTIP invitation operations intentionally stay on the guarded RSVP path.
        if (!options?.invitation && plainRemoteOperationSignature(newPlain) === plainRemoteOperationSignature(oldPlain)) {
          if (cachedCallback) {
            await cachedCallback(
              this.superCalendar,
              Cr.NS_OK,
              Ci.calIOperationListener.MODIFY,
              newItem.id,
              newItem
            );
          }
          this.observers.notify("onModifyItem", [newItem, oldItem]);
          return newItem;
        }

        const results = await this.extension.emit(
          "nativeCalendar.onItemUpdated",
          calendarDescriptor(this),
          newPlain,
          oldPlain,
          options
        );
        const result = firstUsefulResult(results);
        if (!result?.id) throw new Error("Microsoft 365 did not return the updated event");
        const item = result?.nativeOperation === "local-only" ? newItem : plainToItem(result, this);
        if (cachedCallback) {
          await cachedCallback(
            this.superCalendar,
            Cr.NS_OK,
            Ci.calIOperationListener.MODIFY,
            item.id,
            item
          );
        }
        this.observers.notify("onModifyItem", [item, oldItem]);
        return item;
      } catch (error) {
        throw new Components.Exception(error?.message || String(error), error?.result || Cr.NS_ERROR_FAILURE);
      } finally {
        if (this._cachedModifyItemCallback === cachedCallback) this._cachedModifyItemCallback = null;
      }
    }

    async deleteItem(item, suppliedOptions = {}) {
      const options = operationOptions(suppliedOptions);
      try {
        const results = await this.extension.emit(
          "nativeCalendar.onItemRemoved",
          calendarDescriptor(this),
          itemToPlain(item),
          options
        );
        if (!results?.length) throw new Error("Microsoft 365 did not consume the delete operation");
        this.observers.notify("onDeleteItem", [item]);
        return item;
      } catch (error) {
        throw new Components.Exception(error?.message || String(error), error?.result || Cr.NS_ERROR_FAILURE);
      }
    }

    getItem() { return this.offlineStorage.getItem(...arguments); }
    getItems() { return this.offlineStorage.getItems(...arguments); }

    refresh() {
      // The cached wrapper calls replayChangesOn() for actual network sync.
      this.mObservers.notify("onLoad", [this]);
    }

    resetLog() {
      // calCachedCalendar calls resetLog() while rebuilding a changelog cache.
      // Emitting onLoad here causes the wrapper to synchronize again, which can
      // overlap the active replay and duplicate visible items.
    }

    async replayChangesOn(listener) {
      const graphCalendarId = safeString(this.getProperty(PROP_GRAPH_ID));
      return withCalendarSyncLock(graphCalendarId, async () => {
      nativeSyncStats.lastStartedAt = new Date().toISOString();
      nativeSyncStats.lastFinishedAt = "";
      nativeSyncStats.graphEvents = 0;
      nativeSyncStats.cacheWrites = 0;
      nativeSyncStats.cacheAdds = 0;
      nativeSyncStats.cacheModifies = 0;
      nativeSyncStats.cacheDeletes = 0;
      nativeSyncStats.cacheUnchanged = 0;
      nativeSyncStats.cacheMappingRepairs = 0;
      nativeSyncStats.cacheVisibilityRepairs = 0;
      nativeSyncStats.cacheItems = 0;
      nativeSyncStats.graphAppointments = 0;
      nativeSyncStats.graphOnlineMeetings = 0;
      nativeSyncStats.graphOtherMeetings = 0;
      nativeSyncStats.cacheAppointments = 0;
      nativeSyncStats.cacheOnlineMeetings = 0;
      nativeSyncStats.cacheOtherMeetings = 0;
      nativeSyncStats.cacheSyntheticSelf = 0;
      nativeSyncStats.lastGraphCalendarId = safeString(this.getProperty(PROP_GRAPH_ID));
      nativeSyncStats.mode = "provider-replay";
      nativeSyncStats.message = "";
      nativeSyncStats.error = "";
      try {
        const results = await this.extension.emit("nativeCalendar.onSync", calendarDescriptor(this));
        const result = firstUsefulResult(results);
        if (!result || !Array.isArray(result.events)) {
          throw new Error("Microsoft 365 native sync returned no event snapshot");
        }
        nativeSyncStats.graphEvents = result.events.length;
        nativeSyncStats.graphAppointments = result.events.filter(event => Boolean(event?.isAppointment)).length;
        nativeSyncStats.graphOnlineMeetings = result.events.filter(event => Boolean(event?.isOnlineMeeting)).length;
        nativeSyncStats.graphOtherMeetings = result.events.filter(event => !event?.isAppointment && !event?.isOnlineMeeting).length;

        // Reconcile the Thunderbird offline snapshot by stable Graph ID. This
        // preserves the observer lifecycle required by the active calendar view
        // and avoids duplicate rendering after refresh/hide/show cycles.
        const syncStats = await reconcileOfflineStorage(this.offlineStorage, result.events, this);
        nativeSyncStats.cacheAdds = syncStats.adds;
        nativeSyncStats.cacheModifies = syncStats.modifies;
        nativeSyncStats.cacheDeletes = syncStats.deletes;
        nativeSyncStats.cacheUnchanged = syncStats.unchanged;
        nativeSyncStats.cacheMappingRepairs = syncStats.mappingRepairs || 0;
        nativeSyncStats.cacheVisibilityRepairs = syncStats.visibilityRepairs || 0;
        nativeSyncStats.cacheWrites = syncStats.adds + syncStats.modifies + syncStats.deletes;
        nativeSyncStats.cacheItems = await countOfflineEvents(this.offlineStorage);
        const cacheKinds = await classifyOfflineEvents(this.offlineStorage);
        nativeSyncStats.cacheAppointments = cacheKinds.appointments;
        nativeSyncStats.cacheOnlineMeetings = cacheKinds.onlineMeetings;
        nativeSyncStats.cacheOtherMeetings = cacheKinds.otherMeetings;
        nativeSyncStats.cacheSyntheticSelf = cacheKinds.syntheticSelf;
        nativeSyncStats.message = `${result.message || ""}${result.message ? " · " : ""}+${syncStats.adds} ~${syncStats.modifies} -${syncStats.deletes} =${syncStats.unchanged} repair=${syncStats.mappingRepairs || 0} visibility=${syncStats.visibilityRepairs || 0}`;
        nativeSyncStats.lastFinishedAt = new Date().toISOString();
        listener.onResult({ status: Cr.NS_OK }, result.message || null);
      } catch (error) {
        nativeSyncStats.error = errorText(error);
        nativeSyncStats.lastFinishedAt = new Date().toISOString();
        console.error("M365 native calendar sync failed", error);
        listener.onResult({ status: error?.result || Cr.NS_ERROR_FAILURE }, error?.message || String(error));
      } finally {
        scheduleCalendarViewReload("provider-replay");
      }
      });
    }
  }

  async function listOfflineEvents(offlineStorage) {
    if (!offlineStorage) return [];
    const result = [];
    // Reconciliation must compare the rows actually stored in offlineStorage.
    // Expanded recurrence occurrences can share/derive IDs and must not be
    // treated as additional cached parent items.
    const filter = Ci.calICalendar.ITEM_FILTER_TYPE_EVENT;
    for await (const items of cal.iterate.streamValues(
      offlineStorage.getItems(filter, 0, null, null)
    )) {
      for (const item of items || []) result.push(item);
    }
    return result;
  }

  function cachedChangeKey(item) {
    try { return safeString(item?.getProperty?.("X-M365-CHANGEKEY")); } catch (_) { return ""; }
  }

  function itemFallbackSignature(item) {
    try {
      return JSON.stringify([
        safeString(item?.title),
        dateTimeToIso(item?.startDate),
        dateTimeToIso(item?.endDate),
        safeString(item?.getProperty?.("LOCATION")),
        safeString(item?.status),
        safeString(item?.privacy),
        safeString(item?.getProperty?.("X-M365-ICALUID"))
      ]);
    } catch (_) {
      return "";
    }
  }

  function dataFallbackSignature(data) {
    return JSON.stringify([
      safeString(data?.title),
      safeString(data?.start),
      safeString(data?.end),
      safeString(data?.location),
      safeString(data?.status).toUpperCase(),
      safeString(data?.privacy).toUpperCase(),
      safeString(data?.iCalUId)
    ]);
  }

  function nativeMappingConforms(item, data, calendar) {
    const boolProp = name => safeString(item?.getProperty?.(name)).toUpperCase() === "TRUE";
    const expectedAppointment = Boolean(data?.isAppointment);
    const expectedOnline = Boolean(data?.isOnlineMeeting);
    if (boolProp("X-M365-APPOINTMENT") !== expectedAppointment) return false;
    if (boolProp("X-M365-ONLINE") !== expectedOnline) return false;

    // V2.32: the V2.31 diagnostic proved that Graph and cache.sqlite can both
    // contain an event while Thunderbird's active native view still renders
    // almost nothing.  The sole consistently visible legacy row had never been
    // rewritten by the V2.28-V2.30 mapping migrations.  Gate *all* event kinds
    // on one mapping version so every M365 row receives one clean delete/adopt
    // lifecycle after upgrade, including Teams meetings and Graph occurrences.
    if (safeString(item?.getProperty?.("X-M365-NATIVE-MAP-VERSION")) !== NATIVE_MAPPING_VERSION) return false;

    if (expectedAppointment) {
      const selfAddress = normalizeMail(calendar?.getProperty?.(PROP_ORGANIZER_ID));
      const sourceAttendees = Array.isArray(data?.attendees) ? data.attendees : [];
      const expectedSyntheticSelf = sourceAttendees.length === 0 && Boolean(selfAddress);
      if (boolProp("X-M365-SYNTHETIC-SELF") !== expectedSyntheticSelf) return false;
      if (expectedSyntheticSelf) {
        const organizerAddress = normalizeMail(item?.organizer?.id);
        if (!organizerAddress || organizerAddress !== selfAddress) return false;
        let hasAcceptedSelf = false;
        try {
          hasAcceptedSelf = (item.getAttendees() || []).some(attendee =>
            normalizeMail(attendee?.id) === selfAddress &&
            safeString(attendee?.participationStatus).toUpperCase() === "ACCEPTED"
          );
        } catch (_) {}
        if (!hasAcceptedSelf) return false;
      }
    }
    return true;
  }

  async function reconcileOfflineStorage(offlineStorage, events, calendar) {
    const desired = new Map();
    let duplicateGraphIds = 0;
    for (const data of events || []) {
      const id = safeString(data?.id);
      if (!id) continue;
      if (desired.has(id)) duplicateGraphIds += 1;
      desired.set(id, data);
    }

    const existingItems = await listOfflineEvents(offlineStorage);
    const existingById = new Map();
    const duplicateCachedItems = [];
    for (const item of existingItems) {
      const id = safeString(item?.id);
      if (!id) continue;
      if (existingById.has(id)) duplicateCachedItems.push(item);
      else existingById.set(id, item);
    }

    const stats = {
      adds: 0,
      modifies: 0,
      deletes: 0,
      unchanged: 0,
      mappingRepairs: 0,
      visibilityRepairs: 0,
      duplicateGraphIds,
      duplicateCachedIds: duplicateCachedItems.length
    };

    // Delete actual stale/duplicate cache items through the calendar API so
    // Thunderbird receives onDeleteItem notifications. deleteCalendar() clears
    // SQLite rows but does not provide the per-item observer lifecycle needed by
    // the active day/week/month views.
    for (const item of duplicateCachedItems) {
      await offlineStorage.deleteItem(item);
      stats.deletes += 1;
    }
    for (const [id, item] of existingById) {
      if (!desired.has(id)) {
        await offlineStorage.deleteItem(item);
        stats.deletes += 1;
      }
    }

    for (const [id, data] of desired) {
      const oldItem = existingById.get(id) || null;
      if (!oldItem) {
        const newItem = plainToItem(data, calendar);
        await offlineStorage.adoptItem(newItem);
        stats.adds += 1;
        continue;
      }

      const newChangeKey = safeString(data?.changeKey);
      const oldChangeKey = cachedChangeKey(oldItem);
      // V2.22: a Graph changeKey only tells us whether the server object changed;
      // it does not tell us whether our client-side conversion changed. Time-zone
      // fixes (or other mapping fixes) must therefore rewrite an existing cached
      // item even when Graph reports the same changeKey. Require the local
      // fallback signature to match as well.
      const signatureUnchanged = itemFallbackSignature(oldItem) === dataFallbackSignature(data);
      const mappingConforms = nativeMappingConforms(oldItem, data, calendar);
      const graphContentUnchanged = newChangeKey && oldChangeKey
        ? newChangeKey === oldChangeKey && signatureUnchanged
        : signatureUnchanged;
      const unchanged = graphContentUnchanged && mappingConforms;
      if (unchanged) {
        stats.unchanged += 1;
        continue;
      }

      const mappingRepair = graphContentUnchanged && !mappingConforms;
      if (mappingRepair) stats.mappingRepairs += 1;
      const newItem = plainToItem(data, calendar);
      // V2.32: recreate every row during the one-time mapping migration.
      // Thunderbird's CalCachedCalendar serves the visible UI directly from
      // mCachedCalendar/cache.sqlite.  A delete/adopt cycle therefore repairs
      // both storage-row shape and the observer lifecycle for all event kinds.
      if (mappingRepair) {
        await offlineStorage.deleteItem(oldItem);
        await offlineStorage.adoptItem(newItem);
        stats.deletes += 1;
        stats.adds += 1;
        stats.visibilityRepairs += 1;
      } else {
        try { newItem.generation = oldItem.generation; } catch (_) {}
        await offlineStorage.modifyItem(newItem, oldItem);
        stats.modifies += 1;
      }
    }
    return stats;
  }

  async function countOfflineEvents(offlineStorage) {
    if (!offlineStorage) return 0;
    let count = 0;
    const filter = Ci.calICalendar.ITEM_FILTER_TYPE_EVENT;
    for await (const items of cal.iterate.streamValues(
      offlineStorage.getItems(filter, 0, null, null)
    )) {
      count += Array.isArray(items) ? items.length : 0;
    }
    return count;
  }

  async function classifyOfflineEvents(offlineStorage) {
    const stats = { total: 0, appointments: 0, onlineMeetings: 0, otherMeetings: 0, syntheticSelf: 0 };
    if (!offlineStorage) return stats;
    const filter = Ci.calICalendar.ITEM_FILTER_TYPE_EVENT;
    for await (const items of cal.iterate.streamValues(offlineStorage.getItems(filter, 0, null, null))) {
      for (const item of items || []) {
        stats.total += 1;
        const appointment = safeString(item?.getProperty?.("X-M365-APPOINTMENT")).toUpperCase() === "TRUE";
        const online = safeString(item?.getProperty?.("X-M365-ONLINE")).toUpperCase() === "TRUE";
        if (appointment) stats.appointments += 1;
        if (online) stats.onlineMeetings += 1;
        if (!appointment && !online) stats.otherMeetings += 1;
        if (safeString(item?.getProperty?.("X-M365-SYNTHETIC-SELF")).toUpperCase() === "TRUE") stats.syntheticSelf += 1;
      }
    }
    return stats;
  }

  async function upsertCalendarEventUnlocked(extension, graphCalendarId, data) {
    resetTrace("upsertCalendarEvent");
    await stage("waitForCalendarStartup", () => waitForCalendarStartup());
    ensureProviderRegistered(extension);
    const calendar = stageSync(`findNativeCalendar:${graphCalendarId}`, () => findCalendarByGraphId(extension, graphCalendarId));
    if (!calendar) throw new Error(`No registered Thunderbird calendar for Graph calendar ${graphCalendarId}`);
    const raw = rawCalendar(calendar);
    const offlineStorage = raw?.offlineStorage || calendar?.wrappedJSObject?.mCachedCalendar || null;
    if (!offlineStorage) throw new Error(`Thunderbird offlineStorage is unavailable for ${calendar.name || graphCalendarId}`);
    const id = safeString(data?.id);
    if (!id) throw new Error("Native event id is missing");

    nativeDirectEventStats.lastCalendarId = safeString(graphCalendarId);
    nativeDirectEventStats.lastEventId = id;
    nativeDirectEventStats.lastTitle = safeString(data?.title);
    nativeDirectEventStats.lastStart = safeString(data?.start);
    nativeDirectEventStats.lastEnd = safeString(data?.end);
    nativeDirectEventStats.lastAppointment = Boolean(data?.isAppointment);
    nativeDirectEventStats.lastOnlineMeeting = Boolean(data?.isOnlineMeeting);
    nativeDirectEventStats.lastStored = false;
    nativeDirectEventStats.lastSyntheticSelf = false;
    nativeDirectEventStats.lastError = "";

    try {
      const existing = await offlineStorage.getItem(id);
      const newItem = plainToItem(data, raw);
      // V2.27: a single external Graph write must not be wrapped in a batch.
      // For one item, individual storage observer notifications are desirable so
      // the active Thunderbird view can update immediately. Full snapshot
      // reconciliation still uses batching.
      if (existing) {
        try { newItem.generation = existing.generation; } catch (_) {}
        await offlineStorage.modifyItem(newItem, existing);
      } else {
        await offlineStorage.adoptItem(newItem);
      }

      // Verify the exact row immediately. This converts a silent cache/UI issue
      // into a useful diagnostic instead of reporting a successful native push.
      const stored = await offlineStorage.getItem(id);
      if (!stored) throw new Error(`Thunderbird cache read-back failed for event ${id}`);
      nativeDirectEventStats.lastStored = true;
      nativeDirectEventStats.lastSyntheticSelf = safeString(stored?.getProperty?.("X-M365-SYNTHETIC-SELF")).toUpperCase() === "TRUE";
      nativeDirectEventStats.upserts += 1;
      nativeDirectEventStats.lastOperation = existing ? "modify" : "add";
      scheduleCalendarViewReload("direct-event-upsert");
      return {
        ok: true,
        graphCalendarId: safeString(graphCalendarId),
        eventId: id,
        operation: existing ? "modify" : "add",
        stored: true,
        appointment: Boolean(data?.isAppointment),
        onlineMeeting: Boolean(data?.isOnlineMeeting),
        start: dateTimeToIso(stored.startDate),
        end: dateTimeToIso(stored.endDate)
      };
    } catch (error) {
      nativeDirectEventStats.lastError = errorText(error);
      nativeDirectEventStats.lastStored = false;
      throw error;
    }
  }

  async function upsertCalendarEvent(extension, graphCalendarId, data) {
    return withCalendarSyncLock(graphCalendarId, () => upsertCalendarEventUnlocked(extension, graphCalendarId, data));
  }

  async function removeCalendarEventUnlocked(extension, graphCalendarId, eventId) {
    resetTrace("removeCalendarEvent");
    await stage("waitForCalendarStartup", () => waitForCalendarStartup());
    ensureProviderRegistered(extension);
    const calendar = stageSync(`findNativeCalendar:${graphCalendarId}`, () => findCalendarByGraphId(extension, graphCalendarId));
    if (!calendar) throw new Error(`No registered Thunderbird calendar for Graph calendar ${graphCalendarId}`);
    const raw = rawCalendar(calendar);
    const offlineStorage = raw?.offlineStorage || calendar?.wrappedJSObject?.mCachedCalendar || null;
    if (!offlineStorage) throw new Error(`Thunderbird offlineStorage is unavailable for ${calendar.name || graphCalendarId}`);
    const id = safeString(eventId);
    const existing = await offlineStorage.getItem(id);
    if (existing) await offlineStorage.deleteItem(existing);
    const remaining = await offlineStorage.getItem(id);
    nativeDirectEventStats.removes += 1;
    nativeDirectEventStats.lastCalendarId = safeString(graphCalendarId);
    nativeDirectEventStats.lastEventId = id;
    nativeDirectEventStats.lastOperation = "delete";
    nativeDirectEventStats.lastStored = Boolean(remaining);
    nativeDirectEventStats.lastError = remaining ? `Thunderbird cache still contains deleted event ${id}` : "";
    scheduleCalendarViewReload("direct-event-delete");
    return { ok: !remaining, graphCalendarId: safeString(graphCalendarId), eventId: id, removed: existing ? 1 : 0 };
  }

  async function removeCalendarEvent(extension, graphCalendarId, eventId) {
    return withCalendarSyncLock(graphCalendarId, () => removeCalendarEventUnlocked(extension, graphCalendarId, eventId));
  }

  function findCalendarByGraphId(extension, graphCalendarId) {
    const wanted = safeString(graphCalendarId);
    return cal.manager.getCalendars().find(calendar =>
      isOwnCalendar(calendar, extension) &&
      safeString(calendar.getProperty(PROP_GRAPH_ID)) === wanted
    ) || null;
  }

  async function replaceCalendarEventsUnlocked(extension, graphCalendarId, events) {
    resetTrace("replaceCalendarEvents");
    nativeSyncStats.lastStartedAt = new Date().toISOString();
    nativeSyncStats.lastFinishedAt = "";
    nativeSyncStats.graphEvents = Array.isArray(events) ? events.length : 0;
    nativeSyncStats.cacheWrites = 0;
    nativeSyncStats.cacheAdds = 0;
    nativeSyncStats.cacheModifies = 0;
    nativeSyncStats.cacheDeletes = 0;
    nativeSyncStats.cacheUnchanged = 0;
    nativeSyncStats.cacheMappingRepairs = 0;
    nativeSyncStats.cacheVisibilityRepairs = 0;
    nativeSyncStats.cacheItems = 0;
    nativeSyncStats.graphAppointments = (events || []).filter(event => Boolean(event?.isAppointment)).length;
    nativeSyncStats.graphOnlineMeetings = (events || []).filter(event => Boolean(event?.isOnlineMeeting)).length;
    nativeSyncStats.graphOtherMeetings = (events || []).filter(event => !event?.isAppointment && !event?.isOnlineMeeting).length;
    nativeSyncStats.cacheAppointments = 0;
    nativeSyncStats.cacheOnlineMeetings = 0;
    nativeSyncStats.cacheOtherMeetings = 0;
    nativeSyncStats.cacheSyntheticSelf = 0;
    nativeSyncStats.lastGraphCalendarId = safeString(graphCalendarId);
    nativeSyncStats.mode = "direct-cache-push";
    nativeSyncStats.message = "";
    nativeSyncStats.error = "";

    try {
      await stage("waitForCalendarStartup", () => waitForCalendarStartup());
      ensureProviderRegistered(extension);
      const calendar = stageSync(`findNativeCalendar:${graphCalendarId}`, () =>
        findCalendarByGraphId(extension, graphCalendarId)
      );
      if (!calendar) {
        throw new Error(`No registered Thunderbird calendar for Graph calendar ${graphCalendarId}`);
      }

      const raw = rawCalendar(calendar);
      const offlineStorage = raw?.offlineStorage || calendar?.wrappedJSObject?.mCachedCalendar || null;
      if (!offlineStorage) {
        throw new Error(`Thunderbird offlineStorage is unavailable for ${calendar.name || graphCalendarId}`);
      }

      const syncStats = await stage(`reconcileNativeCache:${calendar.name || graphCalendarId}`, () =>
        reconcileOfflineStorage(offlineStorage, events || [], raw)
      );

      nativeSyncStats.cacheAdds = Number(syncStats?.adds || 0);
      nativeSyncStats.cacheModifies = Number(syncStats?.modifies || 0);
      nativeSyncStats.cacheDeletes = Number(syncStats?.deletes || 0);
      nativeSyncStats.cacheUnchanged = Number(syncStats?.unchanged || 0);
      nativeSyncStats.cacheMappingRepairs = Number(syncStats?.mappingRepairs || 0);
      nativeSyncStats.cacheVisibilityRepairs = Number(syncStats?.visibilityRepairs || 0);
      nativeSyncStats.cacheWrites = nativeSyncStats.cacheAdds + nativeSyncStats.cacheModifies + nativeSyncStats.cacheDeletes;
      nativeSyncStats.cacheItems = await stage(
        `countNativeCache:${calendar.name || graphCalendarId}`,
        () => countOfflineEvents(offlineStorage)
      );
      const cacheKinds = await classifyOfflineEvents(offlineStorage);
      nativeSyncStats.cacheAppointments = cacheKinds.appointments;
      nativeSyncStats.cacheOnlineMeetings = cacheKinds.onlineMeetings;
      nativeSyncStats.cacheOtherMeetings = cacheKinds.otherMeetings;
      nativeSyncStats.cacheSyntheticSelf = cacheKinds.syntheticSelf;
      nativeSyncStats.directPushes += 1;
      nativeSyncStats.message = `+${nativeSyncStats.cacheAdds} ~${nativeSyncStats.cacheModifies} -${nativeSyncStats.cacheDeletes} =${nativeSyncStats.cacheUnchanged} repair=${nativeSyncStats.cacheMappingRepairs}; ${nativeSyncStats.cacheItems} cached item(s)`;
      nativeSyncStats.lastFinishedAt = new Date().toISOString();

      // The storage cache emits add notifications while filling. Emit a final
      // load notification as well so the composite day/week/month views redraw
      // immediately after a direct push.
      try {
        calendar?.wrappedJSObject?.mObservers?.notify("onLoad", [calendar]);
      } catch (_) {}

      return {
        ok: true,
        graphCalendarId: safeString(graphCalendarId),
        graphEvents: nativeSyncStats.graphEvents,
        cacheWrites: nativeSyncStats.cacheWrites,
        cacheAdds: nativeSyncStats.cacheAdds,
        cacheModifies: nativeSyncStats.cacheModifies,
        cacheDeletes: nativeSyncStats.cacheDeletes,
        cacheUnchanged: nativeSyncStats.cacheUnchanged,
        cacheMappingRepairs: nativeSyncStats.cacheMappingRepairs,
        cacheItems: nativeSyncStats.cacheItems,
        message: nativeSyncStats.message,
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    } catch (error) {
      nativeSyncStats.error = errorText(error);
      nativeSyncStats.lastFinishedAt = new Date().toISOString();
      return {
        ok: false,
        graphCalendarId: safeString(graphCalendarId),
        graphEvents: nativeSyncStats.graphEvents,
        cacheWrites: nativeSyncStats.cacheWrites,
        cacheAdds: nativeSyncStats.cacheAdds,
        cacheModifies: nativeSyncStats.cacheModifies,
        cacheDeletes: nativeSyncStats.cacheDeletes,
        cacheUnchanged: nativeSyncStats.cacheUnchanged,
        cacheMappingRepairs: nativeSyncStats.cacheMappingRepairs,
        cacheItems: nativeSyncStats.cacheItems,
        errorStage: nativeTrace.lastErrorStage || "replaceCalendarEvents",
        error: nativeTrace.lastError || nativeSyncStats.error,
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    }
  }

  async function replaceCalendarEvents(extension, graphCalendarId, events) {
    return withCalendarSyncLock(graphCalendarId, () =>
      replaceCalendarEventsUnlocked(extension, graphCalendarId, events)
    );
  }

  function ensureProviderRegistered(extension) {
    stageSync("registerCalendarProvider", () => M365CalendarProvider.register(extension));
    stageSync("registerVisibilityReloadObserver", () => ensureVisibilityReloadObserver(extension));
    try { injectTeamsMeetingButton(extension); }
    catch (error) { nativeTeamsUiStats.lastError = errorText(error); }
    try { installNativeEventEditorDoubleClick(extension); }
    catch (error) { nativeEventEditorStats.lastError = errorText(error); }
  }

  async function activate(extension) {
    resetTrace("activate");
    await stage("waitForCalendarStartup", () => waitForCalendarStartup());
    ensureProviderRegistered(extension);
    const calendars = cal.manager.getCalendars()
      .filter(item => isOwnCalendar(item, extension))
      .map(calendarDescriptor);
    trace("providerActivated", true, `${calendars.length} calendar(s)`);
    return {
      ok: true,
      providerType: providerType(extension),
      calendars,
      diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
    };
  }

  async function reloadViews(extension, reason = "manual") {
    await waitForCalendarStartup();
    ensureProviderRegistered(extension);
    const refreshed = reloadOpenCalendarViews(reason);
    return {
      ok: true,
      refreshed,
      viewReloadStats: { ...nativeViewReloadStats }
    };
  }

  async function ensureCalendars(extension, descriptors) {
    resetTrace("ensureCalendars");
    try {
      await stage("waitForCalendarStartup", () => waitForCalendarStartup());
      ensureProviderRegistered(extension);

      const type = providerType(extension);
      const desired = new Map((descriptors || []).map(item => [String(item.graphCalendarId), item]));
      const desiredGraphIds = new Set(desired.keys());

      // V2.34 changes the add-on identity before first ATN publication. Existing
      // native calendar registry rows therefore belong to a sibling provider
      // type. Recognize them by our Graph calendar metadata/URI, preserve their
      // Thunderbird UI preferences, then recreate them under the new provider.
      // No previous add-on ID/domain needs to be hard-coded here.
      const siblingCalendars = stageSync("enumerateSiblingCalendars", () =>
        cal.manager.getCalendars().filter(calendar => isM365SiblingCalendar(calendar, extension, desiredGraphIds))
      );
      for (const calendar of siblingCalendars) {
        const graphId = safeString(calendar.getProperty(PROP_GRAPH_ID));
        stageSync(`migrateSiblingCalendar:${graphId || calendar.id}`, () => {
          snapshotCalendarUserPrefs(extension, calendar, true);
          cal.manager.unregisterCalendar(calendar);
        });
      }

      const existing = stageSync("enumerateExistingCalendars", () =>
        cal.manager.getCalendars().filter(calendar => isOwnCalendar(calendar, extension))
      );

      for (const calendar of existing) {
        const graphId = safeString(calendar.getProperty(PROP_GRAPH_ID));
        if (!desired.has(graphId)) {
          stageSync(`removeStaleCalendar:${graphId || calendar.id}`, () => cal.manager.unregisterCalendar(calendar));
        }
      }

      const result = [];
      for (const descriptor of desired.values()) {
        const label = safeString(descriptor.name || descriptor.graphCalendarId || "calendar");
        let calendar = stageSync(`findCalendar:${label}`, () =>
          cal.manager.getCalendars().find(item =>
            isOwnCalendar(item, extension) &&
            safeString(item.getProperty(PROP_GRAPH_ID)) === safeString(descriptor.graphCalendarId)
          )
        );

        if (!calendar) {
          const uri = stageSync(`makeUri:${label}`, () => Services.io.newURI(
            `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(descriptor.graphCalendarId)}`
          ));

          calendar = stageSync(`createCalendar:${label}`, () => cal.manager.createCalendar(type, uri));
          if (!calendar) {
            throw new Error(`[createCalendar:${label}] Thunderbird returned no calendar for type ${type}`);
          }

          // Follow Thunderbird's maintained Calendar Experiment ordering: name
          // and public properties are set before registerCalendar().
          stageSync(`configureCalendar:${label}`, () => {
            withProgrammaticCalendarMutation(() => {
              calendar.name = descriptor.name || "Microsoft 365";
              calendar.setProperty(PROP_GRAPH_ID, descriptor.graphCalendarId);
              calendar.setProperty(PROP_ACCOUNT_ID, descriptor.accountId || "");
              calendar.setProperty(PROP_ORGANIZER_ID, descriptor.organizerId || "");
              calendar.setProperty(PROP_ORGANIZER_NAME, descriptor.organizerName || "");
              calendar.setProperty("refreshInterval", 15);
              calendar.setProperty("readOnly", Boolean(descriptor.readOnly));
            });
            applySavedCalendarUserPrefs(extension, calendar, descriptor, true);
          });

          stageSync(`registerCalendar:${label}`, () => cal.manager.registerCalendar(calendar));
          const registeredId = calendar.id;
          calendar = stageSync(`resolveRegisteredCalendar:${label}`, () => cal.manager.getCalendarById(registeredId));
          if (!calendar) {
            throw new Error(`[resolveRegisteredCalendar:${label}] Thunderbird returned null for id ${registeredId}`);
          }
        } else {
          stageSync(`updateCalendar:${label}`, () => {
            withProgrammaticCalendarMutation(() => {
              // Keep Thunderbird-owned display preferences (name, colour,
              // enabled/visible, alarms and identity) untouched for an existing
              // calendar. Only refresh Graph/provider metadata here.
              calendar.setProperty(PROP_ACCOUNT_ID, descriptor.accountId || "");
              calendar.setProperty(PROP_ORGANIZER_ID, descriptor.organizerId || "");
              calendar.setProperty(PROP_ORGANIZER_NAME, descriptor.organizerName || "");
              calendar.setProperty("readOnly", Boolean(descriptor.readOnly));
            });
            applySavedCalendarUserPrefs(extension, calendar, descriptor, false);
          });
        }
        result.push(calendarDescriptor(calendar));
      }

      trace("ensureCalendarsComplete", true, `${result.length} calendar(s)`);
      return {
        ok: true,
        calendars: result,
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    } catch (error) {
      if (!nativeTrace.lastError) {
        nativeTrace.lastError = errorText(error);
        nativeTrace.lastErrorStage = nativeTrace.lastErrorStage || "ensureCalendars";
        trace(nativeTrace.lastErrorStage, false, nativeTrace.lastError);
      }
      return {
        ok: false,
        calendars: [],
        errorStage: nativeTrace.lastErrorStage || "ensureCalendars",
        error: nativeTrace.lastError || errorText(error),
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    }
  }


  async function removeAll(extension) {
    await waitForCalendarStartup();
    // Explicit removal (for example Logout) is the only place where calendar
    // registry branches are intentionally deleted. Snapshot user preferences
    // first so a later login can recreate calendars with the same UI choices.
    try { snapshotAllCalendarUserPrefs(extension); } catch (_) {}
    for (const calendar of cal.manager.getCalendars().filter(item => isOwnCalendar(item, extension))) {
      cal.manager.unregisterCalendar(calendar);
    }
    return true;
  }

  async function synchronize(extension) {
    resetTrace("synchronize");
    try {
      await stage("waitForCalendarStartup", () => waitForCalendarStartup());
      ensureProviderRegistered(extension);
      let count = 0;
      const calendars = stageSync("enumerateCalendarsForRefresh", () =>
        cal.manager.getCalendars().filter(item => isOwnCalendar(item, extension))
      );
      for (const calendar of calendars) {
        if (!calendar.getProperty("disabled") && calendar.canRefresh) {
          await stage(`refreshCalendar:${calendar.name || calendar.id}`, async () => {
            await calendar.refresh();
          });
          count += 1;
        }
      }
      return { ok: true, count, diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] } };
    } catch (error) {
      return {
        ok: false,
        count: 0,
        errorStage: nativeTrace.lastErrorStage || "synchronize",
        error: nativeTrace.lastError || errorText(error),
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    }
  }

  function nativeContactEmails(card) {
    const values = [];
    try { values.push(...toPlainArray(card?.emailAddresses)); } catch (_) {}
    try { if (card?.primaryEmail) values.push(card.primaryEmail); } catch (_) {}
    try {
      const second = card?.getProperty?.("SecondEmail", "");
      if (second) values.push(second);
    } catch (_) {}
    const seen = new Set();
    return values
      .map(value => safeString(value).trim())
      .filter(value => value && value.includes("@"))
      .filter(value => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function nativeContactName(card, email) {
    const direct = safeString(card?.displayName || card?.getProperty?.("DisplayName", "")).trim();
    if (direct) return direct;
    const first = safeString(card?.firstName || card?.getProperty?.("FirstName", "")).trim();
    const last = safeString(card?.lastName || card?.getProperty?.("LastName", "")).trim();
    return `${first} ${last}`.trim() || email;
  }

  const nativeAddressBookDiagnostics = {
    backend: "not-run",
    directoryCount: 0,
    cardCount: 0,
    lastQuery: "",
    lastResultCount: 0,
    autocompleteAddrbookCount: 0,
    autocompleteLdapCount: 0,
    asyncDirectoryCount: 0,
    asyncDirectoryResultCount: 0,
    asyncDirectoryTimeouts: 0,
    enumerationCount: 0,
    lastError: "",
    directories: [],
    asyncDirectories: []
  };

  function nativeAutocompleteResultItems(result, backend) {
    const items = [];
    const count = Number(result?.matchCount || 0);
    let abResult = null;
    try { abResult = result.QueryInterface(Ci.nsIAbAutoCompleteResult); } catch (_) {}
    for (let i = 0; i < count; i += 1) {
      let card = null;
      let email = "";
      try { card = abResult?.getCardAt(i) || null; } catch (_) {}
      try { email = safeString(abResult?.getEmailToUse(i)).trim(); } catch (_) {}
      if (!email) {
        let value = "";
        try { value = safeString(result.getFinalCompleteValueAt(i) || result.getValueAt(i)); } catch (_) {}
        const angle = value.match(/<([^<>\s]+@[^<>\s]+)>/);
        const plain = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        email = safeString(angle?.[1] || plain?.[0]).trim();
      }
      if (!email || !email.includes("@")) continue;
      let name = nativeContactName(card, email);
      if (!card) {
        try {
          const label = safeString(result.getLabelAt(i) || result.getValueAt(i)).trim();
          name = label.replace(/\s*<[^>]+>\s*$/, "").trim() || email;
        } catch (_) {}
      }
      items.push({
        id: safeString(card?.UID || card?.uid || card?.localId || ""),
        name,
        email,
        remote: backend === "ldap",
        readOnly: backend === "ldap",
        source: `thunderbird-autocomplete-${backend}`,
        addressBook: ""
      });
    }
    return items;
  }

  async function searchThunderbirdAutocomplete(backend, text) {
    const contract = `@mozilla.org/autocomplete/search;1?name=${backend}`;
    if (!Cc[contract]) return [];
    let search = null;
    try { search = Cc[contract].getService(Ci.nsIAutoCompleteSearch); }
    catch (_) { return []; }
    return new Promise(resolve => {
      let done = false;
      const collected = [];
      const finish = () => {
        if (done) return;
        done = true;
        try { nativeClearTimeout(timer); } catch (_) {}
        resolve(collected);
      };
      const timer = nativeSetTimeout(finish, backend === "ldap" ? 5000 : 9000);
      const listener = {
        QueryInterface: ChromeUtils.generateQI(["nsIAutoCompleteObserver"]),
        onSearchResult(_search, result) {
          try { collected.push(...nativeAutocompleteResultItems(result, backend)); }
          catch (error) { nativeAddressBookDiagnostics.lastError = errorText(error); }
          const state = Number(result?.searchResult || 0);
          // RESULT_*_ONGOING = 5/6. All other states are final.
          if (state !== 5 && state !== 6) finish();
        }
      };
      try { search.startSearch(text, JSON.stringify({ type: "addr_to" }), null, listener); }
      catch (error) {
        nativeAddressBookDiagnostics.lastError = errorText(error);
        finish();
      }
    });
  }

  async function searchAsyncAddressBookDirectory(directory, text) {
    const name = safeString(directory?.dirName || directory?.URI || "async-address-book");
    return new Promise(resolve => {
      let finished = false;
      const cards = [];
      const done = (timedOut = false, status = null, complete = null) => {
        if (finished) return;
        finished = true;
        try { nativeClearTimeout(timer); } catch (_) {}
        resolve({ name, cards, timedOut, status, complete });
      };
      const timer = nativeSetTimeout(() => done(true), 9000);
      const listener = {
        onSearchFoundCard(card) {
          if (card && !card.isMailList) cards.push(card);
        },
        onSearchFinished(status, isCompleteResult) {
          done(false, status, isCompleteResult);
        }
      };
      try {
        // Thunderbird's own AbAutoCompleteSearch uses this exact asynchronous
        // path for ASYNC_DIRECTORY_TYPE address books (including CardDAV-like
        // providers): dir.search(null, userText, listener). childCards is not a
        // reliable way to query such remote directories.
        directory.search(null, text, listener);
      } catch (error) {
        nativeAddressBookDiagnostics.lastError = `${name}: ${errorText(error)}`;
        done(false, "exception", false);
      }
    });
  }

  function collectAddressBookInventory() {
    const directories = [];
    let cardCount = 0;
    for (const directory of toPlainArray(MailServices?.ab?.directories)) {
      const info = {
        id: safeString(directory?.UID || ""),
        name: safeString(directory?.dirName || ""),
        uid: safeString(directory?.UID || ""),
        remote: Boolean(directory?.isRemote),
        readOnly: Boolean(directory?.readOnly),
        childCardCount: 0,
        cardCount: 0,
        useForAutocomplete: null,
        error: ""
      };
      try { info.childCardCount = Number(directory?.childCardCount || toPlainArray(directory?.childCards).length || 0); }
      catch (error) { info.error = errorText(error); }
      try { info.useForAutocomplete = Boolean(directory?.useForAutocomplete?.("")); } catch (_) {}
      info.cardCount = info.childCardCount;
      cardCount += info.childCardCount;
      directories.push(info);
    }
    return { directories, cardCount };
  }

  async function listAddressBooks(_extension) {
    if (!MailServices?.ab) return [];
    return collectAddressBookInventory().directories.map(info => ({
      id: safeString(info.id || info.uid),
      uid: safeString(info.uid || info.id),
      name: safeString(info.name),
      remote: Boolean(info.remote),
      readOnly: Boolean(info.readOnly),
      useForAutocomplete: info.useForAutocomplete !== false,
      cardCount: Number(info.cardCount || info.childCardCount || 0)
    }));
  }

  async function searchAddressBook(_extension, query, addressBookIds = ["*"]) {
    const text = safeString(query).trim();
    const scope = Array.isArray(addressBookIds) ? addressBookIds.map(safeString).filter(Boolean) : ["*"];
    const searchAllBooks = scope.includes("*");
    const selected = new Set(searchAllBooks ? [] : scope);
    nativeAddressBookDiagnostics.lastQuery = text;
    nativeAddressBookDiagnostics.lastError = "";
    nativeAddressBookDiagnostics.backend = "thunderbird-autocomplete+enumeration";
    nativeAddressBookDiagnostics.lastResultCount = 0;
    nativeAddressBookDiagnostics.autocompleteAddrbookCount = 0;
    nativeAddressBookDiagnostics.autocompleteLdapCount = 0;
    nativeAddressBookDiagnostics.asyncDirectoryCount = 0;
    nativeAddressBookDiagnostics.asyncDirectoryResultCount = 0;
    nativeAddressBookDiagnostics.asyncDirectoryTimeouts = 0;
    nativeAddressBookDiagnostics.asyncDirectories = [];
    nativeAddressBookDiagnostics.enumerationCount = 0;
    if (text.length < 2 || !MailServices?.ab) return [];

    const inventory = collectAddressBookInventory();
    nativeAddressBookDiagnostics.directories = inventory.directories;
    nativeAddressBookDiagnostics.directoryCount = inventory.directories.length;
    nativeAddressBookDiagnostics.cardCount = inventory.cardCount;

    const parts = text.toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    const seen = new Set();
    const add = item => {
      const email = safeString(item?.email).trim();
      if (!email || !email.includes("@")) return;
      const searchable = `${item?.name || ""} ${email}`.toLowerCase();
      if (!parts.every(part => searchable.includes(part))) return;
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push(item);
    };

    // V2.22: run Thunderbird's normal addrbook autocomplete, LDAP and the
    // explicit async-directory path in parallel. CardDAV/extension-backed
    // directories are asynchronous in Thunderbird and may need network time;
    // the previous one-second local autocomplete timeout returned before those
    // providers had a chance to report results.
    let local = [];
    let ldap = [];
    let searched = [];
    try {
      const asyncType = Ci.nsIAbManager.ASYNC_DIRECTORY_TYPE;
      const asyncDirectories = toPlainArray(MailServices.ab.directories)
        .filter(directory => Number(directory?.dirType) === Number(asyncType))
        .filter(directory => searchAllBooks || selected.has(safeString(directory?.UID || "")));
      nativeAddressBookDiagnostics.asyncDirectoryCount = asyncDirectories.length;
      const combined = await Promise.all([
        (searchAllBooks ? searchThunderbirdAutocomplete("addrbook", text) : Promise.resolve([])).catch(error => {
          nativeAddressBookDiagnostics.lastError = errorText(error);
          return [];
        }),
        (searchAllBooks ? searchThunderbirdAutocomplete("ldap", text) : Promise.resolve([])).catch(error => {
          if (!nativeAddressBookDiagnostics.lastError) nativeAddressBookDiagnostics.lastError = errorText(error);
          return [];
        }),
        Promise.all(asyncDirectories.map(directory => searchAsyncAddressBookDirectory(directory, text))).catch(error => {
          if (!nativeAddressBookDiagnostics.lastError) nativeAddressBookDiagnostics.lastError = errorText(error);
          return [];
        })
      ]);
      [local, ldap, searched] = combined;
    } catch (error) {
      nativeAddressBookDiagnostics.lastError = errorText(error);
    }

    nativeAddressBookDiagnostics.autocompleteAddrbookCount = local.length;
    nativeAddressBookDiagnostics.autocompleteLdapCount = ldap.length;
    local.forEach(add);
    ldap.forEach(add);

    for (const outcome of searched) {
      nativeAddressBookDiagnostics.asyncDirectories.push({
        name: outcome.name,
        cardCount: outcome.cards.length,
        timedOut: Boolean(outcome.timedOut),
        status: safeString(outcome.status),
        complete: outcome.complete == null ? null : Boolean(outcome.complete)
      });
      if (outcome.timedOut) nativeAddressBookDiagnostics.asyncDirectoryTimeouts += 1;
      for (const card of outcome.cards) {
        for (const email of nativeContactEmails(card)) {
          nativeAddressBookDiagnostics.asyncDirectoryResultCount += 1;
          add({
            id: safeString(card?.UID || card?.uid || card?.localId || ""),
            name: nativeContactName(card, email),
            email,
            remote: true,
            readOnly: true,
            source: "thunderbird-native-async-directory",
            addressBook: outcome.name
          });
        }
      }
    }

    // Direct enumeration remains an independent fallback and makes diagnosis
    // possible even when the autocomplete component is unavailable.
    let enumCount = 0;
    for (const directory of toPlainArray(MailServices.ab.directories)) {
      if (!searchAllBooks && !selected.has(safeString(directory?.UID || ""))) continue;
      try {
        for (const card of toPlainArray(directory?.childCards)) {
          if (card?.isMailList) continue;
          for (const email of nativeContactEmails(card)) {
            enumCount += 1;
            add({
              id: safeString(card?.UID || card?.uid || card?.localId || ""),
              name: nativeContactName(card, email),
              email,
              remote: Boolean(directory?.isRemote),
              readOnly: Boolean(directory?.readOnly),
              source: "thunderbird-native-enumeration",
              addressBook: safeString(directory?.dirName || "")
            });
          }
        }
      } catch (error) {
        if (!nativeAddressBookDiagnostics.lastError) nativeAddressBookDiagnostics.lastError = `${safeString(directory?.dirName)}: ${errorText(error)}`;
      }
    }
    nativeAddressBookDiagnostics.enumerationCount = enumCount;
    nativeAddressBookDiagnostics.lastResultCount = results.length;
    return results.slice(0, 20);
  }

  async function status(extension) {
    await waitForCalendarStartup();
    return cal.manager.getCalendars()
      .filter(item => isOwnCalendar(item, extension))
      .map(calendarDescriptor);
  }

  async function diagnostics(extension) {
    try {
      await waitForCalendarStartup();
      const type = providerType(extension);
      let registrationError = "";
      try {
        M365CalendarProvider.register(extension);
      } catch (error) {
        registrationError = errorText(error);
      }
      const calendars = cal.manager.getCalendars()
        .filter(item => isOwnCalendar(item, extension))
        .map(calendarDescriptor);
      return {
        providerType: type,
        calendarStartupReady: calendarStartupReady(),
        managerProviderRegistered: Boolean(cal.manager.hasCalendarProvider(type)),
        uiProviderAvailable: Boolean(cal.provider?.register),
        uiProviderRegistered: providerInstances.has(type),
        providerRegistrationError: registrationError,
        registeredCalendars: calendars,
        registeredCalendarCount: calendars.length,
        lastOperation: nativeTrace.lastOperation,
        lastErrorStage: nativeTrace.lastErrorStage,
        lastError: nativeTrace.lastError,
        trace: [...nativeTrace.trace],
        syncStats: { ...nativeSyncStats },
        directEventStats: { ...nativeDirectEventStats },
        viewReloadStats: { ...nativeViewReloadStats },
        teamsButtonStats: { ...nativeTeamsUiStats },
        eventEditorStats: { ...nativeEventEditorStats },
        nativeUserPreferences: loadNativeUserPrefs(extension),
        mailIdentityCount: allMailIdentities().length,
        nativeAddressBookAvailable: Boolean(MailServices?.ab),
        addressBookDiagnostics: { ...nativeAddressBookDiagnostics, directories: [...nativeAddressBookDiagnostics.directories] },
        calendarDetails: cal.manager.getCalendars().filter(item => isOwnCalendar(item, extension)).map(calendar => {
          const raw = rawCalendar(calendar);
          let identity = null;
          try { identity = calendar.getProperty("imip.identity"); } catch (_) {}
          return {
            id: safeString(calendar?.id),
            name: safeString(calendar?.name),
            type: safeString(calendar?.type),
            rawType: safeString(raw?.type),
            forceDisabled: Boolean(calendar?.getProperty?.("force-disabled")),
            disabled: Boolean(calendar?.getProperty?.("disabled")),
            visible: calendar?.getProperty?.("calendar-main-in-composite") !== false,
            color: safeString(calendar?.getProperty?.("color")),
            imipIdentityDisabled: calendar?.getProperty?.("imip.identity.disabled"),
            identityKey: safeString(identity?.key || calendar?.getProperty?.("imip.identity.key")),
            identityEmail: safeString(identity?.email || "")
          };
        })
      };
    } catch (error) {
      return {
        providerType: providerType(extension),
        calendarStartupReady: calendarStartupReady(),
        managerProviderRegistered: false,
        uiProviderAvailable: Boolean(cal.provider?.register),
        uiProviderRegistered: false,
        providerRegistrationError: errorText(error),
        registeredCalendars: [],
        registeredCalendarCount: 0,
        lastOperation: nativeTrace.lastOperation,
        lastErrorStage: nativeTrace.lastErrorStage || "diagnostics",
        lastError: nativeTrace.lastError || errorText(error),
        trace: [...nativeTrace.trace],
        syncStats: { ...nativeSyncStats },
        directEventStats: { ...nativeDirectEventStats },
        viewReloadStats: { ...nativeViewReloadStats },
        teamsButtonStats: { ...nativeTeamsUiStats },
        eventEditorStats: { ...nativeEventEditorStats }
      };
    }
  }


  function diagnosticItemIcs(item) {
    try {
      const component = item?.icalComponent;
      if (component?.serializeToICS) return safeString(component.serializeToICS()).trim();
    } catch (_) {}
    return "";
  }

  function diagnosticRangeMatch(item, start, end) {
    const rangeStart = Date.parse(safeString(start));
    const rangeEnd = Date.parse(safeString(end));
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) return true;
    const itemStart = Date.parse(dateTimeToIso(item?.startDate));
    const itemEnd = Date.parse(dateTimeToIso(item?.endDate));
    if (!Number.isFinite(itemStart)) return true;
    const effectiveEnd = Number.isFinite(itemEnd) ? itemEnd : itemStart + 1;
    return effectiveEnd > rangeStart && itemStart < rangeEnd;
  }

  function diagnosticIsoToDateTime(value) {
    const text = safeString(value);
    if (!text) return null;
    try {
      const dt = cal.createDateTime();
      dt.nativeTime = Date.parse(text) * 1000;
      dt.timezone = cal.dtz.UTC;
      return dt;
    } catch (_) {
      try { return cal.dtz.jsDateToDateTime(new Date(text), cal.dtz.UTC); } catch (_) {}
    }
    return null;
  }

  async function diagnosticStorageRangeQuery(offlineStorage, filter, start, end, calendar) {
    const rangeStart = diagnosticIsoToDateTime(start);
    const rangeEnd = diagnosticIsoToDateTime(end);
    const result = [];
    let error = "";
    try {
      const stream = offlineStorage.getItems(filter, 0, rangeStart, rangeEnd);
      for await (const batch of cal.iterate.streamValues(stream)) {
        for (const item of batch || []) result.push(diagnosticNativeItem(item, calendar));
      }
    } catch (e) {
      error = errorText(e);
    }
    result.sort((a, b) => Date.parse(a.start || 0) - Date.parse(b.start || 0));
    return { filter, count: result.length, error, items: result };
  }

  function diagnosticNativeItem(item, calendar) {
    const plain = itemToPlain(item);
    let recurrenceId = "";
    let parentItemId = "";
    let recurrenceInfo = false;
    try { recurrenceId = dateTimeToIso(item?.recurrenceId); } catch (_) {}
    try { parentItemId = safeString(item?.parentItem?.id); } catch (_) {}
    try { recurrenceInfo = Boolean(item?.recurrenceInfo); } catch (_) {}
    let generation = null;
    try { generation = Number(item?.generation); } catch (_) {}
    return {
      ...plain,
      nativeCalendarId: safeString(calendar?.id),
      recurrenceId,
      parentItemId,
      hasRecurrenceInfo: recurrenceInfo,
      generation: Number.isFinite(generation) ? generation : null,
      mappingVersion: safeString(item?.getProperty?.("X-M365-NATIVE-MAP-VERSION")),
      syntheticSelf: safeString(item?.getProperty?.("X-M365-SYNTHETIC-SELF")).toUpperCase() === "TRUE",
      ical: diagnosticItemIcs(item)
    };
  }

  async function exportDiagnostics(extension, graphCalendarId, start = "", end = "") {
    await waitForCalendarStartup();
    ensureProviderRegistered(extension);
    const wanted = safeString(graphCalendarId);
    const ownCalendars = cal.manager.getCalendars().filter(item => isOwnCalendar(item, extension));
    const calendar = wanted
      ? ownCalendars.find(item => safeString(item?.getProperty?.(PROP_GRAPH_ID) || rawCalendar(item)?.getProperty?.(PROP_GRAPH_ID)) === wanted)
      : ownCalendars[0];
    if (!calendar) throw new Error(`No registered Thunderbird calendar for Graph calendar ${wanted || "(unspecified)"}`);

    const raw = rawCalendar(calendar);
    const offlineStorage = raw?.offlineStorage || calendar?.wrappedJSObject?.mCachedCalendar || null;
    if (!offlineStorage) throw new Error(`Thunderbird offlineStorage is unavailable for ${calendar?.name || wanted}`);

    const storedItems = await listOfflineEvents(offlineStorage);
    const selectedItems = storedItems.filter(item => diagnosticRangeMatch(item, start, end));
    const items = selectedItems.map(item => diagnosticNativeItem(item, raw));
    items.sort((a, b) => Date.parse(a.start || 0) - Date.parse(b.start || 0));

    const eventBlocks = items.map(item => safeString(item.ical).trim()).filter(Boolean);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//3-5 Power Electronics GmbH//M365 Calendar Diagnostics V2.36//EN",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${safeString(calendar?.name || "Microsoft 365").replace(/[\\;,\r\n]/g, " ")}`,
      ...eventBlocks,
      "END:VCALENDAR",
      ""
    ].join("\r\n");

    const rangeQueries = {
      eventParents: await diagnosticStorageRangeQuery(
        offlineStorage,
        Ci.calICalendar.ITEM_FILTER_TYPE_EVENT,
        start, end, raw
      ),
      eventOccurrences: await diagnosticStorageRangeQuery(
        offlineStorage,
        Ci.calICalendar.ITEM_FILTER_TYPE_EVENT | Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES,
        start, end, raw
      ),
      allOccurrences: await diagnosticStorageRangeQuery(
        offlineStorage,
        Ci.calICalendar.ITEM_FILTER_ALL_ITEMS | Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES,
        start, end, raw
      )
    };

    return {
      generatedAt: new Date().toISOString(),
      calendar: calendarDescriptor(calendar),
      range: { start: safeString(start), end: safeString(end) },
      totalStoredItems: storedItems.length,
      exportedItems: items.length,
      items,
      rangeQueries,
      ics
    };
  }

  async function shutdown(extension, isAppShutdown = false) {
    // V2.22 critical lifecycle fix:
    // cal.manager.unregisterCalendar() deletes calendar.registry.<id> and all
    // Thunderbird-owned UI preferences. Never call removeAll() on normal app
    // shutdown. The process is exiting, so leaving provider/calendar objects in
    // memory is correct and lets Thunderbird persist them normally.
    try { snapshotAllCalendarUserPrefs(extension); } catch (_) {}
    removeVisibilityReloadObserver();
    removeTeamsMeetingButtons();
    removeNativeEventEditorDoubleClick();

    if (!isAppShutdown) {
      // Add-on disable/update: unregister only the dynamic provider temporarily.
      // Thunderbird replaces its calendars by force-disabled dummy calendars but
      // keeps registry/cache data; re-registering the provider swaps them back.
      try { M365CalendarProvider.unregister(extension); } catch (_) {}
    }
    return true;
  }

  return {
    activate,
    ensureCalendars,
    removeAll,
    synchronize,
    replaceCalendarEvents,
    upsertCalendarEvent,
    removeCalendarEvent,
    reloadViews,
    listAddressBooks,
    searchAddressBook,
    status,
    diagnostics,
    exportDiagnostics,
    shutdown,
  };
}

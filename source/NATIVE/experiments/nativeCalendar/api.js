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

        async reloadViews(reason) {
          return _m365NativeProviderCall(extension, "reloadViews", String(reason || "manual"));
        },

        async status() {
          if (!_m365NativeProviderModule && !_m365NativeProviderLoadError) {
            return [];
          }
          return _m365NativeProviderCall(extension, "status");
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
        const result = _m365NativeProviderModule.shutdown(extension);
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
  const { CalEvent } = ChromeUtils.importESModule("resource:///modules/CalEvent.sys.mjs");
  const { CalAttendee } = ChromeUtils.importESModule("resource:///modules/CalAttendee.sys.mjs");
  const { CalAlarm } = ChromeUtils.importESModule("resource:///modules/CalAlarm.sys.mjs");

  /* M365 native Thunderbird calendar provider implementation.
   * Loaded lazily by api.js so provider incompatibilities cannot break the add-on UI.
   * SPDX-License-Identifier: MPL-2.0
   */


  const PROP_GRAPH_ID = "m365.graphCalendarId";
  const PROP_ACCOUNT_ID = "m365.accountId";
  const PROP_ORGANIZER_ID = "m365.organizerId";
  const PROP_ORGANIZER_NAME = "m365.organizerName";

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
      organizerName: String(get(PROP_ORGANIZER_NAME) || "")
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
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const dt = cal.dtz.jsDateToDateTime(date, cal.dtz.UTC);
    if (allDay) {
      dt.isDate = true;
    }
    return dt;
  }

  function normalizeMail(value) {
    return safeString(value).replace(/^mailto:/i, "").trim().toLowerCase();
  }

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
    const attendees = [];
    try {
      for (const attendee of item.getAttendees() || []) {
        const converted = attendeeToPlain(attendee);
        if (converted?.address) attendees.push(converted);
      }
    } catch (_) {}

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
      isOrganizer: safeString(item.getProperty("X-M365-IS-ORGANIZER")).toUpperCase() === "TRUE",
      responseStatus: safeString(item.getProperty("X-M365-RESPONSE")),
      graphType: safeString(item.getProperty("X-M365-GRAPH-TYPE")),
      seriesMasterId: safeString(item.getProperty("X-M365-SERIES-MASTER-ID")),
      changeKey: safeString(item.getProperty("X-M365-CHANGEKEY")),
      iCalUId: safeString(item.getProperty("X-M365-ICALUID"))
    };
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
    if (data?.isOrganizer) item.setProperty("X-M365-IS-ORGANIZER", "TRUE");
    if (data?.responseStatus) item.setProperty("X-M365-RESPONSE", safeString(data.responseStatus));
    if (data?.graphType) item.setProperty("X-M365-GRAPH-TYPE", safeString(data.graphType));
    if (data?.seriesMasterId) item.setProperty("X-M365-SERIES-MASTER-ID", safeString(data.seriesMasterId));
    if (data?.changeKey) item.setProperty("X-M365-CHANGEKEY", safeString(data.changeKey));
    if (data?.iCalUId) item.setProperty("X-M365-ICALUID", safeString(data.iCalUId));

    if (data?.status) item.status = safeString(data.status).toUpperCase();
    if (data?.privacy) item.privacy = safeString(data.privacy).toUpperCase();
    if (data?.transparency) item.setProperty("TRANSP", safeString(data.transparency).toUpperCase());
    if (data?.isCancelled) item.status = "CANCELLED";

    try { item.setCategories((data?.categories || []).map(safeString)); } catch (_) {}

    if (data?.organizer?.address) {
      item.organizer = plainToAttendee(data.organizer, true);
    }
    for (const attendeeData of data?.attendees || []) {
      const attendee = plainToAttendee(attendeeData, false);
      if (attendee) item.addAttendee(attendee);
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
  const nativeSyncStats = {
    lastStartedAt: "",
    lastFinishedAt: "",
    graphEvents: 0,
    cacheWrites: 0,
    cacheAdds: 0,
    cacheModifies: 0,
    cacheDeletes: 0,
    cacheUnchanged: 0,
    cacheItems: 0,
    directPushes: 0,
    lastGraphCalendarId: "",
    mode: "",
    message: "",
    error: ""
  };

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
        if (name !== "calendar-main-in-composite" || !isOwnCalendar(calendar, extension)) return;
        scheduleCalendarViewReload(value ? "visibility:show" : "visibility:hide");
      },
      onPropertyDeleting(calendar, name) {
        if (name !== "calendar-main-in-composite" || !isOwnCalendar(calendar, extension)) return;
        scheduleCalendarViewReload("visibility:hide");
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
      const me = normalizeMail(this.getProperty(PROP_ORGANIZER_ID));
      return Boolean(organizer && me && organizer !== me);
    }

    getInvitedAttendee(item) {
      const me = normalizeMail(this.getProperty(PROP_ORGANIZER_ID));
      if (!me) return null;
      try {
        return (item?.getAttendees?.() || []).find(attendee => normalizeMail(attendee.id) === me) || null;
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
        const results = await this.extension.emit(
          "nativeCalendar.onItemUpdated",
          calendarDescriptor(this),
          itemToPlain(newItem),
          itemToPlain(oldItem),
          options
        );
        const result = firstUsefulResult(results);
        if (!result?.id) throw new Error("Microsoft 365 did not return the updated event");
        const item = plainToItem(result, this);
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
      this.mObservers.notify("onLoad", [this]);
    }

    async replayChangesOn(listener) {
      nativeSyncStats.lastStartedAt = new Date().toISOString();
      nativeSyncStats.lastFinishedAt = "";
      nativeSyncStats.graphEvents = 0;
      nativeSyncStats.cacheWrites = 0;
      nativeSyncStats.cacheAdds = 0;
      nativeSyncStats.cacheModifies = 0;
      nativeSyncStats.cacheDeletes = 0;
      nativeSyncStats.cacheUnchanged = 0;
      nativeSyncStats.cacheItems = 0;
      nativeSyncStats.lastGraphCalendarId = safeString(this.getProperty(PROP_GRAPH_ID));
      nativeSyncStats.mode = "provider-replay";
      nativeSyncStats.message = "";
      nativeSyncStats.error = "";
      this.offlineStorage.startBatch();
      try {
        const results = await this.extension.emit("nativeCalendar.onSync", calendarDescriptor(this));
        const result = firstUsefulResult(results);
        if (!result || !Array.isArray(result.events)) {
          throw new Error("Microsoft 365 native sync returned no event snapshot");
        }
        nativeSyncStats.graphEvents = result.events.length;

        // Reconcile the Thunderbird offline snapshot by stable Graph ID. This
        // preserves the observer lifecycle required by the active calendar view
        // and avoids duplicate rendering after refresh/hide/show cycles.
        const syncStats = await reconcileOfflineStorage(this.offlineStorage, result.events, this);
        nativeSyncStats.cacheAdds = syncStats.adds;
        nativeSyncStats.cacheModifies = syncStats.modifies;
        nativeSyncStats.cacheDeletes = syncStats.deletes;
        nativeSyncStats.cacheUnchanged = syncStats.unchanged;
        nativeSyncStats.cacheWrites = syncStats.adds + syncStats.modifies + syncStats.deletes;
        nativeSyncStats.cacheItems = await countOfflineEvents(this.offlineStorage);
        nativeSyncStats.message = `${result.message || ""}${result.message ? " · " : ""}+${syncStats.adds} ~${syncStats.modifies} -${syncStats.deletes} =${syncStats.unchanged}`;
        nativeSyncStats.lastFinishedAt = new Date().toISOString();
        listener.onResult({ status: Cr.NS_OK }, result.message || null);
      } catch (error) {
        nativeSyncStats.error = errorText(error);
        nativeSyncStats.lastFinishedAt = new Date().toISOString();
        console.error("M365 native calendar sync failed", error);
        listener.onResult({ status: error?.result || Cr.NS_ERROR_FAILURE }, error?.message || String(error));
      } finally {
        this.offlineStorage.endBatch();
      }
    }
  }

  async function listOfflineEvents(offlineStorage) {
    if (!offlineStorage) return [];
    const result = [];
    const filter = Ci.calICalendar.ITEM_FILTER_TYPE_EVENT |
      Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES;
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
      const unchanged = newChangeKey && oldChangeKey
        ? newChangeKey === oldChangeKey
        : itemFallbackSignature(oldItem) === dataFallbackSignature(data);
      if (unchanged) {
        stats.unchanged += 1;
        continue;
      }

      const newItem = plainToItem(data, calendar);
      try { newItem.generation = oldItem.generation; } catch (_) {}
      await offlineStorage.modifyItem(newItem, oldItem);
      stats.modifies += 1;
    }
    return stats;
  }

  async function countOfflineEvents(offlineStorage) {
    if (!offlineStorage) return 0;
    let count = 0;
    const filter = Ci.calICalendar.ITEM_FILTER_TYPE_EVENT |
      Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES;
    for await (const items of cal.iterate.streamValues(
      offlineStorage.getItems(filter, 0, null, null)
    )) {
      count += Array.isArray(items) ? items.length : 0;
    }
    return count;
  }

  function findCalendarByGraphId(extension, graphCalendarId) {
    const wanted = safeString(graphCalendarId);
    return cal.manager.getCalendars().find(calendar =>
      isOwnCalendar(calendar, extension) &&
      safeString(calendar.getProperty(PROP_GRAPH_ID)) === wanted
    ) || null;
  }

  async function replaceCalendarEvents(extension, graphCalendarId, events) {
    resetTrace("replaceCalendarEvents");
    nativeSyncStats.lastStartedAt = new Date().toISOString();
    nativeSyncStats.lastFinishedAt = "";
    nativeSyncStats.graphEvents = Array.isArray(events) ? events.length : 0;
    nativeSyncStats.cacheWrites = 0;
    nativeSyncStats.cacheAdds = 0;
    nativeSyncStats.cacheModifies = 0;
    nativeSyncStats.cacheDeletes = 0;
    nativeSyncStats.cacheUnchanged = 0;
    nativeSyncStats.cacheItems = 0;
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

      offlineStorage.startBatch();
      let syncStats;
      try {
        syncStats = await stage(`reconcileNativeCache:${calendar.name || graphCalendarId}`, () =>
          reconcileOfflineStorage(offlineStorage, events || [], raw)
        );
      } finally {
        offlineStorage.endBatch();
      }

      nativeSyncStats.cacheAdds = Number(syncStats?.adds || 0);
      nativeSyncStats.cacheModifies = Number(syncStats?.modifies || 0);
      nativeSyncStats.cacheDeletes = Number(syncStats?.deletes || 0);
      nativeSyncStats.cacheUnchanged = Number(syncStats?.unchanged || 0);
      nativeSyncStats.cacheWrites = nativeSyncStats.cacheAdds + nativeSyncStats.cacheModifies + nativeSyncStats.cacheDeletes;
      nativeSyncStats.cacheItems = await stage(
        `countNativeCache:${calendar.name || graphCalendarId}`,
        () => countOfflineEvents(offlineStorage)
      );
      nativeSyncStats.directPushes += 1;
      nativeSyncStats.message = `+${nativeSyncStats.cacheAdds} ~${nativeSyncStats.cacheModifies} -${nativeSyncStats.cacheDeletes} =${nativeSyncStats.cacheUnchanged}; ${nativeSyncStats.cacheItems} cached occurrence(s)`;
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
        cacheItems: nativeSyncStats.cacheItems,
        errorStage: nativeTrace.lastErrorStage || "replaceCalendarEvents",
        error: nativeTrace.lastError || nativeSyncStats.error,
        diagnostics: { ...nativeTrace, trace: [...nativeTrace.trace] }
      };
    }
  }

  function ensureProviderRegistered(extension) {
    stageSync("registerCalendarProvider", () => M365CalendarProvider.register(extension));
    stageSync("registerVisibilityReloadObserver", () => ensureVisibilityReloadObserver(extension));
    try { injectTeamsMeetingButton(extension); }
    catch (error) { nativeTeamsUiStats.lastError = errorText(error); }
    try { installNativeEventEditorDoubleClick(extension); }
    catch (error) { nativeEventEditorStats.lastError = errorText(error); }
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
            calendar.name = descriptor.name || "Microsoft 365";
            calendar.setProperty(PROP_GRAPH_ID, descriptor.graphCalendarId);
            calendar.setProperty(PROP_ACCOUNT_ID, descriptor.accountId || "");
            calendar.setProperty(PROP_ORGANIZER_ID, descriptor.organizerId || "");
            calendar.setProperty(PROP_ORGANIZER_NAME, descriptor.organizerName || "");
            calendar.setProperty("color", descriptor.color || "#4f6bed");
            calendar.setProperty("disabled", descriptor.enabled === false);
            calendar.setProperty("calendar-main-in-composite", descriptor.visible !== false);
            calendar.setProperty("suppressAlarms", false);
            calendar.setProperty("refreshInterval", 15);
            calendar.setProperty("readOnly", Boolean(descriptor.readOnly));
          });

          stageSync(`registerCalendar:${label}`, () => cal.manager.registerCalendar(calendar));
          const registeredId = calendar.id;
          calendar = stageSync(`resolveRegisteredCalendar:${label}`, () => cal.manager.getCalendarById(registeredId));
          if (!calendar) {
            throw new Error(`[resolveRegisteredCalendar:${label}] Thunderbird returned null for id ${registeredId}`);
          }
        } else {
          stageSync(`updateCalendar:${label}`, () => {
            calendar.name = descriptor.name || calendar.name;
            calendar.setProperty(PROP_ACCOUNT_ID, descriptor.accountId || "");
            calendar.setProperty(PROP_ORGANIZER_ID, descriptor.organizerId || "");
            calendar.setProperty(PROP_ORGANIZER_NAME, descriptor.organizerName || "");
            if (descriptor.color) calendar.setProperty("color", descriptor.color);
            calendar.setProperty("readOnly", Boolean(descriptor.readOnly));
            // IMPORTANT: do not overwrite "disabled" or
            // "calendar-main-in-composite" for an already registered calendar.
            // Those are Thunderbird/user UI state (Hide/Show, enable/disable),
            // not Graph metadata. Earlier releases reset them on every ensureCalendars()
            // call, which could immediately undo a Hide action.
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
        viewReloadStats: { ...nativeViewReloadStats },
        teamsButtonStats: { ...nativeTeamsUiStats },
        eventEditorStats: { ...nativeEventEditorStats }
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
        viewReloadStats: { ...nativeViewReloadStats },
        teamsButtonStats: { ...nativeTeamsUiStats },
        eventEditorStats: { ...nativeEventEditorStats }
      };
    }
  }

  async function shutdown(extension) {
    removeVisibilityReloadObserver();
    removeTeamsMeetingButtons();
    removeNativeEventEditorDoubleClick();
    try { await removeAll(extension); } catch (_) {}
    try { M365CalendarProvider.unregister(extension); } catch (_) {}
    return true;
  }

  return {
    ensureCalendars,
    removeAll,
    synchronize,
    replaceCalendarEvents,
    reloadViews,
    status,
    diagnostics,
    shutdown,
  };
}

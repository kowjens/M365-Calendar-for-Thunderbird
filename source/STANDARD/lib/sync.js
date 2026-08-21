"use strict";

(function (global) {
  const CACHE_SCHEMA_VERSION = 203;
  const MAX_CACHE_WINDOWS = 12;

  function asText(value) {
    return value == null ? "" : String(value);
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stableEvent(event) {
    if (!event || !event.id) return null;
    return {
      id: event.id,
      subject: event.subject || "",
      start: event.start || null,
      end: event.end || null,
      location: event.location || null,
      organizer: event.organizer || null,
      attendees: Array.isArray(event.attendees) ? event.attendees : [],
      responseStatus: event.responseStatus || null,
      isOnlineMeeting: Boolean(event.isOnlineMeeting),
      onlineMeeting: event.onlineMeeting || null,
      onlineMeetingUrl: event.onlineMeetingUrl || "",
      webLink: event.webLink || "",
      isOrganizer: Boolean(event.isOrganizer),
      type: event.type || "",
      showAs: event.showAs || "",
      sensitivity: event.sensitivity || "",
      body: event.body || null,
      bodyPreview: event.bodyPreview || "",
      isCancelled: Boolean(event.isCancelled),
      isAllDay: Boolean(event.isAllDay),
      iCalUId: event.iCalUId || "",
      uid: event.uid || "",
      seriesMasterId: event.seriesMasterId || "",
      originalStart: event.originalStart || "",
      originalStartTimeZone: event.originalStartTimeZone || "",
      originalEndTimeZone: event.originalEndTimeZone || "",
      recurrence: event.recurrence || null,
      isReminderOn: Boolean(event.isReminderOn),
      reminderMinutesBeforeStart: Number.isFinite(Number(event.reminderMinutesBeforeStart))
        ? Number(event.reminderMinutesBeforeStart)
        : null,
      categories: Array.isArray(event.categories) ? event.categories : [],
      hideAttendees: Boolean(event.hideAttendees),
      lastModifiedDateTime: event.lastModifiedDateTime || "",
      changeKey: event.changeKey || "",
      etag: event["@odata.etag"] || event.etag || ""
    };
  }

  function makeWindowKey({ accountId = "", calendarId = "", start = "", end = "", timeZone = "" } = {}) {
    return [
      "v203",
      encodeURIComponent(asText(accountId)),
      encodeURIComponent(asText(calendarId)),
      encodeURIComponent(asText(start)),
      encodeURIComponent(asText(end)),
      encodeURIComponent(asText(timeZone))
    ].join("|");
  }

  function eventSignature(event) {
    const safe = stableEvent(event);
    return safe ? JSON.stringify(safe) : "";
  }

  function sortEvents(events) {
    return [...(events || [])].sort((a, b) => {
      const ad = Date.parse(a?.start?.dateTime || "") || 0;
      const bd = Date.parse(b?.start?.dateTime || "") || 0;
      if (ad !== bd) return ad - bd;
      return asText(a?.subject).localeCompare(asText(b?.subject));
    });
  }

  function applyDelta(existingEvents, changes, { initial = false } = {}) {
    const map = new Map();
    for (const event of existingEvents || []) {
      const safe = stableEvent(event);
      if (safe) map.set(safe.id, safe);
    }

    const summary = { added: 0, updated: 0, removed: 0, unchanged: 0 };
    for (const raw of changes || []) {
      if (!raw?.id) continue;
      if (raw["@removed"]) {
        if (map.delete(raw.id)) summary.removed += 1;
        continue;
      }

      const previous = map.get(raw.id);
      // Microsoft Graph delta responses may represent an updated object with
      // only the changed properties. Never replace a complete cached event
      // with such a partial representation; merge it into the previous event.
      // Explicit null values still overwrite old values because object spread
      // preserves properties that are present in the delta payload.
      const mergedRaw = previous ? {
        ...previous,
        ...raw,
        start: raw.start ? { ...(previous.start || {}), ...raw.start } : previous.start,
        end: raw.end ? { ...(previous.end || {}), ...raw.end } : previous.end,
        location: raw.location ? { ...(previous.location || {}), ...raw.location } : previous.location,
        organizer: raw.organizer ? {
          ...(previous.organizer || {}),
          ...raw.organizer,
          emailAddress: raw.organizer.emailAddress
            ? { ...(previous.organizer?.emailAddress || {}), ...raw.organizer.emailAddress }
            : previous.organizer?.emailAddress
        } : previous.organizer,
        responseStatus: raw.responseStatus
          ? { ...(previous.responseStatus || {}), ...raw.responseStatus }
          : previous.responseStatus,
        onlineMeeting: raw.onlineMeeting
          ? { ...(previous.onlineMeeting || {}), ...raw.onlineMeeting }
          : previous.onlineMeeting,
        body: raw.body ? { ...(previous.body || {}), ...raw.body } : previous.body
      } : raw;
      const safe = stableEvent(mergedRaw);
      if (!safe) continue;
      if (!previous) {
        map.set(safe.id, safe);
        summary.added += 1;
      } else if (eventSignature(previous) !== eventSignature(safe)) {
        map.set(safe.id, safe);
        summary.updated += 1;
      } else {
        summary.unchanged += 1;
      }
    }

    if (initial) {
      // An initial delta round is a complete snapshot. Count it as loaded data,
      // not as a burst of user-visible "new" changes.
      summary.loaded = map.size;
    }

    return { events: sortEvents([...map.values()]), summary };
  }

  function diffSnapshots(previousEvents, nextEvents) {
    const previous = new Map();
    const next = new Map();
    for (const event of previousEvents || []) {
      const safe = stableEvent(event);
      if (safe) previous.set(safe.id, safe);
    }
    for (const event of nextEvents || []) {
      const safe = stableEvent(event);
      if (safe) next.set(safe.id, safe);
    }
    const summary = { added: 0, updated: 0, removed: 0, unchanged: 0, loaded: next.size };
    for (const [id, event] of next) {
      const old = previous.get(id);
      if (!old) summary.added += 1;
      else if (eventSignature(old) !== eventSignature(event)) summary.updated += 1;
      else summary.unchanged += 1;
    }
    for (const id of previous.keys()) if (!next.has(id)) summary.removed += 1;
    return { events: sortEvents([...next.values()]), summary };
  }

  function newStore() {
    return { schemaVersion: CACHE_SCHEMA_VERSION, windows: {}, updatedAt: 0 };
  }

  function normalizeStore(store) {
    if (!store || Number(store.schemaVersion) !== CACHE_SCHEMA_VERSION || typeof store.windows !== "object") {
      return newStore();
    }
    return { ...store, windows: { ...store.windows } };
  }

  function pruneStore(store, maxWindows = MAX_CACHE_WINDOWS) {
    const clean = normalizeStore(store);
    const entries = Object.entries(clean.windows)
      .sort((a, b) => Number(b[1]?.lastAccessAt || b[1]?.lastSyncAt || 0) - Number(a[1]?.lastAccessAt || a[1]?.lastSyncAt || 0));
    clean.windows = Object.fromEntries(entries.slice(0, Math.max(1, maxWindows)));
    return clean;
  }

  function isLikelyDeltaTokenError(error) {
    const status = Number(error?.status || 0);
    const code = asText(error?.data?.error?.code || error?.code).toLowerCase();
    const message = asText(error?.message).toLowerCase();
    if (status === 410 || status === 404) return true;
    if (status === 400 && /(syncstate|deltatoken|skiptoken|resync|invalid.*token)/i.test(`${code} ${message}`)) return true;
    return /(syncstatenotfound|resyncrequired)/i.test(code);
  }

  global.M365_SYNC = {
    CACHE_SCHEMA_VERSION,
    MAX_CACHE_WINDOWS,
    stableEvent,
    makeWindowKey,
    eventSignature,
    sortEvents,
    applyDelta,
    diffSnapshots,
    newStore,
    normalizeStore,
    pruneStore,
    isLikelyDeltaTokenError,
    clone
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

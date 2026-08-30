"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M365_NATIVE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const COLOR_MAP = {
    auto: "#4f6bed",
    lightBlue: "#4f9fe8",
    lightGreen: "#57a773",
    lightOrange: "#d9822b",
    lightGray: "#8a8f98",
    lightYellow: "#c69f00",
    lightTeal: "#2f9e9b",
    lightPink: "#c96f9f",
    lightBrown: "#9a6b4f",
    lightRed: "#d45757",
    maxColor: "#4f6bed"
  };

  function cleanString(value) {
    return value == null ? "" : String(value);
  }

  function cleanAddress(value) {
    return cleanString(value).replace(/^mailto:/i, "").trim().toLowerCase();
  }

  function graphColorToHex(color) {
    return COLOR_MAP[cleanString(color)] || COLOR_MAP.auto;
  }

  function graphResponseToPartstat(value) {
    switch (cleanString(value).toLowerCase()) {
      case "accepted": return "ACCEPTED";
      case "tentativelyaccepted":
      case "tentative": return "TENTATIVE";
      case "declined": return "DECLINED";
      case "notresponded":
      case "none":
      default: return "NEEDS-ACTION";
    }
  }

  function partstatToGraphAction(value) {
    switch (cleanString(value).toUpperCase()) {
      case "ACCEPTED": return "accept";
      case "TENTATIVE": return "tentativelyAccept";
      case "DECLINED": return "decline";
      default: return "";
    }
  }

  function graphAttendeeRole(type) {
    switch (cleanString(type).toLowerCase()) {
      case "optional": return "OPT-PARTICIPANT";
      case "resource": return "NON-PARTICIPANT";
      default: return "REQ-PARTICIPANT";
    }
  }

  function nativeRoleToGraphType(role, type) {
    const normalizedType = cleanString(type).toUpperCase();
    if (normalizedType === "RESOURCE") return "resource";
    switch (cleanString(role).toUpperCase()) {
      case "OPT-PARTICIPANT": return "optional";
      case "NON-PARTICIPANT": return "resource";
      default: return "required";
    }
  }

  function normalizeGraphDateTime(dateTime, timeZone) {
    const raw = cleanString(dateTime).trim();
    if (!raw) return "";
    if (/Z$|[+-]\d{2}:?\d{2}$/i.test(raw)) {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
    }
    // V2 native sync requests UTC from Graph. Treat timezone-less Graph values
    // as UTC when Graph labels them UTC. A final Date parse fallback keeps
    // compatibility with responses that include an offset.
    if (cleanString(timeZone).toUpperCase() === "UTC") {
      const parsed = new Date(`${raw}Z`);
      return Number.isNaN(parsed.getTime()) ? `${raw}Z` : parsed.toISOString();
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }

  function graphAttendeeToNative(attendee) {
    const address = cleanAddress(attendee?.emailAddress?.address);
    if (!address) return null;
    return {
      address,
      name: cleanString(attendee?.emailAddress?.name),
      role: graphAttendeeRole(attendee?.type),
      status: graphResponseToPartstat(attendee?.status?.response),
      rsvp: true,
      type: cleanString(attendee?.type).toLowerCase() === "resource" ? "RESOURCE" : "INDIVIDUAL"
    };
  }

  function graphOrganizerToNative(organizer) {
    const address = cleanAddress(organizer?.emailAddress?.address);
    if (!address) return undefined;
    return {
      address,
      name: cleanString(organizer?.emailAddress?.name),
      role: "CHAIR",
      status: "ACCEPTED",
      rsvp: false,
      type: "INDIVIDUAL"
    };
  }

  function graphEventToNative(event) {
    const attendees = (event?.attendees || []).map(graphAttendeeToNative).filter(Boolean);
    const joinUrl = cleanString(event?.onlineMeeting?.joinUrl || event?.onlineMeetingUrl);
    const webLink = cleanString(event?.webLink);
    const isOnlineMeeting = Boolean(event?.isOnlineMeeting || joinUrl);
    // V2.27: a personal Microsoft 365 appointment is still owned by the
    // signed-in user. Keep the Graph organizer in the neutral mapping. The
    // privileged Thunderbird mirror may add a synthetic accepted self-attendee
    // purely for rendering, but that synthetic attendee is stripped again when
    // an appointment is written back to Graph.
    const isAppointment = attendees.length === 0 && !isOnlineMeeting;
    const organizer = graphOrganizerToNative(event?.organizer);
    const showAs = cleanString(event?.showAs).toLowerCase();
    const sensitivity = cleanString(event?.sensitivity).toLowerCase();
    const response = cleanString(event?.responseStatus?.response);
    return {
      id: cleanString(event?.id),
      title: cleanString(event?.subject),
      start: normalizeGraphDateTime(event?.start?.dateTime, event?.start?.timeZone),
      end: normalizeGraphDateTime(event?.end?.dateTime, event?.end?.timeZone),
      allDay: Boolean(event?.isAllDay),
      location: cleanString(event?.location?.displayName),
      description: cleanString(event?.body?.content || event?.bodyPreview),
      url: joinUrl || webLink,
      webLink,
      status: event?.isCancelled ? "CANCELLED" : "CONFIRMED",
      privacy: sensitivity === "private" ? "PRIVATE" : sensitivity === "confidential" ? "CONFIDENTIAL" : "PUBLIC",
      transparency: showAs === "free" ? "TRANSPARENT" : "OPAQUE",
      categories: Array.isArray(event?.categories) ? event.categories.map(cleanString).filter(Boolean) : [],
      organizer,
      attendees,
      reminderMinutes: event?.isReminderOn && Number.isFinite(Number(event?.reminderMinutesBeforeStart))
        ? Math.max(0, Math.round(Number(event.reminderMinutesBeforeStart)))
        : undefined,
      isCancelled: Boolean(event?.isCancelled),
      isOnlineMeeting,
      isAppointment,
      isOrganizer: Boolean(event?.isOrganizer),
      responseStatus: isAppointment ? "" : response,
      nativeSelfMirror: isAppointment,
      graphType: cleanString(event?.type),
      seriesMasterId: cleanString(event?.seriesMasterId),
      changeKey: cleanString(event?.changeKey),
      iCalUId: cleanString(event?.iCalUId || event?.uid)
    };
  }

  function isoToGraphDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return cleanString(value).replace(/Z$/i, "");
    return date.toISOString().replace(/\.\d{3}Z$/, "");
  }

  function nativeAttendeeToGraph(attendee) {
    const address = cleanAddress(attendee?.address);
    if (!address) return null;
    return {
      emailAddress: {
        address,
        ...(attendee?.name ? { name: cleanString(attendee.name) } : {})
      },
      type: nativeRoleToGraphType(attendee?.role, attendee?.type)
    };
  }

  function nativeItemToGraphPayload(item, { includeAttendees = true } = {}) {
    const payload = {
      subject: cleanString(item?.title),
      start: { dateTime: isoToGraphDateTime(item?.start), timeZone: "UTC" },
      end: { dateTime: isoToGraphDateTime(item?.end), timeZone: "UTC" },
      isAllDay: Boolean(item?.allDay),
      body: { contentType: "text", content: cleanString(item?.description) },
      location: { displayName: cleanString(item?.location) },
      categories: Array.isArray(item?.categories) ? item.categories.map(cleanString).filter(Boolean) : [],
      sensitivity: cleanString(item?.privacy).toUpperCase() === "PRIVATE"
        ? "private"
        : cleanString(item?.privacy).toUpperCase() === "CONFIDENTIAL" ? "confidential" : "normal",
      showAs: cleanString(item?.transparency).toUpperCase() === "TRANSPARENT" ? "free" : "busy",
      isReminderOn: item?.reminderMinutes != null,
      reminderMinutesBeforeStart: item?.reminderMinutes != null
        ? Math.max(0, Math.round(Number(item.reminderMinutes) || 0))
        : 15,
      allowNewTimeProposals: true
    };
    if (includeAttendees) {
      payload.attendees = (item?.attendees || []).map(nativeAttendeeToGraph).filter(Boolean);
    }
    return payload;
  }

  function responseChangeForUser(newItem, oldItem, userAddress) {
    const me = cleanAddress(userAddress);
    if (!me) return "";
    const findStatus = item => cleanString((item?.attendees || []).find(a => cleanAddress(a?.address) === me)?.status).toUpperCase();
    const before = findStatus(oldItem);
    const after = findStatus(newItem);
    if (!after || after === before) return "";
    return partstatToGraphAction(after);
  }

  function stableRange(now, daysBefore = 90, daysAfter = 365) {
    const base = now instanceof Date ? new Date(now) : new Date(now || Date.now());
    if (Number.isNaN(base.getTime())) throw new Error("Invalid native calendar reference date");
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start);
    start.setUTCDate(start.getUTCDate() - Math.max(0, Number(daysBefore) || 0));
    end.setUTCDate(end.getUTCDate() + Math.max(1, Number(daysAfter) || 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }

  return {
    cleanAddress,
    graphColorToHex,
    graphResponseToPartstat,
    partstatToGraphAction,
    graphEventToNative,
    nativeItemToGraphPayload,
    responseChangeForUser,
    stableRange,
    normalizeGraphDateTime
  };
});

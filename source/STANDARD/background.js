"use strict";

const VERSION = "2.0.19";
const CONFIG_SCHEMA_VERSION = 203;
const SYNC_STORE_KEY = "syncCacheV203";
const CALENDAR_CACHE_KEY = "calendarCacheV120";
const SYNC_EVENT_SELECT = "id,subject,start,end,location,organizer,attendees,responseStatus,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,webLink,isOrganizer,type,showAs,sensitivity,body,bodyPreview,isCancelled,isAllDay,iCalUId,uid,seriesMasterId,originalStart,originalStartTimeZone,originalEndTimeZone,recurrence,isReminderOn,reminderMinutesBeforeStart,categories,hideAttendees,lastModifiedDateTime,changeKey";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const BUILD_DEFAULTS = (typeof M365_BUILD_DEFAULTS !== "undefined" && M365_BUILD_DEFAULTS)
  ? M365_BUILD_DEFAULTS
  : { clientId: "", tenant: "", buildFlavor: "github", nativeMode: true };
const DEFAULT_CONFIG = {
  clientId: String(BUILD_DEFAULTS.clientId || ""),
  tenant: String(BUILD_DEFAULTS.tenant || ""),
  timeZone: "W. Europe Standard Time",
  selectedCalendarId: "",
  daysBefore: 14,
  daysAfter: 45,
  autoSyncMinutes: 5,
  nativeIntegration: true,
  nativeDaysBefore: 90,
  nativeDaysAfter: 365,
  configSchemaVersion: CONFIG_SCHEMA_VERSION
};

function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}
const BASE_SCOPES = ["openid", "profile", "offline_access", "User.Read", "Calendars.ReadWrite"];
const SCOPES = [...BASE_SCOPES, "Calendars.ReadWrite.Shared"];
let spaceId = null;

// V2.16: The native Experiment API is deliberately lazy. Merely installing a
// NATIVE XPI must not touch browser.nativeCalendar during background startup.
// This keeps the proven STANDARD UI/Graph path alive even if Thunderbird
// rejects or cannot load the privileged provider bridge.
const NATIVE_PACKAGE = BUILD_DEFAULTS.nativeMode !== false;
const nativeBridgeState = {
  probed: false,
  available: false,
  error: "",
  api: null,
  listenersBound: false
};

function nativeApiIfLoaded() {
  return nativeBridgeState.available ? nativeBridgeState.api : null;
}

function bindNativeBridgeEvents(api) {
  if (!api || nativeBridgeState.listenersBound) return;
  api.onSync.addListener(nativeSyncHandler);
  api.onItemCreated.addListener(nativeCreateHandler);
  api.onItemUpdated.addListener(nativeUpdateHandler);
  api.onItemRemoved.addListener(nativeRemoveHandler);
  nativeBridgeState.listenersBound = true;
}

async function probeNativeApi({ retry = false } = {}) {
  if (!NATIVE_PACKAGE) return null;
  if (nativeBridgeState.available && nativeBridgeState.api) return nativeBridgeState.api;
  if (nativeBridgeState.probed && nativeBridgeState.error && !retry) return null;

  nativeBridgeState.probed = true;
  nativeBridgeState.error = "";
  try {
    // This is the ONLY place where the background first touches the custom
    // Experiment namespace. It is called after normal WebExtension startup.
    const api = browser.nativeCalendar;
    if (!api?.ping) throw new Error("Thunderbird did not expose the nativeCalendar Experiment API");
    await api.ping();
    nativeBridgeState.api = api;
    nativeBridgeState.available = true;
    bindNativeBridgeEvents(api);
    return api;
  } catch (error) {
    nativeBridgeState.api = null;
    nativeBridgeState.available = false;
    nativeBridgeState.error = error?.message || String(error);
    console.error("M365 native Experiment bridge could not be loaded", error);
    return null;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBase64Url(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64Url(new Uint8Array(digest));
}

function normalizeConfig(input = {}) {
  const clean = { ...DEFAULT_CONFIG, ...input };
  clean.clientId = String(clean.clientId || "").trim();
  clean.tenant = String(clean.tenant || "").trim();
  clean.timeZone = String(clean.timeZone || "").trim() || DEFAULT_CONFIG.timeZone;
  clean.selectedCalendarId = String(clean.selectedCalendarId || "");
  clean.daysBefore = Math.max(0, Math.min(365, Number(clean.daysBefore) || DEFAULT_CONFIG.daysBefore));
  clean.daysAfter = Math.max(1, Math.min(365, Number(clean.daysAfter) || DEFAULT_CONFIG.daysAfter));
  const autoSync = Number(clean.autoSyncMinutes);
  clean.autoSyncMinutes = Number.isFinite(autoSync) ? Math.max(0, Math.min(60, autoSync)) : DEFAULT_CONFIG.autoSyncMinutes;
  clean.nativeIntegration = clean.nativeIntegration !== false;
  clean.nativeDaysBefore = Math.max(0, Math.min(730, Number(clean.nativeDaysBefore) || DEFAULT_CONFIG.nativeDaysBefore));
  clean.nativeDaysAfter = Math.max(1, Math.min(1095, Number(clean.nativeDaysAfter) || DEFAULT_CONFIG.nativeDaysAfter));
  clean.configSchemaVersion = CONFIG_SCHEMA_VERSION;
  return clean;
}

async function getConfig() {
  const stored = await browser.storage.local.get("config");
  const previous = stored.config || {};
  const oldSchema = Number(previous.configSchemaVersion || 0);
  const merged = { ...DEFAULT_CONFIG, ...previous };

  // Older releases may contain empty build configuration. On the first V2.16
  // run, migrate empty values to packaged defaults and native integration
  // defaults exactly once.
  if (oldSchema < CONFIG_SCHEMA_VERSION) {
    if (!String(previous.clientId || "").trim() && BUILD_DEFAULTS.clientId) {
      merged.clientId = BUILD_DEFAULTS.clientId;
    }
    if (!String(previous.tenant || "").trim() && BUILD_DEFAULTS.tenant) {
      merged.tenant = BUILD_DEFAULTS.tenant;
    }
    const migrated = normalizeConfig(merged);
    await browser.storage.local.set({ config: migrated });
    return migrated;
  }

  return normalizeConfig(merged);
}

async function saveConfig(patch) {
  const current = await getConfig();
  const clean = normalizeConfig({ ...current, ...patch });
  await browser.storage.local.set({ config: clean });
  return clean;
}

async function clearAuth() {
  await browser.storage.local.remove(["auth", "profile"]);
}

async function getAuth() {
  const stored = await browser.storage.local.get("auth");
  return stored.auth || null;
}

async function saveAuth(tokenResponse) {
  const old = await getAuth();
  const auth = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || old?.refreshToken || "",
    expiresAt: Date.now() + Math.max(60, Number(tokenResponse.expires_in || 3600)) * 1000,
    scope: tokenResponse.scope || ""
  };
  await browser.storage.local.set({ auth });
  return auth;
}

function tokenEndpoint(tenant) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
  }
  if (!response.ok) {
    const msg = data?.error_description || data?.error?.message || data?.error || data?.raw || `HTTP ${response.status}`;
    const error = new Error(msg);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function login() {
  const config = await getConfig();
  if (!config.clientId) {
    throw new Error(t("errorClientIdMissing"));
  }
  if (!config.tenant) {
    throw new Error(t("errorTenantMissing"));
  }

  const redirectUri = browser.identity.getRedirectURL("oauth2");
  const verifier = randomBase64Url(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomBase64Url(24);
  const authorize = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize`);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", SCOPES.join(" "));
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");

  const redirectResult = await browser.identity.launchWebAuthFlow({
    url: authorize.toString(),
    interactive: true
  });
  if (!redirectResult) throw new Error(t("errorLoginCancelled"));

  const resultUrl = new URL(redirectResult);
  const returnedState = resultUrl.searchParams.get("state");
  if (returnedState !== state) throw new Error(t("errorStateMismatch"));
  const authError = resultUrl.searchParams.get("error_description") || resultUrl.searchParams.get("error");
  if (authError) throw new Error(authError);
  const code = resultUrl.searchParams.get("code");
  if (!code) throw new Error(t("errorNoAuthCode"));

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: SCOPES.join(" ")
  });
  const response = await fetch(tokenEndpoint(config.tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const tokenResponse = await parseJsonResponse(response);
  await saveAuth(tokenResponse);
  const profile = await graphRequest("/me?$select=displayName,mail,userPrincipalName,id");
  await browser.storage.local.set({ profile });
  try {
    await ensureNativeCalendars({ synchronize: true });
  } catch (error) {
    console.error("M365 native calendar setup after login failed", error);
  }
  return profile;
}

async function refreshAccessToken() {
  const config = await getConfig();
  const auth = await getAuth();
  if (!auth?.refreshToken) throw new Error(t("errorNoValidLogin"));
  if (!config.clientId) throw new Error(t("errorClientIdShort"));
  if (!config.tenant) throw new Error(t("errorTenantShort"));

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "refresh_token",
    refresh_token: auth.refreshToken,
    scope: String(auth.scope || BASE_SCOPES.join(" "))
  });
  const response = await fetch(tokenEndpoint(config.tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  try {
    return await saveAuth(await parseJsonResponse(response));
  } catch (error) {
    await clearAuth();
    const wrapped = new Error(t("errorLoginExpired", error.message));
    wrapped.status = Number(error?.status || 0);
    wrapped.data = error?.data || null;
    throw wrapped;
  }
}

async function getAccessToken() {
  let auth = await getAuth();
  if (!auth?.accessToken) throw new Error(t("errorNotSignedIn"));
  if (Date.now() > Number(auth.expiresAt || 0) - 90_000) auth = await refreshAccessToken();
  return auth.accessToken;
}

function graphRequestUrl(pathOrUrl) {
  const value = String(pathOrUrl || "");
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "graph.microsoft.com") {
      throw new Error(t("errorUnsafeGraphUrl"));
    }
    return url.toString();
  }
  return `${GRAPH_BASE}${value.startsWith("/") ? value : `/${value}`}`;
}

async function graphRequest(pathOrUrl, options = {}, retry = true) {
  const token = await getAccessToken();
  const config = await getConfig();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const prefer = [];
  const existingPrefer = headers.has("Prefer") ? String(headers.get("Prefer") || "") : "";
  if (existingPrefer) prefer.push(existingPrefer);
  if (config.timeZone && !/outlook\.timezone\s*=/i.test(existingPrefer)) {
    prefer.push(`outlook.timezone="${config.timeZone.replace(/"/g, "")}"`);
  }
  if (prefer.length) headers.set("Prefer", prefer.filter(Boolean).join(", "));

  const response = await fetch(graphRequestUrl(pathOrUrl), { ...options, headers });
  if (response.status === 401 && retry) {
    await refreshAccessToken();
    return graphRequest(pathOrUrl, options, false);
  }
  if (response.status === 204) return null;
  return parseJsonResponse(response);
}

async function authStatus() {
  const [auth, config, stored] = await Promise.all([
    getAuth(),
    getConfig(),
    browser.storage.local.get("profile")
  ]);
  return {
    loggedIn: Boolean(auth?.accessToken || auth?.refreshToken),
    profile: stored.profile || null,
    configured: Boolean(config.clientId && config.tenant),
    preconfigured: Boolean(BUILD_DEFAULTS.clientId && BUILD_DEFAULTS.tenant),
    buildFlavor: String(BUILD_DEFAULTS.buildFlavor || "github"),
    nativeMode: BUILD_DEFAULTS.nativeMode !== false,
    nativeCapable: Boolean(nativeBridgeState.available),
    nativeProbed: Boolean(nativeBridgeState.probed),
    nativeProbeError: String(nativeBridgeState.error || ""),
    redirectUri: browser.identity.getRedirectURL("oauth2"),
    version: VERSION
  };
}

async function listCalendars() {
  const [data, defaultCalendar, stored] = await Promise.all([
    graphRequest("/me/calendars?$select=id,name,color,canEdit,owner&$top=100"),
    graphRequest("/me/calendar?$select=id,name,color,canEdit,owner"),
    browser.storage.local.get("profile")
  ]);
  const me = profileMail(stored.profile || {});
  const calendars = data?.value || [];
  for (const calendar of calendars) {
    calendar.isDefault = calendar.id === defaultCalendar?.id;
    const owner = String(calendar?.owner?.address || "").trim().toLowerCase();
    calendar.isShared = Boolean(owner && me && owner !== me);
  }
  calendars.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isShared !== b.isShared) return a.isShared ? 1 : -1;
    return String(a.name).localeCompare(String(b.name), browser.i18n.getUILanguage());
  });
  return calendars;
}

function encodeId(id) {
  return encodeURIComponent(id);
}

async function profileAccountId() {
  const stored = await browser.storage.local.get("profile");
  return String(stored.profile?.id || stored.profile?.userPrincipalName || "");
}

async function getSyncStore() {
  const stored = await browser.storage.local.get(SYNC_STORE_KEY);
  return M365_SYNC.normalizeStore(stored[SYNC_STORE_KEY]);
}

async function saveSyncStore(store) {
  const clean = M365_SYNC.pruneStore({ ...store, updatedAt: Date.now() });
  await browser.storage.local.set({ [SYNC_STORE_KEY]: clean });
  return clean;
}

async function getCalendarCache() {
  const stored = await browser.storage.local.get(CALENDAR_CACHE_KEY);
  return stored[CALENDAR_CACHE_KEY] || null;
}

async function saveCalendarCache(calendars) {
  const cache = {
    schemaVersion: M365_SYNC.CACHE_SCHEMA_VERSION,
    accountId: await profileAccountId(),
    cachedAt: Date.now(),
    calendars: (calendars || []).map(calendar => ({
      id: calendar.id,
      name: calendar.name || "",
      color: calendar.color || "",
      canEdit: Boolean(calendar.canEdit),
      owner: calendar.owner || null,
      isDefault: Boolean(calendar.isDefault),
      isShared: Boolean(calendar.isShared)
    }))
  };
  await browser.storage.local.set({ [CALENDAR_CACHE_KEY]: cache });
  return cache;
}

async function clearCachedCalendarData() {
  await browser.storage.local.remove([SYNC_STORE_KEY, "syncCacheV120", CALENDAR_CACHE_KEY]);
}

async function clearSyncCache({ calendarId = "" } = {}) {
  if (!calendarId) {
    await clearCachedCalendarData();
    return { ok: true, removedWindows: "all" };
  }
  const store = await getSyncStore();
  let removed = 0;
  for (const [key, entry] of Object.entries(store.windows || {})) {
    if (String(entry?.calendarId || "") === String(calendarId)) {
      delete store.windows[key];
      removed += 1;
    }
  }
  await saveSyncStore(store);
  return { ok: true, removedWindows: removed };
}

async function syncCacheStats() {
  const [store, calendarCache] = await Promise.all([getSyncStore(), getCalendarCache()]);
  const windows = Object.values(store.windows || {});
  return {
    windows: windows.length,
    events: windows.reduce((sum, entry) => sum + (entry?.events?.length || 0), 0),
    lastSyncAt: Math.max(0, ...windows.map(entry => Number(entry?.lastSyncAt || 0))),
    lastFullSyncAt: Math.max(0, ...windows.map(entry => Number(entry?.lastFullSyncAt || 0))),
    calendarCachedAt: Number(calendarCache?.cachedAt || 0)
  };
}


function canUseOfflineCache(error) {
  const status = Number(error?.status || 0);
  if (!status) return true;
  return status === 408 || status === 429 || status >= 500;
}

async function listCalendarsCached() {
  try {
    const calendars = await listCalendars();
    const cache = await saveCalendarCache(calendars);
    return { calendars, source: "network", cachedAt: cache.cachedAt, offline: false, error: "" };
  } catch (error) {
    if (!canUseOfflineCache(error)) throw error;
    const [cache, accountId] = await Promise.all([getCalendarCache(), profileAccountId()]);
    if (cache?.calendars?.length && (!accountId || !cache.accountId || cache.accountId === accountId)) {
      return {
        calendars: cache.calendars,
        source: "cache",
        cachedAt: Number(cache.cachedAt || 0),
        offline: true,
        error: error?.message || String(error)
      };
    }
    throw error;
  }
}

function deltaInitialPath(start, end) {
  const query = new URLSearchParams({ startDateTime: start, endDateTime: end });
  return `/me/calendarView/delta?${query}`;
}

function fullCalendarViewPath(calendarId, start, end) {
  const query = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    "$top": "250",
    "$select": SYNC_EVENT_SELECT
  });
  return `/me/calendars/${encodeId(calendarId)}/calendarView?${query}`;
}

async function isDefaultCalendar(calendarId) {
  const cache = await getCalendarCache();
  const found = cache?.calendars?.find(calendar => String(calendar.id) === String(calendarId));
  if (found) return Boolean(found.isDefault);
  try {
    const primary = await graphRequest("/me/calendar?$select=id");
    return String(primary?.id || "") === String(calendarId);
  } catch (_) {
    return false;
  }
}



function eventNeedsDetailHydration(event) {
  if (!event?.id) return false;
  // A subject may legitimately be empty, but an empty subject together with
  // otherwise sparse event data is a strong indication that Graph returned a
  // limited/partial representation. Re-read the event before caching it.
  const subjectMissing = !String(event?.subject || "").trim();
  const sparse = !event?.organizer && !event?.location?.displayName &&
    !event?.body?.content && !event?.bodyPreview &&
    (!Array.isArray(event?.attendees) || event.attendees.length === 0);
  return subjectMissing || sparse;
}

async function hydrateEventDetails(calendarId, events) {
  const output = [...(events || [])];
  const targets = output
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => eventNeedsDetailHydration(event));
  if (!targets.length) return { events: output, hydrated: 0, unresolved: 0 };

  let hydrated = 0;
  let unresolved = 0;
  const select = encodeURIComponent(SYNC_EVENT_SELECT);

  // Graph JSON batching allows up to 20 subrequests. This prevents a calendar
  // with many sparse delta objects from causing hundreds of sequential calls.
  for (let offset = 0; offset < targets.length; offset += 20) {
    const chunk = targets.slice(offset, offset + 20);
    const requests = chunk.map((entry, index) => ({
      id: String(index + 1),
      method: "GET",
      url: `/me/calendars/${encodeId(calendarId)}/events/${encodeId(entry.event.id)}?$select=${select}`,
      headers: { Prefer: 'outlook.body-content-type="text"' }
    }));

    try {
      const batch = await graphRequest("/$batch", {
        method: "POST",
        body: JSON.stringify({ requests })
      });
      const responses = new Map((batch?.responses || []).map(response => [String(response.id), response]));
      for (let i = 0; i < chunk.length; i++) {
        const response = responses.get(String(i + 1));
        const entry = chunk[i];
        if (response && Number(response.status) >= 200 && Number(response.status) < 300 && response.body) {
          output[entry.index] = { ...entry.event, ...response.body };
          hydrated += 1;
        } else {
          unresolved += 1;
        }
      }
    } catch (batchError) {
      // Conservative fallback: retry the affected items individually. A failed
      // detail read must never discard the calendar snapshot itself.
      for (const entry of chunk) {
        try {
          const detail = await graphRequest(
            `/me/calendars/${encodeId(calendarId)}/events/${encodeId(entry.event.id)}?$select=${select}`,
            { headers: { Prefer: 'outlook.body-content-type="text"' } }
          );
          if (detail) {
            output[entry.index] = { ...entry.event, ...detail };
            hydrated += 1;
          } else {
            unresolved += 1;
          }
        } catch (_) {
          unresolved += 1;
        }
      }
    }
  }

  return { events: output, hydrated, unresolved };
}

function combineSyncSummary(total, part) {
  for (const key of ["added", "updated", "removed", "unchanged", "loaded"]) {
    total[key] = Number(total[key] || 0) + Number(part?.[key] || 0);
  }
  return total;
}

async function executeDeltaRound({ calendarId, start, end, entry, forceFull = false }) {
  const initial = forceFull || !entry?.deltaLink;
  let next = initial ? deltaInitialPath(start, end) : entry.deltaLink;
  let workingEvents = initial ? [] : (entry.events || []);
  let deltaLink = "";
  let pages = 0;
  const summary = { added: 0, updated: 0, removed: 0, unchanged: 0, loaded: 0 };

  while (next) {
    pages += 1;
    if (pages > 60) throw new Error(t("errorTooManyDeltaPages"));
    const data = await graphRequest(next, { headers: { Prefer: "odata.maxpagesize=100" } });
    const applied = M365_SYNC.applyDelta(workingEvents, data?.value || [], { initial });
    workingEvents = applied.events;
    combineSyncSummary(summary, applied.summary);
    if (data?.["@odata.nextLink"]) {
      next = data["@odata.nextLink"];
      continue;
    }
    deltaLink = data?.["@odata.deltaLink"] || "";
    next = "";
  }

  if (!deltaLink) throw new Error(t("errorNoDeltaLink"));
  if (initial) {
    summary.loaded = workingEvents.length;
    summary.added = 0;
    summary.updated = 0;
    summary.removed = 0;
  }
  const hydrated = await hydrateEventDetails(calendarId, workingEvents);
  summary.hydrated = hydrated.hydrated;
  summary.unresolved = hydrated.unresolved;
  return { events: M365_SYNC.sortEvents(hydrated.events), deltaLink, pages, summary, initial };
}

async function executeFullCalendarView({ calendarId, start, end, previousEvents = [] }) {
  let next = fullCalendarViewPath(calendarId, start, end);
  let events = [];
  let pages = 0;
  while (next) {
    pages += 1;
    if (pages > 60) throw new Error(t("errorTooManyDeltaPages"));
    const data = await graphRequest(next);
    events.push(...(data?.value || []));
    next = data?.["@odata.nextLink"] || "";
  }
  const hydrated = await hydrateEventDetails(calendarId, events);
  const diff = M365_SYNC.diffSnapshots(previousEvents, hydrated.events);
  diff.summary.hydrated = hydrated.hydrated;
  diff.summary.unresolved = hydrated.unresolved;
  diff.summary.missingSubjects = hydrated.events.filter(event => !String(event?.subject || "").trim()).length;
  return { events: diff.events, summary: diff.summary, pages, initial: true, deltaLink: "", supportsDelta: false };
}

async function getEvents({ calendarId, start, end, forceFull = false }) {
  if (!calendarId) throw new Error(t("errorNoCalendarSelected"));
  if (!start || !end) throw new Error(t("errorSyncRangeMissing"));

  const config = await getConfig();
  const accountId = await profileAccountId();
  const key = M365_SYNC.makeWindowKey({ accountId, calendarId, start, end, timeZone: config.timeZone });
  const store = await getSyncStore();
  const oldEntry = store.windows[key] || null;
  const startedAt = Date.now();

  try {
    // V2.04 correctness-first recovery mode: use the regular v1.0
    // calendarView endpoint for every calendar. This endpoint accepts an
    // explicit $select and is used as the reference path while recovering from
    // the V2.01/V2.02 "(no subject)" reports. The V2.04 cache still provides
    // offline display and snapshot diffing; delta can be re-enabled after the
    // live Graph payload has been validated in the field.
    const supportsDelta = false;
    let result = await executeFullCalendarView({
      calendarId,
      start,
      end,
      previousEvents: oldEntry?.events || []
    });

    const now = Date.now();
    const entry = {
      schemaVersion: M365_SYNC.CACHE_SCHEMA_VERSION,
      accountId,
      calendarId,
      start,
      end,
      timeZone: config.timeZone,
      events: result.events,
      deltaLink: result.deltaLink || "",
      supportsDelta: Boolean(result.supportsDelta),
      lastSyncAt: now,
      lastFullSyncAt: result.initial ? now : Number(oldEntry?.lastFullSyncAt || now),
      lastAccessAt: now
    };
    store.windows[key] = entry;
    await saveSyncStore(store);

    return {
      events: result.events,
      sync: {
        source: "network",
        mode: result.supportsDelta ? (result.initial ? "full" : "delta") : "full-secondary",
        supportsDelta: Boolean(result.supportsDelta),
        offline: false,
        stale: false,
        pages: result.pages,
        durationMs: Date.now() - startedAt,
        changes: result.summary,
        lastSyncAt: now,
        lastFullSyncAt: entry.lastFullSyncAt,
        recoveredFromStaleToken: Boolean(result.recoveredFromStaleToken)
      }
    };
  } catch (error) {
    if (canUseOfflineCache(error) && (oldEntry?.events?.length || Array.isArray(oldEntry?.events))) {
      oldEntry.lastAccessAt = Date.now();
      store.windows[key] = oldEntry;
      await saveSyncStore(store);
      return {
        events: M365_SYNC.sortEvents(oldEntry.events || []),
        sync: {
          source: "cache",
          mode: "cache",
          supportsDelta: Boolean(oldEntry.supportsDelta),
          offline: true,
          stale: true,
          pages: 0,
          durationMs: Date.now() - startedAt,
          changes: { added: 0, updated: 0, removed: 0, unchanged: 0, loaded: oldEntry.events?.length || 0 },
          lastSyncAt: Number(oldEntry.lastSyncAt || 0),
          lastFullSyncAt: Number(oldEntry.lastFullSyncAt || 0),
          error: error?.message || String(error)
        }
      };
    }
    throw error;
  }
}

async function respondEvent({ eventId, response, comment = "", sendResponse = true }) {
  const allowed = new Set(["accept", "tentativelyAccept", "decline"]);
  if (!allowed.has(response)) throw new Error(t("errorInvalidResponse"));
  if (!eventId) throw new Error(t("errorEventIdMissing"));
  const body = { sendResponse: Boolean(sendResponse) };
  if (comment && sendResponse) body.comment = String(comment);
  await graphRequest(`/me/events/${encodeId(eventId)}/${response}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  return { ok: true };
}


function decodeVCardValue(value = "") {
  return String(value)
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function contactSuggestionData(node) {
  const properties = node?.properties || {};
  let displayName = String(properties.DisplayName || "").trim();
  if (!displayName) {
    displayName = [properties.FirstName, properties.LastName].map(v => String(v || "").trim()).filter(Boolean).join(" ");
  }
  const emails = [properties.PrimaryEmail, properties.SecondEmail]
    .map(v => String(v || "").trim())
    .filter(Boolean);

  const rawVCard = String(node?.vCard || properties.vCard || "");
  if (rawVCard) {
    const unfolded = rawVCard.replace(/\r?\n[ \t]/g, "");
    for (const line of unfolded.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const key = line.slice(0, separator).toUpperCase();
      const value = decodeVCardValue(line.slice(separator + 1));
      if (!value) continue;
      if (!displayName && (key === "FN" || key.startsWith("FN;"))) displayName = value;
      if (key === "EMAIL" || key.startsWith("EMAIL;")) emails.push(value.replace(/^mailto:/i, ""));
    }
  }

  const unique = [];
  const seen = new Set();
  for (const email of emails) {
    const clean = String(email || "").trim();
    if (!clean || !clean.includes("@")) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }
  return unique.map(email => ({
    id: String(node?.id || ""),
    name: displayName,
    email,
    remote: Boolean(node?.remote),
    readOnly: Boolean(node?.readOnly)
  }));
}

async function searchContacts(query) {
  const text = String(query || "").trim();
  if (text.length < 2) return [];

  const queryInfo = {
    searchString: text,
    includeLocal: true,
    includeRemote: true,
    includeReadOnly: true,
    includeReadWrite: true
  };
  const nodes = [];
  const nodeIds = new Set();
  const errors = [];
  const addNodes = values => {
    for (const node of values || []) {
      const key = String(node?.id || `${node?.parentId || ""}:${node?.properties?.PrimaryEmail || node?.vCard || ""}`);
      if (key && nodeIds.has(key)) continue;
      if (key) nodeIds.add(key);
      nodes.push(node);
    }
  };

  // Thunderbird MV2 defines quickSearch([parentId], queryInfo). V2.17 passed
  // QueryInfo as the first positional argument, which can be interpreted as
  // parentId on some Thunderbird builds and therefore yield no suggestions.
  // Use the explicit two-position signature first and retain compatibility
  // fallbacks for older builds.
  if (browser.contacts?.quickSearch) {
    try {
      addNodes(await browser.contacts.quickSearch(undefined, queryInfo));
    } catch (error) {
      errors.push(error);
      try {
        addNodes(await browser.contacts.quickSearch(text));
      } catch (fallbackError) {
        errors.push(fallbackError);
      }
    }
  }

  // Local fallback: enumerate complete address books. This also protects the
  // autocomplete against API/signature differences and ensures that normal
  // local address books work even if quickSearch is unavailable.
  if (!nodes.length && browser.addressBooks?.list) {
    try {
      const books = await browser.addressBooks.list(true);
      for (const book of books || []) {
        if (Array.isArray(book?.contacts)) {
          addNodes(book.contacts);
          continue;
        }
        if (book?.id && browser.contacts?.list) {
          try { addNodes(await browser.contacts.list(book.id)); }
          catch (error) { errors.push(error); }
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }

  const needleParts = text.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];
  const seen = new Set();
  for (const node of nodes) {
    for (const item of contactSuggestionData(node)) {
      const searchable = `${item.name || ""} ${item.email || ""}`.toLowerCase();
      if (needleParts.length && !needleParts.every(part => searchable.includes(part))) continue;
      const key = item.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= 12) return results;
    }
  }

  if (!results.length && errors.length && !nodes.length) {
    console.warn("M365 address-book autocomplete search failed", errors[0]);
  }
  return results;
}

function cleanAttendees(attendees) {
  const seen = new Set();
  return (attendees || [])
    .map(v => String(v).trim())
    .filter(v => v && v.includes("@"))
    .filter(v => {
      const key = v.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(address => ({ emailAddress: { address }, type: "required" }));
}

function cleanCategories(categories) {
  const seen = new Set();
  return (categories || []).map(v => String(v).trim()).filter(Boolean).filter(v => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 25);
}

function normalizeShowAs(value) {
  const allowed = new Set(["free", "tentative", "busy", "oof", "workingElsewhere"]);
  return allowed.has(value) ? value : "busy";
}

function normalizeSensitivity(value) {
  const allowed = new Set(["normal", "personal", "private", "confidential"]);
  return allowed.has(value) ? value : "normal";
}

function buildGraphEventPayload(payload, { includeOnlineMeeting = false } = {}) {
  if (!payload.subject?.trim()) throw new Error(t("errorSubjectMissing"));
  if (!payload.start || !payload.end) throw new Error(t("errorStartEndRequired"));
  if (new Date(payload.end) <= new Date(payload.start)) throw new Error(t("errorEndAfterStart"));
  const event = {
    subject: payload.subject.trim(),
    start: { dateTime: payload.start, timeZone: payload.timeZone || "W. Europe Standard Time" },
    end: { dateTime: payload.end, timeZone: payload.timeZone || "W. Europe Standard Time" },
    isAllDay: Boolean(payload.allDay),
    attendees: cleanAttendees(payload.attendees),
    body: { contentType: "text", content: String(payload.body || "") },
    location: { displayName: String(payload.location || "") },
    categories: cleanCategories(payload.categories),
    showAs: normalizeShowAs(String(payload.showAs || "busy")),
    sensitivity: normalizeSensitivity(String(payload.sensitivity || "normal")),
    isReminderOn: payload.reminderMinutes !== null && payload.reminderMinutes !== undefined && String(payload.reminderMinutes) !== "",
    reminderMinutesBeforeStart: Math.max(0, Math.min(40320, Math.round(Number(payload.reminderMinutes) || 0))),
    allowNewTimeProposals: true
  };
  if (!event.isReminderOn) delete event.reminderMinutesBeforeStart;
  if (payload.recurrence?.pattern && payload.recurrence?.range) event.recurrence = payload.recurrence;
  if (includeOnlineMeeting && payload.teams) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }
  return event;
}

async function createEvent(payload) {
  if (!payload.calendarId) throw new Error(t("errorNoCalendarSelected"));
  const config = await getConfig();
  const event = buildGraphEventPayload({ ...payload, timeZone: config.timeZone }, { includeOnlineMeeting: true });
  const created = await graphRequest(`/me/calendars/${encodeId(payload.calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event)
  });
  await clearSyncCache({ calendarId: payload.calendarId });
  return created;
}

async function updateEvent(payload) {
  if (!payload.eventId) throw new Error(t("errorEventIdMissing"));
  const config = await getConfig();
  const patch = buildGraphEventPayload({ ...payload, timeZone: config.timeZone }, { includeOnlineMeeting: false });
  // Graph does not accept attendees when an attendee edits an organizer-owned meeting.
  if (payload.includeAttendees === false) delete patch.attendees;
  if (payload.includeRecurrence === false) delete patch.recurrence;
  const eventPath = payload.calendarId
    ? `/me/calendars/${encodeId(payload.calendarId)}/events/${encodeId(payload.eventId)}`
    : `/me/events/${encodeId(payload.eventId)}`;
  const updated = await graphRequest(eventPath, {
    method: "PATCH",
    headers: nativeGraphHeaders(),
    body: JSON.stringify(patch)
  });
  await clearSyncCache({ calendarId: payload.calendarId || "" });
  return updated?.id ? getGraphEventForNative(updated.id, payload.calendarId || "") : updated;
}

async function deleteEvent({ eventId, calendarId = "" }) {
  if (!eventId) throw new Error(t("errorEventIdMissing"));
  const eventPath = calendarId
    ? `/me/calendars/${encodeId(calendarId)}/events/${encodeId(eventId)}`
    : `/me/events/${encodeId(eventId)}`;
  await graphRequest(eventPath, { method: "DELETE" });
  if (calendarId) await clearSyncCache({ calendarId });
  return { ok: true };
}

async function getSchedule({ schedules = [], start, end, interval = 30 } = {}) {
  const clean = [...new Set((schedules || []).map(v => String(v).trim().toLowerCase()).filter(v => v.includes("@")))].slice(0, 20);
  if (!clean.length) throw new Error(t("errorScheduleAddressesMissing"));
  if (!start || !end || new Date(end) <= new Date(start)) throw new Error(t("errorScheduleRange"));
  const config = await getConfig();
  const minutes = Math.max(5, Math.min(1440, Math.round(Number(interval) || 30)));
  const body = {
    schedules: clean,
    startTime: { dateTime: start, timeZone: config.timeZone },
    endTime: { dateTime: end, timeZone: config.timeZone },
    availabilityViewInterval: minutes
  };
  const data = await graphRequest("/me/calendar/getSchedule", {
    method: "POST",
    headers: { Prefer: `outlook.timezone="${config.timeZone}"` },
    body: JSON.stringify(body)
  });
  return { value: data?.value || [], interval: minutes };
}

function nativeGraphHeaders() {
  return { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text", odata.maxpagesize=250' };
}

async function storedProfile() {
  const stored = await browser.storage.local.get("profile");
  return stored.profile || null;
}

function profileMail(profile) {
  return String(profile?.mail || profile?.userPrincipalName || "").trim().toLowerCase();
}

async function nativeSyncRange() {
  const config = await getConfig();
  return M365_NATIVE.stableRange(new Date(), config.nativeDaysBefore, config.nativeDaysAfter);
}

async function listNativeGraphEvents(calendarId) {
  if (!calendarId) throw new Error(t("nativeErrorCalendarIdMissing"));
  const range = await nativeSyncRange();
  let next = fullCalendarViewPath(calendarId, range.start, range.end);
  const events = [];
  let pages = 0;
  while (next) {
    pages += 1;
    if (pages > 100) throw new Error(t("errorTooManyDeltaPages"));
    const data = await graphRequest(next, { headers: nativeGraphHeaders() });
    events.push(...(data?.value || []));
    next = data?.["@odata.nextLink"] || "";
  }
  const hydrated = await hydrateEventDetails(calendarId, events);
  hydrated.events.sort((a, b) => new Date(a?.start?.dateTime || 0) - new Date(b?.start?.dateTime || 0));
  return { events: hydrated.events, range, pages, hydrated: hydrated.hydrated, unresolved: hydrated.unresolved };
}

async function getGraphEventForNative(eventId, calendarId = "") {
  if (!eventId) throw new Error(t("errorEventIdMissing"));
  const base = calendarId
    ? `/me/calendars/${encodeId(calendarId)}/events/${encodeId(eventId)}`
    : `/me/events/${encodeId(eventId)}`;
  return graphRequest(
    `${base}?$select=${encodeURIComponent(SYNC_EVENT_SELECT)}`,
    { headers: nativeGraphHeaders() }
  );
}

async function invalidateAfterNativeWrite(calendarId) {
  if (calendarId) await clearSyncCache({ calendarId });
}

async function nativeStatus() {
  const config = await getConfig();
  const status = await authStatus();
  const api = await probeNativeApi({ retry: true });

  if (!api) {
    return {
      packageNative: Boolean(status.nativeMode),
      available: false,
      probed: Boolean(nativeBridgeState.probed),
      bridgeError: String(nativeBridgeState.error || ""),
      enabled: Boolean(config.nativeIntegration),
      loggedIn: Boolean(status.loggedIn),
      calendars: [],
      diagnostics: {
        experimentLoaded: false,
        providerModuleLoaded: false,
        providerLoadError: String(nativeBridgeState.error || ""),
        registeredCalendarCount: 0
      },
      daysBefore: config.nativeDaysBefore,
      daysAfter: config.nativeDaysAfter
    };
  }

  // V2.16: Loading the Experiment/provider is only the first stage. If native
  // integration is enabled and the account is authenticated, opening the native
  // settings now also repairs/creates the actual Thunderbird calendars. This
  // avoids the confusing permanent state "API loaded, 0 calendars".
  let autoEnsure = { attempted: false, ok: false, graphCalendarCount: 0, registeredCount: 0, error: "" };
  if (config.nativeIntegration && status.loggedIn) {
    autoEnsure.attempted = true;
    try {
      const ensured = await ensureNativeCalendars({ synchronize: false });
      autoEnsure.ok = true;
      autoEnsure.graphCalendarCount = Number(ensured.graphCalendarCount || 0);
      autoEnsure.registeredCount = Array.isArray(ensured.calendars) ? ensured.calendars.length : 0;
    } catch (error) {
      autoEnsure.error = error?.message || String(error);
      console.error("M365 native automatic calendar registration failed", error);
    }
  }

  let calendars = [];
  let diagnostics = null;
  try {
    calendars = await api.status();
  } catch (error) {
    diagnostics = { providerLoadError: error?.message || String(error) };
  }
  try {
    diagnostics = await api.diagnostics();
  } catch (error) {
    diagnostics = {
      ...(diagnostics || {}),
      experimentLoaded: true,
      providerModuleLoaded: false,
      providerLoadError: error?.message || String(error)
    };
  }
  return {
    packageNative: Boolean(status.nativeMode),
    available: true,
    probed: true,
    bridgeError: "",
    enabled: Boolean(config.nativeIntegration),
    loggedIn: Boolean(status.loggedIn),
    calendars: Array.isArray(calendars) ? calendars : [],
    diagnostics,
    autoEnsure,
    daysBefore: config.nativeDaysBefore,
    daysAfter: config.nativeDaysAfter
  };
}

async function ensureNativeCalendars({ synchronize = false } = {}) {
  const api = await probeNativeApi({ retry: true });
  if (!api?.ensureCalendars) {
    return {
      available: false,
      enabled: false,
      calendars: [],
      bridgeError: String(nativeBridgeState.error || "")
    };
  }
  const config = await getConfig();
  const status = await authStatus();
  if (!config.nativeIntegration || !status.loggedIn) {
    try { await api.removeAll(); } catch (_) {}
    return { available: true, enabled: false, calendars: [] };
  }

  const [calendarResult, profile] = await Promise.all([listCalendarsCached(), storedProfile()]);
  const accountId = String(profile?.id || profile?.userPrincipalName || "");
  const organizerId = profileMail(profile);
  const organizerName = String(profile?.displayName || "");
  const descriptors = (calendarResult.calendars || []).map(calendar => ({
    graphCalendarId: String(calendar.id),
    accountId,
    name: `M365 · ${calendar.name || t("calendarFallback")}${calendar.isShared ? ` · ${t("sharedShort")}` : ""}`,
    color: M365_NATIVE.graphColorToHex(calendar.color),
    readOnly: !Boolean(calendar.canEdit),
    visible: true,
    enabled: true,
    organizerId,
    organizerName
  }));

  const calendars = await api.ensureCalendars(descriptors);
  if (synchronize) await api.synchronize();
  return {
    available: true,
    enabled: true,
    calendars,
    graphCalendarCount: descriptors.length,
    offlineCalendarList: Boolean(calendarResult.offline)
  };
}

async function syncNativeCalendars() {
  const ensured = await ensureNativeCalendars({ synchronize: false });
  if (!ensured.enabled) return { ...ensured, synchronized: 0 };
  const api = nativeApiIfLoaded() || await probeNativeApi({ retry: true });
  if (!api) return { ...ensured, synchronized: 0, bridgeError: String(nativeBridgeState.error || "") };
  const synchronized = await api.synchronize();
  return { ...ensured, synchronized };
}

async function nativeSyncHandler(calendar) {
  const config = await getConfig();
  if (!config.nativeIntegration) throw new Error(t("nativeErrorDisabled"));
  const status = await authStatus();
  if (!status.loggedIn) throw new Error(t("errorNotSignedIn"));
  const result = await listNativeGraphEvents(calendar?.graphCalendarId);
  return {
    events: result.events.map(M365_NATIVE.graphEventToNative),
    message: t("nativeSyncResult", [String(result.events.length), String(result.pages)])
  };
}

async function nativeCreateHandler(calendar, item) {
  if (!calendar?.graphCalendarId) throw new Error(t("nativeErrorCalendarIdMissing"));
  const payload = M365_NATIVE.nativeItemToGraphPayload(item);
  const created = await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events`, {
    method: "POST",
    headers: nativeGraphHeaders(),
    body: JSON.stringify(payload)
  });
  await invalidateAfterNativeWrite(calendar.graphCalendarId);
  const complete = created?.id ? await getGraphEventForNative(created.id, calendar.graphCalendarId) : created;
  return M365_NATIVE.graphEventToNative(complete);
}

async function nativeUpdateHandler(calendar, item, oldItem, options = {}) {
  if (!item?.id) throw new Error(t("errorEventIdMissing"));
  const me = String(calendar?.organizerId || "").trim().toLowerCase();
  const organizer = String(item?.organizer?.address || oldItem?.organizer?.address || "").trim().toLowerCase();
  const isOrganizer = Boolean(me && organizer && me === organizer);

  if (!isOrganizer && organizer) {
    const action = M365_NATIVE.responseChangeForUser(item, oldItem, me);
    if (action) {
      await respondEvent({
        eventId: item.id,
        response: action,
        comment: "",
        sendResponse: true
      });
    }

    // An attendee may safely change their own reminder. Other meeting fields
    // remain server-controlled by the organizer.
    const oldReminder = oldItem?.reminderMinutes;
    const newReminder = item?.reminderMinutes;
    if (oldReminder !== newReminder) {
      await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events/${encodeId(item.id)}`, {
        method: "PATCH",
        headers: nativeGraphHeaders(),
        body: JSON.stringify({
          isReminderOn: newReminder != null,
          reminderMinutesBeforeStart: newReminder != null ? Math.max(0, Math.round(Number(newReminder) || 0)) : 15
        })
      });
    }
  } else {
    const payload = M365_NATIVE.nativeItemToGraphPayload(item);
    await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events/${encodeId(item.id)}`, {
      method: "PATCH",
      headers: nativeGraphHeaders(),
      body: JSON.stringify(payload)
    });
  }

  await invalidateAfterNativeWrite(calendar?.graphCalendarId || "");
  const updated = await getGraphEventForNative(item.id, calendar?.graphCalendarId || "");
  return M365_NATIVE.graphEventToNative(updated);
}

async function nativeRemoveHandler(calendar, item, options = {}) {
  if (!item?.id) throw new Error(t("errorEventIdMissing"));
  await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events/${encodeId(item.id)}`, { method: "DELETE" });
  await invalidateAfterNativeWrite(calendar?.graphCalendarId || "");
  return true;
}

async function refreshNativeAfterExternalWrite() {
  try {
    const config = await getConfig();
    const api = nativeApiIfLoaded();
    if (config.nativeIntegration && api?.synchronize) {
      await api.synchronize();
    }
  } catch (error) {
    console.warn("M365 native refresh after external write failed", error);
  }
}

async function initializeNativeCalendars() {
  try {
    const status = await authStatus();
    if (status.loggedIn) await ensureNativeCalendars({ synchronize: true });
    else {
      const api = nativeApiIfLoaded();
      if (api?.removeAll) await api.removeAll();
    }
  } catch (error) {
    console.error("M365 native calendar initialization failed", error);
  }
}


const INVITE_EVENT_SELECT = "id,subject,start,end,location,organizer,attendees,responseStatus,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,webLink,isOrganizer,type,showAs,sensitivity,body,bodyPreview,isCancelled,isAllDay,iCalUId,uid";

function firstHeaderValue(headers, name) {
  if (!headers) return "";
  const values = headers[String(name).toLowerCase()] || headers[String(name)] || [];
  return Array.isArray(values) ? String(values[0] || "") : String(values || "");
}

function findCalendarPart(part) {
  if (!part) return null;
  const contentType = String(part.contentType || firstHeaderValue(part.headers, "content-type") || "").toLowerCase();
  if (contentType.includes("text/calendar") && typeof part.body === "string" && part.body.trim()) {
    return part.body;
  }
  for (const child of part.parts || []) {
    const found = findCalendarPart(child);
    if (found) return found;
  }
  return null;
}

async function extractInvitationFromMessage(messageId) {
  if (!messageId) throw new Error(t("inviteErrorNoMessage"));
  const full = await browser.messages.getFull(messageId);
  let icsText = findCalendarPart(full);

  if (!icsText) {
    const attachments = await browser.messages.listAttachments(messageId);
    const candidate = attachments.find(att => {
      const name = String(att.name || "").toLowerCase();
      const type = String(att.contentType || "").toLowerCase();
      return type.includes("calendar") || name.endsWith(".ics") || name.endsWith(".ical");
    });
    if (candidate?.partName) {
      const file = await browser.messages.getAttachmentFile(messageId, candidate.partName);
      icsText = await file.text();
    }
  }

  if (!icsText) return null;
  return M365_ICAL.parseInvitation(icsText);
}

function odataQuote(value) {
  return String(value || "").replace(/'/g, "''");
}

function invitationWindow(invitation) {
  const center = invitation?.recurrenceId?.iso || invitation?.start?.iso || "";
  let centerDate = center ? new Date(center) : new Date();
  if (Number.isNaN(centerDate.getTime())) centerDate = new Date();
  const start = new Date(centerDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  const end = new Date(centerDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function sameInvitationUid(event, uid) {
  const wanted = M365_ICAL.normalizeForCompare(uid);
  if (!wanted) return false;
  return [event?.iCalUId, event?.uid]
    .map(M365_ICAL.normalizeForCompare)
    .some(value => value && value === wanted);
}

function graphDateMs(event) {
  const date = new Date(event?.start?.dateTime || "");
  return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function invitationDateMs(invitation) {
  const iso = invitation?.recurrenceId?.iso || invitation?.start?.iso || "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function chooseBestInvitationEvent(events, invitation, strategy) {
  if (!events?.length) return null;
  const uid = invitation?.uid || "";
  const exact = events.find(event => sameInvitationUid(event, uid));
  if (exact) return { event: exact, strategy };

  const subject = M365_ICAL.normalizeForCompare(invitation?.summary);
  const organizer = M365_ICAL.normalizeForCompare(invitation?.organizer?.address);
  const targetTime = invitationDateMs(invitation);
  const scored = events.map(event => {
    let score = 0;
    if (subject && M365_ICAL.normalizeForCompare(event?.subject) === subject) score += 5;
    if (organizer && M365_ICAL.normalizeForCompare(event?.organizer?.emailAddress?.address) === organizer) score += 3;
    const eventTime = graphDateMs(event);
    if (Number.isFinite(targetTime) && Number.isFinite(eventTime)) {
      const diff = Math.abs(targetTime - eventTime);
      if (diff <= 5 * 60 * 1000) score += 5;
      else if (diff <= 60 * 60 * 1000) score += 3;
      else if (diff <= 6 * 60 * 60 * 1000) score += 1;
    }
    return { event, score };
  }).sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 10) return { event: scored[0].event, strategy: `${strategy}-fallback` };
  return null;
}

async function tryFilteredInvitationLookup(property, invitation) {
  if (!invitation?.uid) return null;
  const filter = `${property} eq '${odataQuote(invitation.uid)}'`;
  const query = new URLSearchParams({
    "$filter": filter,
    "$top": "25",
    "$select": INVITE_EVENT_SELECT
  });
  try {
    const data = await graphRequest(`/me/events?${query}`);
    return chooseBestInvitationEvent(data?.value || [], invitation, property);
  } catch (error) {
    // Filtering capabilities differ across Graph event properties/tenants.
    // A calendarView fallback below provides the reliable path.
    console.debug(`Invitation lookup by ${property} failed:`, error?.message || error);
    return null;
  }
}

async function findEventForInvitation(invitation) {
  if (!invitation?.uid && !invitation?.summary) return null;

  // iCalUId is the most direct link when Graph accepts the filter.
  const byIcal = await tryFilteredInvitationLookup("iCalUId", invitation);
  if (byIcal) return byIcal;

  // calendarView is the robust fallback, especially for recurring instances.
  const range = invitationWindow(invitation);
  const viewQuery = new URLSearchParams({
    startDateTime: range.start,
    endDateTime: range.end,
    "$top": "250",
    "$select": INVITE_EVENT_SELECT
  });
  const viewData = await graphRequest(`/me/calendarView?${viewQuery}`);
  const byView = chooseBestInvitationEvent(viewData?.value || [], invitation, "calendarView");
  if (byView) return byView;

  // Newer Graph schemas also expose uid, which is useful for recurring series.
  return tryFilteredInvitationLookup("uid", invitation);
}

function safeInvitation(invitation) {
  if (!invitation) return null;
  return {
    method: invitation.method || "",
    uid: invitation.uid || "",
    summary: invitation.summary || "",
    location: invitation.location || "",
    organizer: invitation.organizer || null,
    attendees: invitation.attendees || [],
    start: invitation.start || null,
    end: invitation.end || null,
    recurrenceId: invitation.recurrenceId || null,
    status: invitation.status || "",
    sequence: Number(invitation.sequence || 0)
  };
}

function safeInviteEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    subject: event.subject || "",
    start: event.start || null,
    end: event.end || null,
    location: event.location || null,
    organizer: event.organizer || null,
    responseStatus: event.responseStatus || null,
    isOnlineMeeting: Boolean(event.isOnlineMeeting),
    onlineMeeting: event.onlineMeeting || null,
    onlineMeetingUrl: event.onlineMeetingUrl || "",
    webLink: event.webLink || "",
    isOrganizer: Boolean(event.isOrganizer),
    isCancelled: Boolean(event.isCancelled),
    isAllDay: Boolean(event.isAllDay),
    iCalUId: event.iCalUId || "",
    uid: event.uid || ""
  };
}

async function analyzeInvitation({ messageId }) {
  const invitation = await extractInvitationFromMessage(messageId);
  const status = await authStatus();
  if (!invitation) {
    return { isInvitation: false, auth: status, invitation: null, event: null, matchStrategy: "" };
  }

  let match = null;
  let lookupError = "";
  if (status.loggedIn) {
    try {
      match = await findEventForInvitation(invitation);
    } catch (error) {
      lookupError = error?.message || String(error);
    }
  }

  const method = String(invitation.method || "REQUEST").toUpperCase();
  const event = match?.event || null;
  const canRespond = method === "REQUEST" && Boolean(event?.id) && !event?.isOrganizer && !event?.isCancelled;
  return {
    isInvitation: true,
    auth: status,
    invitation: safeInvitation(invitation),
    event: safeInviteEvent(event),
    matchStrategy: match?.strategy || "",
    lookupError,
    canRespond
  };
}

async function respondInvitation({ messageId, response, comment = "", sendResponse = true }) {
  const invitation = await extractInvitationFromMessage(messageId);
  if (!invitation) throw new Error(t("inviteErrorNotInvitation"));
  const match = await findEventForInvitation(invitation);
  if (!match?.event?.id) throw new Error(t("inviteErrorNoGraphEvent"));
  if (match.event.isOrganizer) throw new Error(t("inviteErrorOrganizer"));
  if (match.event.isCancelled) throw new Error(t("inviteErrorCancelled"));

  await respondEvent({
    eventId: match.event.id,
    response,
    comment,
    sendResponse
  });

  // Re-read the server object so the popup can show the new Exchange status.
  const updated = await graphRequest(`/me/events/${encodeId(match.event.id)}?$select=${encodeURIComponent(INVITE_EVENT_SELECT)}`);
  return {
    event: safeInviteEvent(updated || match.event),
    matchStrategy: match.strategy
  };
}

async function ensureSpace() {
  if (!browser.spaces?.create) return;
  try {
    const owned = await browser.spaces.query({ isSelfOwned: true });
    const existing = owned.find(space => space.name === "m365_calendar");
    if (existing) {
      spaceId = existing.id;
      return;
    }
    const space = await browser.spaces.create(
      "m365_calendar",
      browser.runtime.getURL("calendar/calendar.html"),
      {
        title: t("spaceTitle"),
        defaultIcons: {
          "16": "icons/m365-16.svg",
          "32": "icons/m365-32.svg"
        }
      }
    );
    spaceId = space.id;
  } catch (error) {
    console.error("Could not create M365 space:", error);
  }
}

browser.runtime.onMessage.addListener(async message => {
  try {
    switch (message?.action) {
      case "getConfig": return { ok: true, data: await getConfig() };
      case "saveConfig": return { ok: true, data: await saveConfig(message.config || {}) };
      case "authStatus": return { ok: true, data: await authStatus() };
      case "login": return { ok: true, data: await login() };
      case "logout": {
        const nativeApi = nativeApiIfLoaded();
        if (nativeApi?.removeAll) await nativeApi.removeAll();
        await clearAuth();
        await clearCachedCalendarData();
        return { ok: true };
      }
      case "nativeStatus": return { ok: true, data: await nativeStatus() };
      case "ensureNativeCalendars": return { ok: true, data: await ensureNativeCalendars({ synchronize: Boolean(message.synchronize) }) };
      case "syncNativeCalendars": return { ok: true, data: await syncNativeCalendars() };
      case "listCalendars": return { ok: true, data: await listCalendars() };
      case "listCalendarsCached": return { ok: true, data: await listCalendarsCached() };
      case "getEvents": return { ok: true, data: await getEvents(message) };
      case "getEvent": return { ok: true, data: await getGraphEventForNative(message.eventId, message.calendarId || "") };
      case "respondEvent": {
        const data = await respondEvent(message);
        await refreshNativeAfterExternalWrite();
        return { ok: true, data };
      }
      case "createEvent": {
        const data = await createEvent(message.payload || {});
        await refreshNativeAfterExternalWrite();
        return { ok: true, data };
      }
      case "updateEvent": {
        const data = await updateEvent(message.payload || {});
        await refreshNativeAfterExternalWrite();
        return { ok: true, data };
      }
      case "deleteEvent": {
        const data = await deleteEvent(message);
        await refreshNativeAfterExternalWrite();
        return { ok: true, data };
      }
      case "searchContacts": return { ok: true, data: await searchContacts(message.query) };
      case "getSchedule": return { ok: true, data: await getSchedule(message) };
      case "syncCacheStats": return { ok: true, data: await syncCacheStats() };
      case "clearSyncCache": return { ok: true, data: await clearSyncCache(message) };
      case "analyzeInvitation": return { ok: true, data: await analyzeInvitation(message) };
      case "respondInvitation": {
        const data = await respondInvitation(message);
        await refreshNativeAfterExternalWrite();
        return { ok: true, data };
      }
      case "openSpace":
        if (spaceId && browser.spaces?.open) await browser.spaces.open(spaceId);
        return { ok: true };
      default: throw new Error(t("errorUnknownAction"));
    }
  } catch (error) {
    console.error("M365 Calendar error", error);
    return { ok: false, error: error?.message || String(error), status: error?.status || 0 };
  }
});

// STANDARD-first startup: create the normal M365 Space and do nothing
// privileged until an explicit native action is requested.
ensureSpace();

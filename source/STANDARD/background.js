"use strict";

const VERSION = "2.0.39";
const CONFIG_SCHEMA_VERSION = 206;
const SYNC_STORE_KEY = "syncCacheV205";
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
  spaceViewMode: "month",
  daysBefore: 14,
  daysAfter: 45,
  autoSyncMinutes: 5,
  nativeIntegration: true,
  nativeDaysBefore: 90,
  nativeDaysAfter: 365,
  contactAddressBookIds: ["*"],
  confirmOutgoingMessages: true,
  configSchemaVersion: CONFIG_SCHEMA_VERSION
};

function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}
const BASE_SCOPES = ["openid", "profile", "offline_access", "User.Read", "Calendars.ReadWrite"];
const SCOPES = [...BASE_SCOPES, "Calendars.ReadWrite.Shared"];
let spaceId = null;


// V2.35 outgoing-message safety gate. Microsoft Graph can send meeting
// invitations, updates, cancellations and RSVP messages as a side effect of
// calendar writes. Keep that transmission behind one central confirmation
// dialog so Space, invitation-popup and native-calendar paths behave alike.
const pendingOutgoingConfirmations = new Map();

function outgoingEmailAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function outgoingRecipients(attendees = []) {
  const seen = new Set();
  const result = [];
  for (const attendee of attendees || []) {
    const address = outgoingEmailAddress(attendee?.emailAddress?.address || attendee?.address || attendee);
    if (!address || !address.includes("@") || seen.has(address)) continue;
    seen.add(address);
    result.push(address);
  }
  return result;
}

function outgoingActionLabel(kind) {
  const keys = {
    meetingInvite: "outgoingActionMeetingInvite",
    meetingUpdate: "outgoingActionMeetingUpdate",
    meetingCancellation: "outgoingActionMeetingCancellation",
    rsvpAccept: "outgoingActionRsvpAccept",
    rsvpTentative: "outgoingActionRsvpTentative",
    rsvpDecline: "outgoingActionRsvpDecline"
  };
  return t(keys[kind] || "outgoingActionGeneric");
}

function outgoingResponseKind(response) {
  if (response === "accept") return "rsvpAccept";
  if (response === "tentativelyAccept") return "rsvpTentative";
  if (response === "decline") return "rsvpDecline";
  return "generic";
}

function resolveOutgoingConfirmation(token, approved) {
  const key = String(token || "");
  const pending = pendingOutgoingConfirmations.get(key);
  if (!pending) return false;
  pendingOutgoingConfirmations.delete(key);
  pending.resolve(Boolean(approved));
  return true;
}

function outgoingConfirmationDetails(token) {
  return pendingOutgoingConfirmations.get(String(token || ""))?.details || null;
}

if (browser.windows?.onRemoved) {
  browser.windows.onRemoved.addListener(windowId => {
    for (const [token, pending] of [...pendingOutgoingConfirmations.entries()]) {
      if (pending.windowId === windowId) resolveOutgoingConfirmation(token, false);
    }
  });
}

async function requestOutgoingConfirmation({ kind = "generic", subject = "", recipients = [], note = "" } = {}) {
  const config = await getConfig();
  if (!config.confirmOutgoingMessages) return true;

  const cleanRecipients = [...new Set((recipients || []).map(outgoingEmailAddress).filter(Boolean))];
  const token = (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const details = {
    action: outgoingActionLabel(kind),
    subject: String(subject || "").trim() || t("outgoingNoSubject"),
    recipients: cleanRecipients,
    note: String(note || "").trim() || t("outgoingConfirmAutomaticNote")
  };

  let settle;
  const answer = new Promise(resolve => { settle = resolve; });
  pendingOutgoingConfirmations.set(token, { details, resolve: settle, windowId: null });

  try {
    if (!browser.windows?.create) throw new Error("windows.create unavailable");
    const url = browser.runtime.getURL(`confirm/confirm.html?token=${encodeURIComponent(token)}`);
    const win = await browser.windows.create({ url, type: "popup", width: 620, height: 500 });
    const pending = pendingOutgoingConfirmations.get(token);
    if (pending) {
      pending.windowId = win?.id ?? null;
      if (pending.windowId == null) throw new Error("confirmation window has no id");
    }
    const approved = await answer;
    if (!approved) {
      const error = new Error(t("outgoingConfirmationCancelled"));
      error.userCancelled = true;
      throw error;
    }
    return true;
  } catch (error) {
    if (pendingOutgoingConfirmations.has(token)) pendingOutgoingConfirmations.delete(token);
    if (error?.userCancelled) throw error;
    const wrapped = new Error(t("outgoingConfirmationUnavailable", error?.message || String(error)));
    wrapped.cause = error;
    throw wrapped;
  }
}

// The native Experiment bridge remains failure-isolated from the STANDARD
// Graph/UI path. V2.24 performs a delayed provider activation after background
// startup (rather than synchronously during script evaluation), then the normal
// native auto-sync follows. This restores persisted provider calendars early
// without letting a provider failure break the Microsoft 365 Space.
const NATIVE_PACKAGE = BUILD_DEFAULTS.nativeMode !== false;
const nativeBridgeState = {
  probed: false,
  available: false,
  error: "",
  api: null,
  listenersBound: false
};

// V2.24 read-after-write guard. Microsoft Graph event POST/PATCH/DELETE can be
// immediately followed by calendarView reads from both the WebExtension sync
// and Thunderbird's provider replay. If that view is briefly behind the direct
// event endpoint, a just-created item could otherwise be removed again from
// the native cache. Keep the direct write result authoritative until
// calendarView confirms the same changeKey (or the deletion disappears).
const NATIVE_WRITE_GUARD_TTL_MS = 120000;
const recentNativeWriteGuards = new Map();

function nativeWriteGuardBucket(calendarId, create = false) {
  const key = String(calendarId || "");
  if (!key) return null;
  let bucket = recentNativeWriteGuards.get(key) || null;
  if (!bucket && create) {
    bucket = new Map();
    recentNativeWriteGuards.set(key, bucket);
  }
  return bucket;
}

function rememberNativeUpsert(calendarId, event) {
  const id = String(event?.id || "");
  const bucket = nativeWriteGuardBucket(calendarId, true);
  if (!bucket || !id) return;
  bucket.set(id, {
    kind: "upsert",
    event,
    expiresAt: Date.now() + NATIVE_WRITE_GUARD_TTL_MS
  });
}

function rememberNativeDelete(calendarId, eventId) {
  const id = String(eventId || "");
  const bucket = nativeWriteGuardBucket(calendarId, true);
  if (!bucket || !id) return;
  bucket.set(id, {
    kind: "delete",
    event: null,
    expiresAt: Date.now() + NATIVE_WRITE_GUARD_TTL_MS
  });
}

function applyRecentNativeWriteGuards(calendarId, events) {
  const bucket = nativeWriteGuardBucket(calendarId, false);
  if (!bucket?.size) return { events: [...(events || [])], protectedUpserts: 0, protectedDeletes: 0, remaining: 0 };

  const now = Date.now();
  const byId = new Map((events || []).filter(event => event?.id).map(event => [String(event.id), event]));
  let protectedUpserts = 0;
  let protectedDeletes = 0;

  for (const [id, guard] of [...bucket.entries()]) {
    if (!guard || Number(guard.expiresAt || 0) <= now) {
      bucket.delete(id);
      continue;
    }
    const serverEvent = byId.get(id) || null;
    if (guard.kind === "delete") {
      if (!serverEvent) {
        // calendarView has caught up with the deletion.
        bucket.delete(id);
      } else {
        // Ignore a stale calendarView row for a deletion we already confirmed.
        byId.delete(id);
        protectedDeletes += 1;
      }
      continue;
    }

    const guardedEvent = guard.event || null;
    if (!guardedEvent) {
      bucket.delete(id);
      continue;
    }
    const guardedChangeKey = String(guardedEvent?.changeKey || "");
    const serverChangeKey = String(serverEvent?.changeKey || "");
    const guardedModified = String(guardedEvent?.lastModifiedDateTime || "");
    const serverModified = String(serverEvent?.lastModifiedDateTime || "");
    const guardedModifiedMs = guardedModified ? Date.parse(guardedModified) : NaN;
    const serverModifiedMs = serverModified ? Date.parse(serverModified) : NaN;
    const confirmed = Boolean(serverEvent) && (
      (guardedChangeKey && serverChangeKey && guardedChangeKey === serverChangeKey) ||
      (Number.isFinite(guardedModifiedMs) && Number.isFinite(serverModifiedMs) && serverModifiedMs >= guardedModifiedMs)
    );
    if (confirmed) {
      bucket.delete(id);
      continue;
    }

    // The direct event endpoint is newer than the current calendarView snapshot.
    byId.set(id, guardedEvent);
    protectedUpserts += 1;
  }

  if (!bucket.size) recentNativeWriteGuards.delete(String(calendarId || ""));
  return {
    events: [...byId.values()],
    protectedUpserts,
    protectedDeletes,
    remaining: bucket.size
  };
}


// V2.16: Native calendar synchronization is automatic.  The timer is
// deliberately delayed so Thunderbird's calendar service can finish startup.
// All failures remain isolated from the normal STANDARD/Graph UI.
const nativeAutoSyncState = {
  timer: null,
  running: false,
  queuedReason: "",
  scheduledAt: "",
  lastReason: "",
  lastStartedAt: "",
  lastFinishedAt: "",
  lastError: "",
  lastSynchronized: 0
};

function scheduleNativeAutoSync(reason = "automatic", delayMs = 2500) {
  if (!NATIVE_PACKAGE) return;
  nativeAutoSyncState.queuedReason = String(reason || "automatic");
  nativeAutoSyncState.scheduledAt = new Date().toISOString();
  // If a sync is already running, keep exactly one follow-up request.
  if (nativeAutoSyncState.running) return;
  if (nativeAutoSyncState.timer) clearTimeout(nativeAutoSyncState.timer);
  nativeAutoSyncState.timer = setTimeout(() => {
    nativeAutoSyncState.timer = null;
    const queuedReason = nativeAutoSyncState.queuedReason || "automatic";
    nativeAutoSyncState.queuedReason = "";
    runNativeAutoSync(queuedReason).catch(error => {
      console.error("M365 automatic native calendar synchronization failed", error);
    });
  }, Math.max(0, Number(delayMs) || 0));
}

async function runNativeAutoSync(reason = "automatic") {
  if (!NATIVE_PACKAGE) return { skipped: "standard-build" };
  if (nativeAutoSyncState.running) {
    nativeAutoSyncState.queuedReason = String(reason || "automatic");
    return { skipped: "already-running" };
  }

  nativeAutoSyncState.running = true;
  nativeAutoSyncState.lastReason = String(reason || "automatic");
  nativeAutoSyncState.lastStartedAt = new Date().toISOString();
  nativeAutoSyncState.lastFinishedAt = "";
  nativeAutoSyncState.lastError = "";
  try {
    const config = await getConfig();
    if (!config.nativeIntegration) return { skipped: "native-disabled" };

    // V2.24: activate the Thunderbird provider independently of Microsoft
    // authentication. Persisted native calendars are loaded by Thunderbird
    // before this WebExtension runs and temporarily become dummy calendars if
    // our dynamic provider is not registered yet. Registering it here swaps
    // those dummies back to the real provider without deleting their registry
    // preferences (colour, visibility, disabled state, mail identity, ...).
    const nativeApi = await probeNativeApi({ retry: true });
    if (nativeApi?.activate) {
      await nativeApi.activate();
    }

    const status = await authStatus();
    if (!status.loggedIn) return { skipped: "not-signed-in-provider-active" };
    const result = await syncNativeCalendars();
    nativeAutoSyncState.lastSynchronized = Number(result?.synchronized || 0);
    return result;
  } catch (error) {
    nativeAutoSyncState.lastError = error?.message || String(error);
    throw error;
  } finally {
    nativeAutoSyncState.running = false;
    nativeAutoSyncState.lastFinishedAt = new Date().toISOString();
    if (nativeAutoSyncState.queuedReason) {
      const followUpReason = nativeAutoSyncState.queuedReason;
      nativeAutoSyncState.queuedReason = "";
      scheduleNativeAutoSync(followUpReason, 750);
    }
  }
}

function nativeApiIfLoaded() {
  return nativeBridgeState.available ? nativeBridgeState.api : null;
}

let nativeProviderStartupTimer = null;
const nativeProviderStartupState = {
  scheduled: false,
  attempted: false,
  activated: false,
  lastReason: "",
  lastError: ""
};

function scheduleNativeProviderActivation(reason = "background-start", delayMs = 1200) {
  if (!NATIVE_PACKAGE) return;
  nativeProviderStartupState.scheduled = true;
  nativeProviderStartupState.lastReason = String(reason || "background-start");
  if (nativeProviderStartupTimer) clearTimeout(nativeProviderStartupTimer);
  nativeProviderStartupTimer = setTimeout(async () => {
    nativeProviderStartupTimer = null;
    nativeProviderStartupState.scheduled = false;
    nativeProviderStartupState.attempted = true;
    nativeProviderStartupState.lastError = "";
    try {
      const config = await getConfig();
      if (!config.nativeIntegration) return;
      const api = await probeNativeApi({ retry: true });
      if (!api?.activate) throw new Error("nativeCalendar.activate unavailable");
      await api.activate();
      nativeProviderStartupState.activated = true;
    } catch (error) {
      nativeProviderStartupState.activated = false;
      nativeProviderStartupState.lastError = error?.message || String(error);
      console.warn("M365 native provider startup activation failed", error);
    }
  }, Math.max(0, Number(delayMs) || 0));
}

function bindNativeBridgeEvents(api) {
  if (!api || nativeBridgeState.listenersBound) return;
  api.onSync.addListener(nativeSyncHandler);
  api.onItemCreated.addListener(nativeCreateHandler);
  api.onItemUpdated.addListener(nativeUpdateHandler);
  api.onItemRemoved.addListener(nativeRemoveHandler);
  if (api.onTeamsMeetingRequested?.addListener) {
    api.onTeamsMeetingRequested.addListener(openNativeTeamsMeetingPopup);
  }
  if (api.onEventEditRequested?.addListener) {
    api.onEventEditRequested.addListener(openNativeTeamsMeetingPopup);
  }
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
  clean.spaceViewMode = ["month", "week", "day", "agenda"].includes(String(clean.spaceViewMode || "")) ? String(clean.spaceViewMode) : "month";
  clean.daysBefore = Math.max(0, Math.min(365, Number(clean.daysBefore) || DEFAULT_CONFIG.daysBefore));
  clean.daysAfter = Math.max(1, Math.min(365, Number(clean.daysAfter) || DEFAULT_CONFIG.daysAfter));
  const autoSync = Number(clean.autoSyncMinutes);
  clean.autoSyncMinutes = Number.isFinite(autoSync) ? Math.max(0, Math.min(60, autoSync)) : DEFAULT_CONFIG.autoSyncMinutes;
  clean.nativeIntegration = clean.nativeIntegration !== false;
  clean.nativeDaysBefore = Math.max(0, Math.min(730, Number(clean.nativeDaysBefore) || DEFAULT_CONFIG.nativeDaysBefore));
  clean.nativeDaysAfter = Math.max(1, Math.min(1095, Number(clean.nativeDaysAfter) || DEFAULT_CONFIG.nativeDaysAfter));
  clean.contactAddressBookIds = Array.isArray(clean.contactAddressBookIds)
    ? [...new Set(clean.contactAddressBookIds.map(value => String(value || "").trim()).filter(Boolean))]
    : ["*"];
  if (clean.contactAddressBookIds.includes("*")) clean.contactAddressBookIds = ["*"];
  clean.confirmOutgoingMessages = clean.confirmOutgoingMessages !== false;
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
    scope: tokenResponse.scope || old?.scope || "",
    requiresInteraction: false,
    lastAuthError: "",
    lastRefreshAt: new Date().toISOString()
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

let silentAuthPromise = null;
let lastSilentAuthError = "";
let lastSilentAuthAttemptAt = 0;

function authErrorCode(error) {
  return String(error?.data?.error || "").trim().toLowerCase();
}

function errorNeedsInteraction(error) {
  const code = authErrorCode(error);
  if (["invalid_grant", "interaction_required", "login_required", "account_selection_required", "consent_required"].includes(code)) {
    return true;
  }
  return /AADSTS(?:50058|50076|50079|50158|65001|70000|700082)/i.test(String(error?.message || ""));
}

async function markAuthNeedsInteraction(error) {
  const auth = await getAuth();
  if (!auth) return;
  await browser.storage.local.set({
    auth: {
      ...auth,
      accessToken: "",
      requiresInteraction: true,
      lastAuthError: String(error?.message || error || t("errorNoValidLogin"))
    }
  });
}

async function authorizeToken({ prompt = "select_account", interactive = true, loginHint = "" } = {}) {
  const config = await getConfig();
  if (!config.clientId) throw new Error(t("errorClientIdMissing"));
  if (!config.tenant) throw new Error(t("errorTenantMissing"));

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
  if (prompt) authorize.searchParams.set("prompt", prompt);
  let hint = String(loginHint || "").trim();
  if (!hint) {
    try {
      const stored = await browser.storage.local.get("profile");
      hint = String(stored?.profile?.mail || stored?.profile?.userPrincipalName || "").trim();
    } catch (_) {}
  }
  if (hint) authorize.searchParams.set("login_hint", hint);

  const redirectResult = await browser.identity.launchWebAuthFlow({
    url: authorize.toString(),
    interactive: Boolean(interactive)
  });
  if (!redirectResult) throw new Error(t("errorLoginCancelled"));

  const resultUrl = new URL(redirectResult);
  const returnedState = resultUrl.searchParams.get("state");
  if (returnedState !== state) throw new Error(t("errorStateMismatch"));
  const authError = resultUrl.searchParams.get("error_description") || resultUrl.searchParams.get("error");
  if (authError) {
    const error = new Error(authError);
    error.authRequired = true;
    throw error;
  }
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
  return saveAuth(await parseJsonResponse(response));
}

async function loadAndStoreProfile() {
  const profile = await graphRequest("/me?$select=displayName,mail,userPrincipalName,id");
  await browser.storage.local.set({ profile });
  return profile;
}

async function silentReauthenticate() {
  if (silentAuthPromise) return silentAuthPromise;
  silentAuthPromise = (async () => {
    lastSilentAuthError = "";
    lastSilentAuthAttemptAt = Date.now();
    try {
      await authorizeToken({ prompt: "none", interactive: false });
      try { await loadAndStoreProfile(); } catch (_) {}
      return await getAuth();
    } catch (error) {
      lastSilentAuthError = error?.message || String(error);
      return null;
    } finally {
      silentAuthPromise = null;
    }
  })();
  return silentAuthPromise;
}

async function login() {
  // V2.24: a click on Login is also a recovery action. First try the existing
  // Microsoft browser session without interaction; only show account selection
  // if silent SSO really cannot recover the token set.
  let recovered = null;
  try { recovered = await silentReauthenticate(); } catch (_) {}
  if (!recovered?.accessToken) {
    await authorizeToken({ prompt: "select_account", interactive: true });
  }
  const profile = await loadAndStoreProfile();
  try {
    await runNativeAutoSync("login-success");
  } catch (error) {
    console.error("M365 native calendar setup after login failed", error);
  }
  return profile;
}

async function refreshAccessToken({ allowSilent = true } = {}) {
  const config = await getConfig();
  const auth = await getAuth();
  if (!config.clientId) throw new Error(t("errorClientIdShort"));
  if (!config.tenant) throw new Error(t("errorTenantShort"));

  if (!auth?.refreshToken) {
    if (allowSilent) {
      const recovered = await silentReauthenticate();
      if (recovered?.accessToken) return recovered;
    }
    const error = new Error(t("errorNoValidLogin"));
    error.status = 401;
    error.authRequired = true;
    throw error;
  }

  try {
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
    return await saveAuth(await parseJsonResponse(response));
  } catch (error) {
    // A refresh-token rejection can often be recovered without user input,
    // because the Microsoft login session is still alive in the auth window.
    // Try prompt=none before showing the user as disconnected.
    if (allowSilent && errorNeedsInteraction(error)) {
      const recovered = await silentReauthenticate();
      if (recovered?.accessToken) return recovered;
      await markAuthNeedsInteraction(error);
      const wrapped = new Error(t("errorLoginExpired", error.message));
      wrapped.status = 401;
      wrapped.data = error?.data || null;
      wrapped.authRequired = true;
      throw wrapped;
    }

    // Do NOT delete a still-useful refresh token on transient network/server
    // errors. V2.19 cleared auth here and could make Thunderbird look logged
    // out even though the Microsoft browser session was still valid.
    error.authRequired = false;
    throw error;
  }
}

async function getAccessToken() {
  let auth = await getAuth();
  if (!auth?.accessToken && !auth?.refreshToken) {
    const recovered = await silentReauthenticate();
    if (recovered?.accessToken) auth = recovered;
  }
  if (!auth?.accessToken && auth?.refreshToken) auth = await refreshAccessToken();
  if (!auth?.accessToken) {
    const error = new Error(t("errorNotSignedIn"));
    error.status = 401;
    error.authRequired = true;
    throw error;
  }
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
  let [auth, config, stored] = await Promise.all([
    getAuth(),
    getConfig(),
    browser.storage.local.get("profile")
  ]);

  // Recover a missing/interaction-marked token set from an existing Microsoft
  // browser session before presenting the user as disconnected. Throttle failed
  // silent attempts so opening the M365 space cannot create an auth loop.
  const hasToken = Boolean(auth?.accessToken || auth?.refreshToken);
  if (config.clientId && config.tenant && (!hasToken || auth?.requiresInteraction) && Date.now() - lastSilentAuthAttemptAt > 60_000) {
    const recovered = await silentReauthenticate();
    if (recovered?.accessToken || recovered?.refreshToken) {
      auth = recovered;
      stored = await browser.storage.local.get("profile");
    }
  }

  return {
    loggedIn: Boolean(auth?.accessToken || auth?.refreshToken) && !Boolean(auth?.requiresInteraction),
    requiresInteraction: Boolean(auth?.requiresInteraction),
    lastAuthError: String(auth?.lastAuthError || ""),
    lastSilentAuthError: String(lastSilentAuthError || ""),
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
      headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' }
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
          output[entry.index] = {
            ...entry.event,
            ...response.body,
            // V2.24 timezone correctness: calendarView was explicitly requested
            // in UTC. Detail hydration is only for sparse metadata and must not
            // replace those already-normalized start/end values with a second
            // representation that can be interpreted again by the local TZ.
            start: entry.event?.start || response.body?.start,
            end: entry.event?.end || response.body?.end
          };
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
            { headers: { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' } }
          );
          if (detail) {
            output[entry.index] = {
              ...entry.event,
              ...detail,
              start: entry.event?.start || detail?.start,
              end: entry.event?.end || detail?.end
            };
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
  if (sendResponse) {
    const event = await graphRequest(`/me/events/${encodeId(eventId)}?$select=id,subject,organizer,attendees,isOrganizer`);
    const organizerAddress = outgoingEmailAddress(event?.organizer?.emailAddress?.address);
    await requestOutgoingConfirmation({
      kind: outgoingResponseKind(response),
      subject: event?.subject || "",
      recipients: organizerAddress ? [organizerAddress] : [],
      note: t("outgoingConfirmRsvpNote")
    });
  }
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

const contactSearchDiagnosticsState = {
  at: "",
  query: "",
  permission: "unknown",
  nativeAvailable: false,
  nativeCount: 0,
  nativeError: "",
  quickSearchCount: 0,
  quickSearchError: "",
  addressBookCount: 0,
  enumeratedContactCount: 0,
  enumerationError: "",
  finalCount: 0
};

async function getContactSearchDiagnostics() {
  const data = { ...contactSearchDiagnosticsState };
  try {
    if (browser.permissions?.contains) {
      data.permission = await browser.permissions.contains({ permissions: ["addressBooks"] }) ? "granted" : "missing";
    } else {
      data.permission = browser.contacts ? "api-present" : "api-missing";
    }
  } catch (error) {
    data.permission = `check-failed: ${error?.message || String(error)}`;
  }
  const nativeApi = nativeApiIfLoaded();
  if (nativeApi?.diagnostics) {
    try {
      const native = await nativeApi.diagnostics();
      data.nativeAddressBook = native?.addressBookDiagnostics || null;
    } catch (error) {
      data.nativeDiagnosticsError = error?.message || String(error);
    }
  }
  return data;
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

const contactAutocompleteCache = new Map();
const CONTACT_AUTOCOMPLETE_CACHE_MS = 30000;

function contactBookScopeKey(addressBookIds) {
  const ids = Array.isArray(addressBookIds) ? addressBookIds.map(String).filter(Boolean) : ["*"];
  return ids.includes("*") ? "*" : [...ids].sort().join(",");
}

function contactAutocompleteCacheGet(text, addressBookIds) {
  const key = `${contactBookScopeKey(addressBookIds)}::${String(text || "").trim().toLowerCase()}`;
  const entry = contactAutocompleteCache.get(key);
  if (!entry || Number(entry.expiresAt || 0) <= Date.now()) {
    if (entry) contactAutocompleteCache.delete(key);
    return null;
  }
  return Array.isArray(entry.results) ? entry.results : null;
}

function contactAutocompleteCachePut(text, results, addressBookIds) {
  const key = `${contactBookScopeKey(addressBookIds)}::${String(text || "").trim().toLowerCase()}`;
  if (!key) return;
  contactAutocompleteCache.set(key, {
    expiresAt: Date.now() + CONTACT_AUTOCOMPLETE_CACHE_MS,
    results: Array.isArray(results) ? results.slice(0, 12) : []
  });
  if (contactAutocompleteCache.size > 60) {
    const oldest = contactAutocompleteCache.keys().next().value;
    if (oldest) contactAutocompleteCache.delete(oldest);
  }
}

function contactSuggestionList(text, directResults, nodes) {
  const needleParts = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];
  const seen = new Set();
  const addSuggestion = item => {
    const searchable = `${item.name || ""} ${item.email || ""}`.toLowerCase();
    if (needleParts.length && !needleParts.every(part => searchable.includes(part))) return;
    const key = String(item.email || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };
  for (const item of directResults || []) {
    addSuggestion(item);
    if (results.length >= 20) break;
  }
  if (results.length < 20) {
    for (const node of nodes || []) {
      for (const item of contactSuggestionData(node)) {
        addSuggestion({ ...item, source: node?.__m365Source || item.source || "webext" });
        if (results.length >= 20) break;
      }
      if (results.length >= 20) break;
    }
  }
  return results.slice(0, 12);
}

async function searchContacts(query, { diagnostic = false, addressBookIds = null } = {}) {
  const startedAt = Date.now();
  const text = String(query || "").trim();
  contactSearchDiagnosticsState.at = new Date().toISOString();
  contactSearchDiagnosticsState.query = text;
  contactSearchDiagnosticsState.mode = diagnostic ? "diagnostic" : "autocomplete";
  contactSearchDiagnosticsState.durationMs = 0;
  contactSearchDiagnosticsState.cacheHit = false;
  contactSearchDiagnosticsState.earlyReturn = "";
  contactSearchDiagnosticsState.nativeAvailable = false;
  contactSearchDiagnosticsState.nativeCount = 0;
  contactSearchDiagnosticsState.nativeError = "";
  contactSearchDiagnosticsState.quickSearchCount = 0;
  contactSearchDiagnosticsState.quickSearchError = "";
  contactSearchDiagnosticsState.addressBookCount = 0;
  contactSearchDiagnosticsState.enumeratedContactCount = 0;
  contactSearchDiagnosticsState.enumerationError = "";
  contactSearchDiagnosticsState.finalCount = 0;
  const config = await getConfig();
  const configuredBooks = Array.isArray(addressBookIds) ? addressBookIds : config.contactAddressBookIds;
  const bookScope = Array.isArray(configuredBooks) && configuredBooks.length ? configuredBooks.map(String) : [];
  const searchAllBooks = bookScope.includes("*");
  const selectedBookIds = searchAllBooks ? [] : bookScope;
  contactSearchDiagnosticsState.selectedAddressBookIds = searchAllBooks ? ["*"] : [...selectedBookIds];
  if (text.length < 2 || (!searchAllBooks && selectedBookIds.length === 0)) return [];

  if (!diagnostic) {
    const cached = contactAutocompleteCacheGet(text, searchAllBooks ? ["*"] : selectedBookIds);
    if (cached) {
      contactSearchDiagnosticsState.cacheHit = true;
      contactSearchDiagnosticsState.finalCount = cached.length;
      contactSearchDiagnosticsState.earlyReturn = "cache";
      contactSearchDiagnosticsState.durationMs = Date.now() - startedAt;
      return cached;
    }
  }

  const queryInfo = {
    searchString: text,
    includeLocal: true,
    includeRemote: true,
    includeReadOnly: true,
    includeReadWrite: true
  };
  const nodes = [];
  const nodeIds = new Set();
  const directResults = [];
  const addNodes = (values, source = "webext") => {
    for (const original of values || []) {
      const node = original && typeof original === "object" ? original : {};
      const key = String(node?.id || `${node?.parentId || ""}:${node?.properties?.PrimaryEmail || node?.vCard || ""}`);
      if (key && nodeIds.has(key)) continue;
      if (key) nodeIds.add(key);
      try { node.__m365Source = source; } catch (_) {}
      nodes.push(node);
    }
  };
  const addDirect = values => {
    for (const item of values || []) {
      const email = String(item?.email || "").trim();
      if (!email || !email.includes("@")) continue;
      directResults.push({
        id: String(item?.id || ""),
        name: String(item?.name || email).trim() || email,
        email,
        remote: Boolean(item?.remote),
        readOnly: Boolean(item?.readOnly),
        source: String(item?.source || "native")
      });
    }
  };

  // V2.24 live autocomplete is latency-first: the official contacts.quickSearch
  // result is enough to render suggestions immediately. V2.23 always continued
  // into native + complete address-book enumeration (thousands of contacts), so
  // results often arrived only after the user had typed the next characters and
  // were then discarded by the UI serial guard.
  if (browser.contacts?.quickSearch) {
    try {
      let values = [];
      if (searchAllBooks) {
        values = await browser.contacts.quickSearch(undefined, queryInfo);
      } else {
        const perBook = await Promise.all(selectedBookIds.map(async parentId => {
          try { return await browser.contacts.quickSearch(parentId, queryInfo); }
          catch (error) {
            contactSearchDiagnosticsState.quickSearchError = contactSearchDiagnosticsState.quickSearchError || `${parentId}: ${error?.message || error}`;
            return [];
          }
        }));
        values = perBook.flat();
      }
      contactSearchDiagnosticsState.quickSearchCount = Array.isArray(values) ? values.length : 0;
      addNodes(values, "thunderbird-quicksearch");
    } catch (firstError) {
      try {
        const values = searchAllBooks ? await browser.contacts.quickSearch(text) : [];
        contactSearchDiagnosticsState.quickSearchCount = Array.isArray(values) ? values.length : 0;
        addNodes(values, "thunderbird-quicksearch");
      } catch (secondError) {
        contactSearchDiagnosticsState.quickSearchError = `${firstError?.message || firstError}; fallback: ${secondError?.message || secondError}`;
      }
    }
  } else {
    contactSearchDiagnosticsState.quickSearchError = "browser.contacts.quickSearch unavailable";
  }

  let results = contactSuggestionList(text, directResults, nodes);
  if (!diagnostic && results.length) {
    contactSearchDiagnosticsState.finalCount = results.length;
    contactSearchDiagnosticsState.earlyReturn = "quickSearch";
    contactSearchDiagnosticsState.durationMs = Date.now() - startedAt;
    contactAutocompleteCachePut(text, results, searchAllBooks ? ["*"] : selectedBookIds);
    return results;
  }

  // NATIVE fallback: use Thunderbird's own compose-window address autocomplete.
  // This remains important for asynchronous/CardDAV-backed directories. It is
  // intentionally skipped when quickSearch already produced live suggestions.
  try {
    const nativeApi = await probeNativeApi({ retry: true });
    contactSearchDiagnosticsState.nativeAvailable = Boolean(nativeApi?.searchAddressBook);
    if (nativeApi?.activate) await nativeApi.activate();
    if (nativeApi?.searchAddressBook) {
      const values = await nativeApi.searchAddressBook(text, searchAllBooks ? ["*"] : selectedBookIds);
      contactSearchDiagnosticsState.nativeCount = Array.isArray(values) ? values.length : 0;
      addDirect(values);
    }
  } catch (error) {
    contactSearchDiagnosticsState.nativeError = error?.message || String(error);
  }

  results = contactSuggestionList(text, directResults, nodes);
  if (!diagnostic && results.length) {
    contactSearchDiagnosticsState.finalCount = results.length;
    contactSearchDiagnosticsState.earlyReturn = "native";
    contactSearchDiagnosticsState.durationMs = Date.now() - startedAt;
    contactAutocompleteCachePut(text, results, searchAllBooks ? ["*"] : selectedBookIds);
    return results;
  }

  // Exhaustive enumeration is a diagnostics/last-resort path, not part of the
  // normal live-keystroke path once a fast backend has returned usable matches.
  if (browser.addressBooks?.list) {
    try {
      const books = await browser.addressBooks.list(true);
      contactSearchDiagnosticsState.addressBookCount = Array.isArray(books) ? books.length : 0;
      for (const book of books || []) {
        if (!searchAllBooks && !selectedBookIds.includes(String(book?.id || ""))) continue;
        if (Array.isArray(book?.contacts)) {
          contactSearchDiagnosticsState.enumeratedContactCount += book.contacts.length;
          addNodes(book.contacts, "thunderbird-enumeration");
        } else if (book?.id && browser.contacts?.list) {
          try {
            const listed = await browser.contacts.list(book.id);
            contactSearchDiagnosticsState.enumeratedContactCount += Array.isArray(listed) ? listed.length : 0;
            addNodes(listed, "thunderbird-enumeration");
          } catch (error) {
            contactSearchDiagnosticsState.enumerationError += `${book?.name || book?.id}: ${error?.message || String(error)}; `;
          }
        }
      }
    } catch (error) {
      contactSearchDiagnosticsState.enumerationError += error?.message || String(error);
    }
  }

  results = contactSuggestionList(text, directResults, nodes);
  contactSearchDiagnosticsState.finalCount = results.length;
  contactSearchDiagnosticsState.durationMs = Date.now() - startedAt;
  if (!diagnostic) contactAutocompleteCachePut(text, results, searchAllBooks ? ["*"] : selectedBookIds);
  if (!results.length) {
    console.warn("M365 address-book autocomplete returned no results", { ...contactSearchDiagnosticsState });
  }
  return results;
}

async function listAddressBooksForSelection() {
  const merged = new Map();
  if (browser.addressBooks?.list) {
    try {
      const books = await browser.addressBooks.list(false);
      for (const book of books || []) {
        const id = String(book?.id || "");
        if (!id) continue;
        merged.set(id, {
          id,
          name: String(book?.name || id),
          remote: Boolean(book?.remote),
          readOnly: Boolean(book?.readOnly),
          useForAutocomplete: true,
          cardCount: null,
          source: "webextension"
        });
      }
    } catch (_) {}
  }
  try {
    const nativeApi = await probeNativeApi({ retry: false });
    if (nativeApi?.listAddressBooks) {
      const nativeBooks = await nativeApi.listAddressBooks();
      for (const book of nativeBooks || []) {
        const id = String(book?.id || book?.uid || "");
        if (!id) continue;
        const previous = merged.get(id) || {};
        merged.set(id, {
          ...previous,
          id,
          name: String(book?.name || previous.name || id),
          remote: Boolean(book?.remote ?? previous.remote),
          readOnly: Boolean(book?.readOnly ?? previous.readOnly),
          useForAutocomplete: book?.useForAutocomplete !== false,
          cardCount: Number.isFinite(Number(book?.cardCount)) ? Number(book.cardCount) : previous.cardCount ?? null,
          source: previous.source ? `${previous.source}+native` : "native"
        });
      }
    }
  } catch (_) {}
  return [...merged.values()].sort((a,b) => String(a.name).localeCompare(String(b.name)));
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

function ensureTeamsOrganizerAttendee(event, profile, enabled) {
  if (!enabled) return false;
  const address = profileMail(profile);
  if (!address) return false;
  event.attendees = Array.isArray(event.attendees) ? event.attendees : [];
  if (event.attendees.some(attendee => String(attendee?.emailAddress?.address || "").trim().toLowerCase() === address)) {
    return false;
  }
  const displayName = String(profile?.displayName || "").trim();
  event.attendees.push({
    emailAddress: { address, ...(displayName ? { name: displayName } : {}) },
    type: "required"
  });
  return true;
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

  // V2.30: Exchange sends meeting invitations to attendees, not a separate
  // invitation to the organizer merely because they created the event. For a
  // Teams event created from the M365 Space, explicitly keep the signed-in
  // organizer in the Event.attendees collection as a required participant.
  // The Event resource supports this and the server then processes the owner
  // through the same invitation path as the other attendees.
  if (payload.teams) {
    let profile = await storedProfile();
    if (!profileMail(profile)) {
      try { profile = await loadAndStoreProfile(); } catch (_) {}
    }
    ensureTeamsOrganizerAttendee(event, profile, true);
  }

  const createRecipients = outgoingRecipients(event.attendees);
  if (createRecipients.length) {
    await requestOutgoingConfirmation({
      kind: "meetingInvite",
      subject: event.subject,
      recipients: createRecipients,
      note: t("outgoingConfirmMeetingInviteNote")
    });
  }

  const created = await graphRequest(`/me/calendars/${encodeId(payload.calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event)
  });
  if (created?.id) rememberNativeUpsert(payload.calendarId, created);
  let complete = created;
  if (created?.id) {
    try { complete = await getGraphEventForNative(created.id, payload.calendarId); } catch (_) {}
    rememberNativeUpsert(payload.calendarId, complete || created);
  }
  await clearSyncCache({ calendarId: payload.calendarId });
  return complete;
}

async function updateEvent(payload) {
  if (!payload.eventId) throw new Error(t("errorEventIdMissing"));
  const config = await getConfig();
  const patch = buildGraphEventPayload({ ...payload, timeZone: config.timeZone }, { includeOnlineMeeting: false });
  // Graph does not accept attendees when an attendee edits an organizer-owned meeting.
  if (payload.includeAttendees === false) delete patch.attendees;
  if (payload.includeRecurrence === false) delete patch.recurrence;
  if (config.confirmOutgoingMessages) {
    const current = await getGraphEventForNative(payload.eventId, payload.calendarId || "");
    const recipients = outgoingRecipients(current?.attendees);
    if (current?.isOrganizer && recipients.length) {
      await requestOutgoingConfirmation({
        kind: "meetingUpdate",
        subject: current?.subject || patch.subject || "",
        recipients,
        note: t("outgoingConfirmMeetingUpdateNote")
      });
    }
  }
  const eventPath = payload.calendarId
    ? `/me/calendars/${encodeId(payload.calendarId)}/events/${encodeId(payload.eventId)}`
    : `/me/events/${encodeId(payload.eventId)}`;
  const updated = await graphRequest(eventPath, {
    method: "PATCH",
    headers: nativeGraphHeaders(),
    body: JSON.stringify(patch)
  });
  let complete = updated;
  if (updated?.id) {
    try { complete = await getGraphEventForNative(updated.id, payload.calendarId || ""); } catch (_) {}
    if (payload.calendarId) rememberNativeUpsert(payload.calendarId, complete || updated);
  }
  await clearSyncCache({ calendarId: payload.calendarId || "" });
  return complete;
}

async function deleteEvent({ eventId, calendarId = "" }) {
  if (!eventId) throw new Error(t("errorEventIdMissing"));
  const config = await getConfig();
  if (config.confirmOutgoingMessages) {
    const current = await getGraphEventForNative(eventId, calendarId || "");
    const recipients = outgoingRecipients(current?.attendees);
    if (current?.isOrganizer && recipients.length) {
      await requestOutgoingConfirmation({
        kind: "meetingCancellation",
        subject: current?.subject || "",
        recipients,
        note: t("outgoingConfirmMeetingCancellationNote")
      });
    }
  }
  const eventPath = calendarId
    ? `/me/calendars/${encodeId(calendarId)}/events/${encodeId(eventId)}`
    : `/me/events/${encodeId(eventId)}`;
  await graphRequest(eventPath, { method: "DELETE" });
  if (calendarId) {
    rememberNativeDelete(calendarId, eventId);
    await clearSyncCache({ calendarId });
  }
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
  const guarded = applyRecentNativeWriteGuards(calendarId, hydrated.events);
  guarded.events.sort((a, b) => new Date(a?.start?.dateTime || 0) - new Date(b?.start?.dateTime || 0));
  return {
    events: guarded.events,
    range,
    pages,
    hydrated: hydrated.hydrated,
    unresolved: hydrated.unresolved,
    protectedUpserts: guarded.protectedUpserts,
    protectedDeletes: guarded.protectedDeletes,
    recentWriteGuards: guarded.remaining
  };
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

async function authDiagnostics() {
  const auth = await getAuth();
  const expiresAt = Number(auth?.expiresAt || 0);
  return {
    hasAccessToken: Boolean(auth?.accessToken),
    hasRefreshToken: Boolean(auth?.refreshToken),
    expiresAt,
    expiresInSeconds: expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : null,
    requiresInteraction: Boolean(auth?.requiresInteraction),
    lastAuthError: String(auth?.lastAuthError || ""),
    lastRefreshAt: String(auth?.lastRefreshAt || ""),
    lastSilentAuthAttemptAt: lastSilentAuthAttemptAt ? new Date(lastSilentAuthAttemptAt).toISOString() : "",
    lastSilentAuthError: String(lastSilentAuthError || "")
  };
}

async function nativeStatus() {
  const config = await getConfig();
  const api = await probeNativeApi({ retry: true });
  if (api?.activate && config.nativeIntegration) {
    try { await api.activate(); }
    catch (error) { console.warn("M365 native provider activation failed", error); }
  }
  const status = await authStatus();

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
      daysAfter: config.nativeDaysAfter,
      autoSync: { ...nativeAutoSyncState, timer: Boolean(nativeAutoSyncState.timer) },
      providerStartup: { ...nativeProviderStartupState },
      authDiagnostics: await authDiagnostics()
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
    daysAfter: config.nativeDaysAfter,
    autoSync: { ...nativeAutoSyncState, timer: Boolean(nativeAutoSyncState.timer) },
    providerStartup: { ...nativeProviderStartupState },
    authDiagnostics: await authDiagnostics()
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
  if (!config.nativeIntegration) {
    try { await api.removeAll(); } catch (_) {}
    return { available: true, enabled: false, calendars: [] };
  }
  if (!status.loggedIn) {
    // Keep the already registered native calendars (and their cached events /
    // Thunderbird UI settings) during a temporary auth interruption. Only an
    // explicit logout or disabling Native integration removes them.
    let calendars = [];
    try { calendars = await api.status(); } catch (_) {}
    return {
      available: true,
      enabled: true,
      loggedIn: false,
      preservedOffline: true,
      calendars: Array.isArray(calendars) ? calendars : []
    };
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

  const nativeResult = await api.ensureCalendars(descriptors);
  if (nativeResult?.ok === false) {
    const stage = nativeResult.errorStage ? `[${nativeResult.errorStage}] ` : "";
    const error = new Error(`${stage}${nativeResult.error || t("unknownError")}`);
    error.nativeDiagnostics = nativeResult.diagnostics || null;
    throw error;
  }
  const calendars = Array.isArray(nativeResult)
    ? nativeResult
    : (Array.isArray(nativeResult?.calendars) ? nativeResult.calendars : []);

  let synchronized = 0;
  let synchronizeDiagnostics = null;
  if (synchronize) {
    const syncResult = await api.synchronize();
    if (syncResult?.ok === false) {
      const stage = syncResult.errorStage ? `[${syncResult.errorStage}] ` : "";
      const error = new Error(`${stage}${syncResult.error || t("unknownError")}`);
      error.nativeDiagnostics = syncResult.diagnostics || null;
      throw error;
    }
    synchronized = typeof syncResult === "number" ? syncResult : Number(syncResult?.count || 0);
    synchronizeDiagnostics = syncResult?.diagnostics || null;
  }
  return {
    available: true,
    enabled: true,
    calendars,
    graphCalendarCount: descriptors.length,
    offlineCalendarList: Boolean(calendarResult.offline),
    synchronized,
    diagnostics: nativeResult?.diagnostics || null,
    synchronizeDiagnostics
  };
}

async function syncNativeCalendars() {
  const ensured = await ensureNativeCalendars({ synchronize: false });
  if (!ensured.enabled) return { ...ensured, synchronized: 0, directCachePush: [] };
  const api = nativeApiIfLoaded() || await probeNativeApi({ retry: true });
  if (!api) {
    return { ...ensured, synchronized: 0, directCachePush: [], bridgeError: String(nativeBridgeState.error || "") };
  }
  if (!api.replaceCalendarEvents) {
    throw new Error("Native V2.28 cache-push API is unavailable");
  }

  const results = [];
  let graphEvents = 0;
  let cacheWrites = 0;
  let cacheItems = 0;

  // V2.16 deliberately fetches Graph in the proven WebExtension context and
  // pushes the completed snapshot directly into Thunderbird's offline cache.
  // The custom provider onSync/replayChangesOn path remains as a fallback for
  // Thunderbird-triggered refreshes, but is no longer the primary sync path.
  for (const calendar of ensured.calendars || []) {
    const graphCalendarId = String(calendar.graphCalendarId || "");
    if (!graphCalendarId) continue;
    const graph = await listNativeGraphEvents(graphCalendarId);
    const nativeEvents = graph.events.map(M365_NATIVE.graphEventToNative);
    const pushed = await api.replaceCalendarEvents(graphCalendarId, nativeEvents);
    if (pushed?.ok === false) {
      const stage = pushed.errorStage ? `[${pushed.errorStage}] ` : "";
      const error = new Error(`${stage}${pushed.error || t("unknownError")}`);
      error.nativeDiagnostics = pushed.diagnostics || null;
      throw error;
    }
    graphEvents += Number(pushed?.graphEvents ?? nativeEvents.length);
    cacheWrites += Number(pushed?.cacheWrites || 0);
    cacheItems += Number(pushed?.cacheItems || 0);
    results.push({
      graphCalendarId,
      name: calendar.name || "Microsoft 365",
      graphEvents: Number(pushed?.graphEvents ?? nativeEvents.length),
      cacheWrites: Number(pushed?.cacheWrites || 0),
      cacheItems: Number(pushed?.cacheItems || 0),
      pages: Number(graph.pages || 0),
      message: String(pushed?.message || "")
    });
  }

  let viewReload = null;
  if (typeof api.reloadViews === "function") {
    try { viewReload = await api.reloadViews("sync-complete"); }
    catch (error) { console.warn("M365 native calendar view reload after sync failed", error); }
  }

  return {
    ...ensured,
    synchronized: results.length,
    directCachePush: results,
    directGraphEvents: graphEvents,
    directCacheWrites: cacheWrites,
    directCacheItems: cacheItems,
    viewReload
  };
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
  const nativeCreateRecipients = outgoingRecipients(payload.attendees);
  if (nativeCreateRecipients.length) {
    await requestOutgoingConfirmation({
      kind: "meetingInvite",
      subject: payload.subject || item?.title || "",
      recipients: nativeCreateRecipients,
      note: t("outgoingConfirmMeetingInviteNote")
    });
  }
  const created = await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events`, {
    method: "POST",
    headers: nativeGraphHeaders(),
    body: JSON.stringify(payload)
  });
  await invalidateAfterNativeWrite(calendar.graphCalendarId);
  const complete = created?.id ? await getGraphEventForNative(created.id, calendar.graphCalendarId) : created;
  if (complete?.id) rememberNativeUpsert(calendar.graphCalendarId, complete);
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
    const nativeUpdateRecipients = outgoingRecipients(oldItem?.attendees?.length ? oldItem.attendees : item?.attendees);
    if (nativeUpdateRecipients.length) {
      await requestOutgoingConfirmation({
        kind: "meetingUpdate",
        subject: oldItem?.title || item?.title || payload.subject || "",
        recipients: nativeUpdateRecipients,
        note: t("outgoingConfirmMeetingUpdateNote")
      });
    }
    await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events/${encodeId(item.id)}`, {
      method: "PATCH",
      headers: nativeGraphHeaders(),
      body: JSON.stringify(payload)
    });
  }

  await invalidateAfterNativeWrite(calendar?.graphCalendarId || "");
  const updated = await getGraphEventForNative(item.id, calendar?.graphCalendarId || "");
  if (calendar?.graphCalendarId && updated?.id) rememberNativeUpsert(calendar.graphCalendarId, updated);
  return M365_NATIVE.graphEventToNative(updated);
}

async function nativeRemoveHandler(calendar, item, options = {}) {
  if (!item?.id) throw new Error(t("errorEventIdMissing"));
  const ownAddresses = nativeCalendarAddresses(calendar);
  const organizer = outgoingEmailAddress(item?.organizer?.address);
  const isOrganizer = Boolean(item?.isOrganizer || (organizer && ownAddresses.includes(organizer)));
  const nativeDeleteRecipients = outgoingRecipients(item?.attendees);
  if (isOrganizer && nativeDeleteRecipients.length) {
    await requestOutgoingConfirmation({
      kind: "meetingCancellation",
      subject: item?.title || "",
      recipients: nativeDeleteRecipients,
      note: t("outgoingConfirmMeetingCancellationNote")
    });
  }
  await graphRequest(`/me/calendars/${encodeId(calendar.graphCalendarId)}/events/${encodeId(item.id)}`, { method: "DELETE" });
  if (calendar?.graphCalendarId) rememberNativeDelete(calendar.graphCalendarId, item.id);
  await invalidateAfterNativeWrite(calendar?.graphCalendarId || "");
  return true;
}

async function refreshNativeAfterExternalWrite({ calendarId = "", event = null, deletedEventId = "" } = {}) {
  try {
    const config = await getConfig();
    if (!config.nativeIntegration) return;
    const status = await authStatus();
    if (!status.loggedIn) return;
    const api = nativeApiIfLoaded() || await probeNativeApi({ retry: true });
    if (!api) return;

    // V2.27: do not wait for calendarView propagation. The direct event endpoint
    // is authoritative immediately after POST/PATCH, so place that exact object
    // in Thunderbird's cache first. The normal full sync follows later.
    await ensureNativeCalendars({ synchronize: false });
    if (calendarId && event?.id && api.upsertCalendarEvent) {
      const nativeEvent = M365_NATIVE.graphEventToNative(event);
      await api.upsertCalendarEvent(calendarId, nativeEvent);
      if (api.reloadViews) await api.reloadViews("external-write-upsert");
      scheduleNativeAutoSync("external-write-reconcile", 2200);
      return;
    }
    if (calendarId && deletedEventId && api.removeCalendarEvent) {
      await api.removeCalendarEvent(calendarId, deletedEventId);
      if (api.reloadViews) await api.reloadViews("external-write-delete");
      scheduleNativeAutoSync("external-write-reconcile", 2200);
      return;
    }
    scheduleNativeAutoSync("external-write", 900);
  } catch (error) {
    console.warn("M365 native refresh after external write failed", error);
    scheduleNativeAutoSync("external-write-fallback", 1200);
  }
}

async function initializeNativeCalendars() {
  try {
    const config = await getConfig();
    if (!config.nativeIntegration) return;
    const api = await probeNativeApi({ retry: true });
    if (api?.activate) await api.activate();
    const status = await authStatus();
    // Never delete persisted native calendars merely because authentication is
    // temporarily unavailable. Their registry preferences and cached events are
    // useful offline and survive until explicit Logout/native disable.
    if (status.loggedIn) await syncNativeCalendars();
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

async function openNativeTeamsMeetingPopup(details = {}) {
  const params = new URLSearchParams({ nativeTeams: "1" });
  if (details?.graphCalendarId) params.set("calendarId", String(details.graphCalendarId));
  if (details?.start) params.set("start", String(details.start));
  if (details?.eventId) params.set("editEventId", String(details.eventId));
  const url = browser.runtime.getURL(`calendar/calendar.html?${params.toString()}`);
  if (browser.windows?.create) {
    await browser.windows.create({
      url,
      type: "popup",
      width: 680,
      height: 640
    });
    return true;
  }
  if (browser.tabs?.create) {
    await browser.tabs.create({ url });
    return true;
  }
  throw new Error("Thunderbird cannot open the Teams meeting editor window");
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
      case "getOutgoingConfirmation": {
        const details = outgoingConfirmationDetails(message.token);
        if (!details) throw new Error(t("outgoingConfirmationExpired"));
        return { ok: true, data: details };
      }
      case "resolveOutgoingConfirmation":
        return { ok: true, data: { resolved: resolveOutgoingConfirmation(message.token, Boolean(message.approved)) } };
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
        const payload = message.payload || {};
        const data = await createEvent(payload);
        await refreshNativeAfterExternalWrite({ calendarId: payload.calendarId || "", event: data });
        return { ok: true, data };
      }
      case "updateEvent": {
        const payload = message.payload || {};
        const data = await updateEvent(payload);
        await refreshNativeAfterExternalWrite({ calendarId: payload.calendarId || "", event: data });
        return { ok: true, data };
      }
      case "deleteEvent": {
        const data = await deleteEvent(message);
        await refreshNativeAfterExternalWrite({ calendarId: message.calendarId || "", deletedEventId: message.eventId || "" });
        return { ok: true, data };
      }
      case "listAddressBooks": return { ok: true, data: await listAddressBooksForSelection() };
      case "searchContacts": return { ok: true, data: await searchContacts(message.query, { diagnostic: Boolean(message.diagnostic), addressBookIds: message.addressBookIds || null }) };
      case "contactDiagnostics": return { ok: true, data: await getContactSearchDiagnostics() };
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
    return {
      ok: false,
      error: error?.message || String(error),
      status: error?.status || 0,
      authRequired: Boolean(error?.authRequired)
    };
  }
});

// V2.16 startup: create the normal M365 Space first, then perform a delayed
// native synchronization when a valid login and native integration are present.
// This also runs when an existing add-on is re-enabled because its background
// script is started again.
ensureSpace();
scheduleNativeProviderActivation("background-start", 1200);
scheduleNativeAutoSync("background-start", 3000);

if (browser.runtime?.onStartup?.addListener) {
  browser.runtime.onStartup.addListener(() => {
    ensureSpace();
    scheduleNativeProviderActivation("thunderbird-startup", 1200);
    scheduleNativeAutoSync("thunderbird-startup", 3000);
  });
}

if (browser.runtime?.onInstalled?.addListener) {
  browser.runtime.onInstalled.addListener(details => {
    ensureSpace();
    scheduleNativeAutoSync(`extension-${details?.reason || "installed"}`, 2000);
  });
}

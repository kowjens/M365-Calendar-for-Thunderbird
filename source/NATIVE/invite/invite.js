"use strict";

const $ = id => document.getElementById(id);
const UI_LOCALE = browser.i18n.getUILanguage() || navigator.language || "de";
const dateTimeFormatter = new Intl.DateTimeFormat(UI_LOCALE, {
  weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});
const timeFormatter = new Intl.DateTimeFormat(UI_LOCALE, { hour: "2-digit", minute: "2-digit" });
let currentMessageId = null;
let currentAnalysis = null;

function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}

function applyI18n() {
  document.documentElement.lang = UI_LOCALE;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-title]")) node.title = t(node.dataset.i18nTitle);
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) node.placeholder = t(node.dataset.i18nPlaceholder);
}

async function api(action, extra = {}) {
  const result = await browser.runtime.sendMessage({ action, ...extra });
  if (!result?.ok) {
    const error = new Error(result?.error || t("unknownAddonError"));
    error.status = Number(result?.status || 0);
    throw error;
  }
  return result.data;
}

function showOnly(id) {
  for (const panelId of ["loadingPanel", "notInvitePanel", "invitePanel", "errorPanel"]) {
    $(panelId).classList.toggle("hidden", panelId !== id);
  }
}

async function getDisplayedMessage() {
  try {
    const message = await browser.messageDisplay.getDisplayedMessage();
    if (message) return message;
  } catch (_) {}
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (const tab of tabs) {
    try {
      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      if (message) return message;
    } catch (_) {}
  }
  return null;
}

function graphJoinUrl(event) {
  return event?.onlineMeeting?.joinUrl || event?.onlineMeetingUrl || "";
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

function methodLabel(method) {
  const labels = {
    REQUEST: t("inviteMethodRequest"),
    CANCEL: t("inviteMethodCancel"),
    REPLY: t("inviteMethodReply"),
    PUBLISH: t("inviteMethodPublish")
  };
  return labels[String(method || "").toUpperCase()] || String(method || t("unknown"));
}

function dateFrom(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(analysis) {
  const event = analysis?.event;
  const invitation = analysis?.invitation;
  const start = dateFrom(event?.start?.dateTime || invitation?.start?.iso);
  const end = dateFrom(event?.end?.dateTime || invitation?.end?.iso);
  if (!start) return t("noneDash");
  if ((event?.isAllDay || invitation?.start?.isDate)) return t("allDay");
  if (!end) return dateTimeFormatter.format(start);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dateTimeFormatter.format(start)} – ${timeFormatter.format(end)}`
    : `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)}`;
}

function personText(person) {
  if (!person) return t("noneDash");
  const name = person.name || person.emailAddress?.name || "";
  const address = person.address || person.emailAddress?.address || "";
  if (name && address) return `${name} · ${address}`;
  return name || address || t("noneDash");
}

function createLinkButton(label, url) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    try { await browser.tabs.create({ url }); } catch (_) { window.open(url, "_blank", "noopener"); }
  });
  return button;
}

function renderAnalysis(analysis) {
  currentAnalysis = analysis;
  if (!analysis?.isInvitation) {
    $("headlineStatus").textContent = t("inviteNotInvitationShort");
    showOnly("notInvitePanel");
    return;
  }

  showOnly("invitePanel");
  const inv = analysis.invitation || {};
  const event = analysis.event;
  $("methodBadge").textContent = methodLabel(inv.method);
  $("subjectText").textContent = event?.subject || inv.summary || t("noSubject");
  $("timeText").textContent = formatTime(analysis);
  $("locationText").textContent = event?.location?.displayName || inv.location || t("noneDash");
  $("organizerText").textContent = personText(event?.organizer || inv.organizer);
  $("responseText").textContent = event ? responseLabel(event.responseStatus?.response) : t("inviteStatusUnknown");

  const matchBox = $("matchBox");
  matchBox.className = "info-box";
  if (!analysis.auth?.loggedIn) {
    matchBox.textContent = t("inviteNeedsLogin");
    matchBox.classList.add("warn");
    $("headlineStatus").textContent = t("inviteDetected");
  } else if (event) {
    matchBox.textContent = t("inviteMatchedOnline");
    matchBox.classList.add("ok");
    $("headlineStatus").textContent = t("inviteMatchedShort");
  } else if (analysis.lookupError) {
    matchBox.textContent = t("inviteLookupError", analysis.lookupError);
    matchBox.classList.add("warn");
    $("headlineStatus").textContent = t("inviteDetected");
  } else {
    matchBox.textContent = t("inviteNoOnlineMatch");
    matchBox.classList.add("warn");
    $("headlineStatus").textContent = t("inviteDetected");
  }

  const canRespond = Boolean(analysis.canRespond);
  $("responseRow").classList.toggle("hidden", !canRespond);
  $("commentWrap").classList.toggle("hidden", !canRespond);
  $("sendWrap").classList.toggle("hidden", !canRespond);

  const links = $("linkRow");
  links.replaceChildren();
  const joinUrl = graphJoinUrl(event);
  if (joinUrl) links.appendChild(createLinkButton(t("joinTeams"), joinUrl));
  if (event?.webLink) links.appendChild(createLinkButton(t("openOutlook"), event.webLink));
}

async function refresh() {
  showOnly("loadingPanel");
  $("headlineStatus").textContent = t("inviteLoading");
  try {
    const message = await getDisplayedMessage();
    if (!message?.id) throw new Error(t("inviteErrorNoDisplayedMessage"));
    currentMessageId = message.id;
    const analysis = await api("analyzeInvitation", { messageId: message.id });
    renderAnalysis(analysis);
  } catch (error) {
    $("errorText").textContent = error.message || String(error);
    $("headlineStatus").textContent = t("inviteErrorShort");
    showOnly("errorPanel");
  }
}

async function respond(response) {
  if (!currentMessageId) return;
  const buttons = $("responseRow").querySelectorAll("button");
  buttons.forEach(button => button.disabled = true);
  $("headlineStatus").textContent = t("inviteSendingResponse");
  try {
    const result = await api("respondInvitation", {
      messageId: currentMessageId,
      response,
      comment: $("commentInput").value.trim(),
      sendResponse: $("sendResponseCheck").checked
    });
    if (currentAnalysis) {
      currentAnalysis.event = result.event || currentAnalysis.event;
      currentAnalysis.canRespond = Boolean(currentAnalysis.event && !currentAnalysis.event.isOrganizer && !currentAnalysis.event.isCancelled);
    }
    $("commentInput").value = "";
    renderAnalysis(currentAnalysis);
    $("headlineStatus").textContent = response === "accept"
      ? t("toastAccepted")
      : response === "decline" ? t("toastDeclined") : t("toastTentative");
  } catch (error) {
    $("headlineStatus").textContent = t("inviteResponseFailed", error.message || String(error));
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

function bind() {
  $("refreshBtn").addEventListener("click", refresh);
  $("openSpaceBtn").addEventListener("click", async () => {
    await api("openSpace");
    window.close();
  });
  for (const button of $("responseRow").querySelectorAll("[data-response]")) {
    button.addEventListener("click", () => respond(button.dataset.response));
  }
}

applyI18n();
bind();
refresh();

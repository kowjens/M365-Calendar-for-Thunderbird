"use strict";

const $ = id => document.getElementById(id);
const t = (key, substitutions) => browser.i18n.getMessage(key, substitutions) || key;

function applyI18n() {
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
}

async function resolve(approved) {
  const token = new URLSearchParams(location.search).get("token") || "";
  $("sendBtn").disabled = true;
  $("cancelBtn").disabled = true;
  try {
    await browser.runtime.sendMessage({ action: "resolveOutgoingConfirmation", token, approved: Boolean(approved) });
  } finally {
    window.close();
  }
}

async function init() {
  applyI18n();
  const token = new URLSearchParams(location.search).get("token") || "";
  try {
    const result = await browser.runtime.sendMessage({ action: "getOutgoingConfirmation", token });
    if (!result?.ok || !result.data) throw new Error(result?.error || t("outgoingConfirmationExpired"));
    const details = result.data;
    $("actionText").textContent = details.action || "—";
    $("subjectText").textContent = details.subject || "—";
    $("noteText").textContent = details.note || "";
    const recipients = Array.isArray(details.recipients) ? details.recipients : [];
    $("recipientList").replaceChildren(...recipients.map(address => { const li=document.createElement("li"); li.textContent=address; return li; }));
    $("noRecipients").classList.toggle("hidden", recipients.length > 0);
    $("recipientList").classList.toggle("hidden", recipients.length === 0);
  } catch (error) {
    $("errorText").textContent = error?.message || String(error);
    $("errorText").classList.remove("hidden");
    $("sendBtn").disabled = true;
  }
  $("sendBtn").addEventListener("click", () => resolve(true));
  $("cancelBtn").addEventListener("click", () => resolve(false));
}

init();

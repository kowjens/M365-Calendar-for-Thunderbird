"use strict";

const $ = id => document.getElementById(id);
let lastDiagnostics = "";

async function msg(action, extra = {}) {
  const response = await browser.runtime.sendMessage({ action, ...extra });
  if (!response?.ok) {
    throw new Error(response?.error || `Background action failed: ${action}`);
  }
  return response.data;
}

function state(id, text, ok = true) {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.dataset.ok = ok ? "1" : "0";
}

async function getBrowserInfo() {
  try {
    return await browser.runtime.getBrowserInfo();
  } catch (_) {
    return { name: "Thunderbird", version: "unknown", buildID: "?" };
  }
}

async function loadSettings() {
  let config;
  try {
    config = await msg("getConfig");
    state("backgroundState", "responsive", true);
  } catch (error) {
    state("backgroundState", `ERROR: ${error.message}`, false);
    const stored = await browser.storage.local.get("config");
    config = stored.config || {};
  }

  $("clientId").value = config.clientId || "";
  $("tenant").value = config.tenant || "";
  $("timeZone").value = config.timeZone || "W. Europe Standard Time";
  $("autoSyncMinutes").value = String(config.autoSyncMinutes ?? 5);
  $("confirmOutgoingMessages").checked = config.confirmOutgoingMessages !== false;

  try {
    $("redirectUri").value = browser.identity?.getRedirectURL
      ? browser.identity.getRedirectURL("oauth2")
      : "unavailable";
  } catch (_) {
    $("redirectUri").value = "unavailable";
  }
}

async function refreshDiagnostics() {
  const info = await getBrowserInfo();
  const manifest = browser.runtime.getManifest();
  state("tbVersion", `${info.name || "Thunderbird"} ${info.version || "?"}`);
  state("addonVersion", manifest.version || "?");
  state("editionState", "STANDARD / WebExtension only", true);

  const lines = [
    `Thunderbird=${info.version || "?"}`,
    `buildID=${info.buildID || "?"}`,
    `addon=${manifest.version || "?"}`,
    `extensionId=${manifest.browser_specific_settings?.gecko?.id || "?"}`,
    `strictMin=${manifest.browser_specific_settings?.gecko?.strict_min_version || "-"}`,
    `strictMax=${manifest.browser_specific_settings?.gecko?.strict_max_version || "-"}`,
    "edition=STANDARD",
    "nativeExperiment=false"
  ];

  try {
    await msg("authStatus");
    state("backgroundState", "responsive", true);
  } catch (error) {
    state("backgroundState", `ERROR: ${error.message}`, false);
    lines.push(`backgroundError=${error.stack || error}`);
  }

  const runningMajor = parseInt(info.version, 10);
  const declaredMax = manifest.browser_specific_settings?.gecko?.strict_max_version;
  const maxMajor = declaredMax ? parseInt(declaredMax, 10) : null;
  if (Number.isFinite(runningMajor) && Number.isFinite(maxMajor) && runningMajor > maxMajor) {
    $("compatWarning").textContent =
      `This package declares Thunderbird ${declaredMax} as its maximum version, but Thunderbird ${info.version} is running.`;
    $("compatWarning").classList.remove("hidden");
  } else {
    $("compatWarning").classList.add("hidden");
  }

  lastDiagnostics = lines.join("\n");
  $("diagnostics").textContent = lastDiagnostics;
}

async function save() {
  const patch = {
    clientId: $("clientId").value.trim(),
    tenant: $("tenant").value.trim(),
    timeZone: $("timeZone").value.trim(),
    autoSyncMinutes: Number($("autoSyncMinutes").value || 0),
    nativeIntegration: false,
    confirmOutgoingMessages: $("confirmOutgoingMessages").checked
  };

  try {
    await msg("saveConfig", { config: patch });
    $("saveStatus").textContent = "Settings saved through background.";
  } catch (error) {
    const stored = await browser.storage.local.get("config");
    await browser.storage.local.set({ config: { ...(stored.config || {}), ...patch } });
    $("saveStatus").textContent =
      `Background unavailable; settings stored directly. Restart Thunderbird. (${error.message})`;
  }
}

async function run(action) {
  try {
    await msg(action);
    await refreshDiagnostics();
  } catch (error) {
    alert(error.message);
  }
}

$("save").addEventListener("click", save);
$("login").addEventListener("click", () => run("login"));
$("logout").addEventListener("click", () => run("logout"));
$("openSpace").addEventListener("click", () => run("openSpace"));
$("refreshDiagnostics").addEventListener("click", refreshDiagnostics);
$("copyDiagnostics").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastDiagnostics);
  } catch (_) {
    prompt("Copy diagnostics", lastDiagnostics);
  }
});
$("copyRedirect").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("redirectUri").value);
  } catch (_) {
    $("redirectUri").select();
    document.execCommand("copy");
  }
});

(async () => {
  await loadSettings();
  await refreshDiagnostics();
})();

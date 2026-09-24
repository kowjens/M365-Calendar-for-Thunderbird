"use strict";
const $=id=>document.getElementById(id);
let lastDiagnostics="";
async function msg(action,extra={}){const r=await browser.runtime.sendMessage({action,...extra});if(!r?.ok)throw new Error(r?.error||`Background action failed: ${action}`);return r.data;}
async function withTimeout(value,timeoutMs,label){
  let timer=null;
  try{
    return await Promise.race([
      Promise.resolve(value),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${timeoutMs} ms`)),timeoutMs);})
    ]);
  }finally{if(timer!==null)clearTimeout(timer);}
}
function state(id,text,ok=true){const el=$(id);el.textContent=text;el.dataset.ok=ok?"1":"0";}
async function getBrowserInfo(){try{return await browser.runtime.getBrowserInfo();}catch(_){return {name:"Thunderbird",version:"unknown",buildID:"?"};}}
async function loadSettings(){
  let cfg;
  try{cfg=await msg("getConfig");state("backgroundState","responsive",true);}catch(error){state("backgroundState",`ERROR: ${error.message}`,false);const stored=await browser.storage.local.get("config");cfg=stored.config||{};}
  $("clientId").value=cfg.clientId||"";$("tenant").value=cfg.tenant||"";$("timeZone").value=cfg.timeZone||"W. Europe Standard Time";$("autoSyncMinutes").value=String(cfg.autoSyncMinutes??5);$("nativeIntegration").checked=cfg.nativeIntegration!==false;$("confirmOutgoingMessages").checked=cfg.confirmOutgoingMessages!==false;
  try{$("redirectUri").value=browser.identity?.getRedirectURL?browser.identity.getRedirectURL("oauth2"):"unavailable";}catch(_){$("redirectUri").value="unavailable";}
}
async function refreshDiagnostics(){
  const info=await getBrowserInfo();const manifest=browser.runtime.getManifest();state("tbVersion",`${info.name||"Thunderbird"} ${info.version||"?"}`);state("addonVersion",manifest.version||"?");
  const lines=[`Thunderbird=${info.version||"?"}`,`buildID=${info.buildID||"?"}`,`addon=${manifest.version||"?"}`,`extensionId=${manifest.browser_specific_settings?.gecko?.id||"?"}`,`strictMin=${manifest.browser_specific_settings?.gecko?.strict_min_version||"-"}`,`strictMax=${manifest.browser_specific_settings?.gecko?.strict_max_version||"-"}`];
  try{const pong=await browser.nativeCalendar?.ping?.();state("experimentState",pong?"loaded / ping OK":"unavailable",Boolean(pong));lines.push(`experimentPing=${Boolean(pong)}`);}catch(error){state("experimentState",`ERROR: ${error.message}`,false);lines.push(`experimentError=${error.stack||error}`);}
  try{const native=await withTimeout(msg("nativeStatus"),15000,"nativeStatus");state("backgroundState","responsive",true);const rows=Array.isArray(native)?native:(native?[native]:[]);const providerOk=rows.some(r=>r?.providerModuleLoaded||r?.registeredCalendarCount>0||r?.managerProviderRegistered);state("providerState",providerOk?"loaded / active":"not active",providerOk);lines.push("nativeStatus="+JSON.stringify(native,null,2));}catch(error){state("backgroundState",`ERROR: ${error.message}`,false);state("providerState","unknown (background unavailable)",false);lines.push(`nativeStatusError=${error.stack||error}`);}
  const runningMajor=parseInt(info.version,10);const declaredMax=manifest.browser_specific_settings?.gecko?.strict_max_version;const maxMajor=declaredMax?parseInt(declaredMax,10):null;if(Number.isFinite(runningMajor)&&Number.isFinite(maxMajor)&&runningMajor>maxMajor){$("compatWarning").textContent=`This package declares Thunderbird ${declaredMax} as its maximum version, but Thunderbird ${info.version} is running. Use a compatible package or the uncapped GitHub/internal build.`;$("compatWarning").classList.remove("hidden");}else{$("compatWarning").classList.add("hidden");}
  lastDiagnostics=lines.join("\n");$("diagnostics").textContent=lastDiagnostics;
}
async function save(){const patch={clientId:$("clientId").value.trim(),tenant:$("tenant").value.trim(),timeZone:$("timeZone").value.trim(),autoSyncMinutes:Number($("autoSyncMinutes").value||0),nativeIntegration:$("nativeIntegration").checked,confirmOutgoingMessages:$("confirmOutgoingMessages").checked};try{await msg("saveConfig",{config:patch});$("saveStatus").textContent="Settings saved through background.";}catch(error){const stored=await browser.storage.local.get("config");await browser.storage.local.set({config:{...(stored.config||{}),...patch}});$("saveStatus").textContent=`Background unavailable; settings stored directly. Restart Thunderbird. (${error.message})`;}}
async function run(action){try{await msg(action,action==="ensureNativeCalendars"?{synchronize:false}:{});await refreshDiagnostics();}catch(error){alert(error.message);}}
$("save").addEventListener("click",save);$("login").addEventListener("click",()=>run("login"));$("logout").addEventListener("click",()=>run("logout"));$("activateNative").addEventListener("click",()=>run("ensureNativeCalendars"));$("syncNative").addEventListener("click",()=>run("syncNativeCalendars"));$("openSpace").addEventListener("click",()=>run("openSpace"));$("refreshDiagnostics").addEventListener("click",refreshDiagnostics);$("copyDiagnostics").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(lastDiagnostics);}catch(_){prompt("Copy diagnostics",lastDiagnostics);}});$("copyRedirect").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("redirectUri").value);}catch(_){$("redirectUri").select();document.execCommand("copy");}});
(async()=>{await loadSettings();await refreshDiagnostics();})();

"use strict";
const fs=require("fs"), path=require("path"), vm=require("vm"), assert=require("assert");
const root=path.resolve(__dirname,"..");
const bg=fs.readFileSync(path.join(root,"background.js"),"utf8");
const start=bg.indexOf('function decodeVCardValue');
const end=bg.indexOf('\nfunction cleanAttendees',start);
assert.ok(start>=0 && end>start,'contact search block not found');
let nativeCalled=0, enumerationCalled=0;
const sandbox={
  console,
  browser:{
    permissions:{contains:async()=>true},
    contacts:{quickSearch:async()=>[{id:'1',properties:{DisplayName:'Alex Example',PrimaryEmail:'alex@example.com'}}]},
    addressBooks:{list:async()=>{enumerationCalled++; throw new Error('enumeration must not run on quick hit');}}
  },
  getConfig:async()=>({contactAddressBookIds:['*']}),
  probeNativeApi:async()=>{nativeCalled++; throw new Error('native fallback must not run on quick hit');},
  nativeApiIfLoaded:()=>null
};
vm.createContext(sandbox);
vm.runInContext(bg.slice(start,end)+'\nthis.searchContacts=searchContacts; this.diag=contactSearchDiagnosticsState;',sandbox);
(async()=>{
  const result=await sandbox.searchContacts('alex@example.com');
  assert.strictEqual(result.length,1);
  assert.strictEqual(result[0].email,'alex@example.com');
  assert.strictEqual(nativeCalled,0);
  assert.strictEqual(enumerationCalled,0);
  assert.strictEqual(sandbox.diag.earlyReturn,'quickSearch');
  console.log('V2.24 attendee quickSearch behavior passed');
})().catch(e=>{console.error(e);process.exit(1);});

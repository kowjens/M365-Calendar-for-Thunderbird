const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(m.version!=='2.0.40') throw new Error('version');
if(m.browser_specific_settings?.gecko?.strict_max_version) throw new Error('STANDARD must not impose strict_max_version');
if(m.browser_specific_settings?.gecko?.strict_min_version!=='128.0') throw new Error('strict_min_version');
if(m.options_ui?.page!=='options/options.html') throw new Error('standalone options page missing');
const js=fs.readFileSync(path.join(root,'options/options.js'),'utf8');
for(const needle of ['runtime.getBrowserInfo','nativeStatus','declaredMax','runningMajor']) if(!js.includes(needle)) throw new Error('missing '+needle);
console.log('V2.40 STANDARD compatibility policy/options contract passed');

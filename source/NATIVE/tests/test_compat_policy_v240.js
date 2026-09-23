const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(m.version!=='2.0.40') throw new Error('version');
if(m.browser_specific_settings?.gecko?.strict_max_version) throw new Error('GitHub NATIVE must not impose strict_max_version in V2.40');
if(m.browser_specific_settings?.gecko?.strict_min_version!=='128.0') throw new Error('strict_min_version');
if(m.options_ui?.page!=='options/options.html') throw new Error('standalone options page missing');
for(const f of ['options/options.html','options/options.js','options/options.css']) if(!fs.existsSync(path.join(root,f))) throw new Error('missing '+f);
const js=fs.readFileSync(path.join(root,'options/options.js'),'utf8');
for(const needle of ['runtime.getBrowserInfo','nativeCalendar?.ping','nativeStatus','declaredMax','runningMajor']) if(!js.includes(needle)) throw new Error('missing '+needle);
console.log('V2.40 NATIVE compatibility policy/options contract passed');

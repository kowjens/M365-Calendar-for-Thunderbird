const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"options","options.html"),"utf8");
if(html.includes("externalImipFallback")) throw new Error("STANDARD must not expose NATIVE-only external iMIP fallback setting");
console.log("V2.42 STANDARD native-only fallback isolation passed");

// node rdact.js <peerId> <actions.json> <out.png> ; actions: [{click:[x,y]},{key:"text"},{hotkey:["ctrl","a"]},{typeEnv:"VARNAME"},{wait:ms}]
const {execSync}=require('child_process');const fs=require('fs');
const tok=execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'RUSTDESK_MCP_TOKEN\',\'User\')"').toString().trim();
const [id,af,out]=process.argv.slice(2);let n=0;
async function call(name,args){const r=await fetch('http://127.0.0.1:59940/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+tok},body:JSON.stringify({jsonrpc:'2.0',id:++n,method:'tools/call',params:{name,arguments:args}})});const j=await r.json();return j.result||j;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let o=await call('open_desktop_session',{id});let s=o.structuredContent.session;
 for(let i=0;i<10&&!(o.structuredContent.connected);i++){await sleep(2000);o=await call('open_desktop_session',{id});s=o.structuredContent.session;}
 for(const a of JSON.parse(fs.readFileSync(af,'utf8'))){
  let r;
  if(a.click) r=await call('mouse_click',{session:s,x:a.click[0],y:a.click[1],...(a.button?{button:a.button}:{}),...(a.double?{clicks:2}:{})});
  else if(a.key!==undefined) r=await call('keyboard_input',{session:s,text:a.key});
  else if(a.hotkey) r=await call('keyboard_hotkey',{session:s,keys:a.hotkey});
  else if(a.typeEnv){ r=await call('keyboard_input',{session:s,text:process.env[a.typeEnv]||''}); r={typed:'[secret '+a.typeEnv+']',ok:!r.isError}; }
  else if(a.wait){await sleep(a.wait);continue;}
  console.log(JSON.stringify(a.typeEnv?{typeEnv:a.typeEnv}:a),'->',JSON.stringify(r.structuredContent||r).slice(0,160));
  await sleep(a.after||600);
 }
 for(let i=0;i<5;i++){const f=await call('get_desktop_frame',{session:s});const img=(f.content||[]).find(c=>c.type==='image');if(img){fs.writeFileSync(out,Buffer.from(img.data,'base64'));console.log('saved',out);break;}await sleep(2000);}
})().catch(e=>console.log('ERR',e.message));

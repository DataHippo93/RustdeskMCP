// Diagnostic (no Claude needed): node qbtest.js <peerId> <out.png> opens a session and saves one screen frame.
// Direct test: open session to a peer, grab one frame, save PNG. Usage: node qbtest.js <peerId> <outPng>
const {execSync}=require('child_process');const fs=require('fs');
const tok=execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'RUSTDESK_MCP_TOKEN\',\'User\')"').toString().trim();
const id=process.argv[2], out=process.argv[3];
let n=0;
async function call(method,params){const r=await fetch('http://127.0.0.1:59940/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+tok},body:JSON.stringify({jsonrpc:'2.0',id:++n,method,params})});return r.json();}
(async()=>{
 await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'qbtest',version:'1'}});
 const o=await call('tools/call',{name:'open_desktop_session',arguments:{id}});
 const sc=o.result&&o.result.structuredContent; console.log('open:',JSON.stringify(sc||o).slice(0,600));
 const sess=sc&&(sc.session||sc.sessionHandle); if(!sess){return;}
 let f;for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,3000));f=await call('tools/call',{name:'get_desktop_frame',arguments:{session:sess}});if(f.result&&!f.result.isError)break;console.log('wait',i,JSON.stringify(f.result.structuredContent).slice(0,150));}
 const img=(f.result&&f.result.content||[]).find(c=>c.type==='image');
 if(img){fs.writeFileSync(out,Buffer.from(img.data,'base64'));console.log('frame saved',out,JSON.stringify(f.result.structuredContent||{}).slice(0,300));}
 else console.log('frame:',JSON.stringify(f).slice(0,600));
})().catch(e=>console.log('ERR',e.message));

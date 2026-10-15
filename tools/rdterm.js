// node rdterm.js <peerId> <file-with-commands> [waitSec]  -> runs text in a RustDesk terminal on the peer, prints output
const {execSync}=require('child_process');const fs=require('fs');
const tok=execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'RUSTDESK_MCP_TOKEN\',\'User\')"').toString().trim();
const [id,file,wait]=process.argv.slice(2);let n=0;
async function call(name,args){const r=await fetch('http://127.0.0.1:59940/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+tok},body:JSON.stringify({jsonrpc:'2.0',id:++n,method:'tools/call',params:{name,arguments:args}})});const j=await r.json();return j.result&&j.result.structuredContent||j;}
(async()=>{
 const o=await call('open_terminal_session',{id,rows:50,cols:220});console.log('open:',JSON.stringify(o).slice(0,300));
 const s=o.session,t=o.terminalId||1;if(!s)return;
 let ok=false;for(let i=0;i<20&&!ok;i++){await new Promise(r=>setTimeout(r,3000));const x=await call('terminal_input',{session:s,terminalId:t,data:fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n')});ok=!(x.error&&/not ready/.test(x.error));if(!ok&&i%5==0)console.log('input:',JSON.stringify(x).slice(0,200));}if(!ok)console.log('NEVER READY');
 await new Promise(r=>setTimeout(r,(+wait||8)*1000));
 const out=await call('terminal_output',{session:s,terminalId:t,limit:20000});
 console.log(typeof out.output==='string'?out.output:JSON.stringify(out).slice(0,20000));
})().catch(e=>console.log('ERR',e.message));

const KEY = process.env.STITCH_KEY;
const URL = 'https://stitch.googleapis.com/mcp';
const PROJECT = '8780467438268379363';
import fs from 'fs';

async function rpc(method, params, isNotif=false) {
  const body = { jsonrpc:'2.0', method, ...(isNotif?{}:{id:Math.floor(Math.random()*1e6)}), ...(params?{params}:{}) };
  const r = await fetch(URL, { method:'POST', headers:{ 'Content-Type':'application/json', 'Accept':'application/json, text/event-stream', 'X-Goog-Api-Key':KEY }, body: JSON.stringify(body) });
  if (isNotif) return null;
  const text = await r.text();
  const ct = r.headers.get('content-type')||'';
  if (ct.includes('text/event-stream')) {
    const datas = text.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim());
    for (const d of datas.reverse()) { try { const j=JSON.parse(d); if(j.result||j.error) return j; } catch{} }
  }
  try { return JSON.parse(text); } catch { return {raw:text.slice(0,200)}; }
}
await rpc('initialize', { protocolVersion:'2024-11-05', capabilities:{}, clientInfo:{name:'c',version:'1'} });
await rpc('notifications/initialized', null, true);
const res = await rpc('tools/call', { name:'list_screens', arguments:{ projectId: PROJECT } });
const screens = (res.result?.structuredContent || res.result)?.screens || [];
console.log('TOTAL SCREENS:', screens.length, '\n');
const slug = s => s.replace(/[^a-z0-9]+/gi,'_').toLowerCase().slice(0,50);
let i=0;
for (const s of screens) {
  i++;
  const dl = s.htmlCode?.downloadUrl;
  console.log(`${i}. "${s.title}"  [${s.deviceType} ${s.width}x${s.height}]`);
  if (dl) {
    try {
      const h = await fetch(dl);
      const html = await h.text();
      const fn = `.scratch/stitch/${String(i).padStart(2,'0')}_${slug(s.title)}.html`;
      fs.writeFileSync(fn, html);
      console.log(`   saved ${fn} (${html.length} bytes)`);
    } catch(e){ console.log('   download failed:', e.message); }
  }
}

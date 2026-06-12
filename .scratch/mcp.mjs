const KEY = process.env.STITCH_KEY;
const URL = 'https://stitch.googleapis.com/mcp';
const PROJECT = '8780467438268379363';
let session = null;

async function rpc(method, params, isNotif=false) {
  const body = { jsonrpc:'2.0', method, ...(isNotif?{}:{id:Math.floor(Math.random()*1e6)}), ...(params?{params}:{}) };
  const headers = { 'Content-Type':'application/json', 'Accept':'application/json, text/event-stream', 'X-Goog-Api-Key':KEY };
  if (session) headers['Mcp-Session-Id'] = session;
  const r = await fetch(URL, { method:'POST', headers, body: JSON.stringify(body) });
  const sid = r.headers.get('mcp-session-id'); if (sid) session = sid;
  if (isNotif) return null;
  const ct = r.headers.get('content-type')||'';
  const text = await r.text();
  if (ct.includes('text/event-stream')) {
    // parse SSE: last data: line with a result
    const datas = text.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim());
    for (const d of datas.reverse()) { try { const j=JSON.parse(d); if(j.result||j.error) return j; } catch{} }
    return { raw:text.slice(0,300) };
  }
  try { return JSON.parse(text); } catch { return { status:r.status, raw:text.slice(0,300) }; }
}

const init = await rpc('initialize', { protocolVersion:'2024-11-05', capabilities:{}, clientInfo:{name:'claude-code',version:'1.0'} });
console.log('init:', init.result?.serverInfo?.name || JSON.stringify(init).slice(0,200), '| session:', session?'yes':'no');
await rpc('notifications/initialized', null, true);

const screens = await rpc('tools/call', { name:'list_screens', arguments:{ projectId: PROJECT } });
const sc = screens.result?.structuredContent || screens.result;
console.log('\n=== list_screens ===');
console.log(JSON.stringify(sc, null, 2).slice(0, 2500));

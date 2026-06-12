const apiKey = 'AIzaSyCdUm-xLb7zcJrkEfSCBXex_LFfcvpanv0';
const fetch = require('node-fetch');

async function test() {
  // Test if just using the API key with models/gemini-2.5-computer-use-preview-10-2025 works now?
  // Maybe the limit 0 was a temporary block.
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/antigravity-preview-05-2026:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    console.log(res.status, await res.text());
  } catch (e) { console.error(e); }
}
test();
